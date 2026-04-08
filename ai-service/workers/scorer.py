"""
Multi-LLM Compliance Scorer
Runs Claude + GPT + Gemini in parallel, aggregates scores, flags high-variance dimensions.
Called before every gate review (Gates 1, 2, 3, Defense).
"""
import asyncio
import json
import logging
import math
from typing import Any

import anthropic
import google.generativeai as genai
from openai import AsyncOpenAI

from config import get_settings
from schemas.gates import ComplianceMatrix, DimensionScore, GateNumber, ScoringInput

logger = logging.getLogger(__name__)

SCORING_SYSTEM_PROMPT = """You are a rigorous proposal reviewer for Webknot Technologies.
Score the provided deliverable against each dimension on a scale of 1-5.

Return ONLY valid JSON (no markdown fences):
{
  "scores": {
    "<dimension_name>": {
      "score": <1-5 float>,
      "reasoning": "<1-2 sentence explanation>"
    }
  }
}

Scoring guide:
1 = Poor — significant gaps, missing or wrong
2 = Below average — some gaps, needs major work
3 = Average — meets basic requirements
4 = Good — solid, minor improvements possible
5 = Excellent — exceeds expectations
"""


def _build_scoring_prompt(inp: ScoringInput) -> str:
    dimensions_list = "\n".join(f"- {d}" for d in inp.dimensions)
    content_str = json.dumps(inp.content, indent=2)[:3000]  # truncate for token budget
    rfp_str = inp.rfp_requirements or "Not provided"
    return (
        f"Gate: {inp.gate_number}\n"
        f"RFP/Requirements:\n{rfp_str}\n\n"
        f"Deliverable to score:\n{content_str}\n\n"
        f"Score these dimensions:\n{dimensions_list}"
    )


async def _score_with_openai(prompt: str, settings) -> dict[str, dict]:
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    response = await client.chat.completions.create(
        model=settings.llm_mid_model,
        messages=[
            {"role": "system", "content": SCORING_SYSTEM_PROMPT},
            {"role": "user",   "content": prompt},
        ],
        max_tokens=800,
        temperature=0.1,
        response_format={"type": "json_object"},
    )
    raw = response.choices[0].message.content or "{}"
    data = json.loads(raw)
    return data.get("scores", {})


async def _score_with_claude(prompt: str, settings) -> dict[str, dict]:
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    response = await client.messages.create(
        model=settings.llm_premium_model,
        max_tokens=800,
        system=SCORING_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text if response.content else "{}"
    # Strip markdown fences if present
    raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        data = json.loads(raw)
        return data.get("scores", {})
    except json.JSONDecodeError:
        logger.warning("Claude scorer returned invalid JSON: %s", raw[:200])
        return {}


async def _score_with_gemini(prompt: str, settings) -> dict[str, dict]:
    try:
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel("gemini-1.5-pro")
        full_prompt = f"{SCORING_SYSTEM_PROMPT}\n\n{prompt}"
        response = await asyncio.get_running_loop().run_in_executor(  # get_event_loop() deprecated in 3.10+
            None, lambda: model.generate_content(full_prompt)
        )
        raw = response.text.strip()
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        data = json.loads(raw)
        return data.get("scores", {})
    except Exception as exc:
        logger.warning("Gemini scorer failed: %s", exc)
        return {}


def _aggregate_scores(
    openai_scores: dict,
    claude_scores: dict,
    gemini_scores: dict,
    dimensions: list[str],
    variance_threshold: float = 1.0,
) -> list[DimensionScore]:
    results = []

    for dim in dimensions:
        scores_by_provider: dict[str, float] = {}
        reasoning_by_provider: dict[str, str] = {}

        for provider, provider_scores in [
            ("gpt", openai_scores),
            ("claude", claude_scores),
            ("gemini", gemini_scores),
        ]:
            if dim in provider_scores and provider_scores[dim]:
                entry = provider_scores[dim]
                if isinstance(entry, dict):
                    scores_by_provider[provider] = float(entry.get("score", 3.0))
                    reasoning_by_provider[provider] = str(entry.get("reasoning", ""))
                elif isinstance(entry, (int, float)):
                    scores_by_provider[provider] = float(entry)

        if not scores_by_provider:
            # No provider returned a score — default to 3
            scores_by_provider = {"gpt": 3.0, "claude": 3.0, "gemini": 3.0}

        values = list(scores_by_provider.values())
        mean = sum(values) / len(values)
        variance = sum((v - mean) ** 2 for v in values) / len(values)
        std_dev = math.sqrt(variance)

        is_high_variance = std_dev >= variance_threshold
        suggestions = []
        if mean < 3.0:
            suggestions.append(f"Dimension '{dim}' scored below average (mean={mean:.1f}) — needs improvement")
        if is_high_variance:
            suggestions.append(f"High variance in '{dim}' (stddev={std_dev:.2f}) — requires human judgment")

        results.append(DimensionScore(
            dimension=dim,
            mean_score=round(mean, 2),
            std_dev=round(std_dev, 2),
            scores=scores_by_provider,
            reasoning=reasoning_by_provider,
            is_high_variance=is_high_variance,
            suggestions=suggestions,
        ))

    return results


async def run(payload: dict[str, Any], engagement_id: str | None) -> dict[str, Any]:
    """Multi-LLM compliance scorer entry point."""
    inp = ScoringInput(
        engagement_id=engagement_id or payload.get("engagement_id", ""),
        gate_number=GateNumber(payload["gate_number"]),
        content=payload["content"],
        rfp_requirements=payload.get("rfp_requirements"),
        dimensions=payload.get("dimensions", [
            "technical_accuracy", "client_relevance",
            "completeness", "clarity", "value_proposition",
        ]),
    )

    settings = get_settings()
    prompt = _build_scoring_prompt(inp)
    variance_threshold = float(payload.get("variance_threshold", 1.0))

    logger.info("Scoring gate=%s engagement=%s dimensions=%d",
                inp.gate_number, inp.engagement_id, len(inp.dimensions))

    # Run all three scorers in parallel
    openai_scores, claude_scores, gemini_scores = await asyncio.gather(
        _score_with_openai(prompt, settings),
        _score_with_claude(prompt, settings),
        _score_with_gemini(prompt, settings),
        return_exceptions=True,
    )

    # Handle any exceptions from parallel calls
    def safe(result: Any, name: str) -> dict:
        if isinstance(result, Exception):
            logger.error("%s scorer raised exception: %s", name, result)
            return {}
        return result or {}

    openai_scores  = safe(openai_scores,  "OpenAI")
    claude_scores  = safe(claude_scores,  "Claude")
    gemini_scores  = safe(gemini_scores,  "Gemini")

    dimension_scores = _aggregate_scores(
        openai_scores, claude_scores, gemini_scores,
        inp.dimensions, variance_threshold,
    )

    overall = sum(d.mean_score for d in dimension_scores) / max(len(dimension_scores), 1)
    high_variance = [d.dimension for d in dimension_scores if d.is_high_variance]
    all_suggestions = [s for d in dimension_scores for s in d.suggestions]

    matrix = ComplianceMatrix(
        gate_number=inp.gate_number,
        engagement_id=inp.engagement_id,
        dimensions=dimension_scores,
        overall_score=round(overall, 2),
        high_variance_areas=high_variance,
        improvement_suggestions=all_suggestions,
        scoring_model_versions={
            "gpt": settings.llm_mid_model,
            "claude": settings.llm_premium_model,
            "gemini": "gemini-1.5-pro",
        },
    )

    logger.info("Scoring complete: overall=%.2f high_variance=%s", overall, high_variance)
    return matrix.model_dump()
