"""
Secondary Research Agent
Researches the prospect company + industry using Tavily web search,
then synthesises findings into a structured ResearchBrief using GPT-4o.
"""
import asyncio
import logging
import os
from typing import Any, Optional

import httpx
from openai import AsyncOpenAI

from config import get_settings
from schemas.agents import (
    CompanyIntel,
    IndustryIntel,
    ResearchBrief,
    ResearchDepth,
    ResearchInput,
    ResearchSource,
)

logger = logging.getLogger(__name__)

# Source counts per depth level
DEPTH_SOURCE_COUNTS = {
    ResearchDepth.LIGHT:  5,
    ResearchDepth.MEDIUM: 10,
    ResearchDepth.DEEP:   20,
}

SYNTHESIS_SYSTEM_PROMPT = """You are a presales research analyst for Webknot Technologies.
Given web search results about a prospect company and their industry, produce a structured JSON research brief.

Return ONLY valid JSON (no markdown fences) matching this exact schema:
{
  "company": {
    "name": "string",
    "description": "1-2 sentence description",
    "industry": "string",
    "size": "startup|sme|enterprise or null",
    "recent_news": ["string", ...],
    "key_challenges": ["string", ...],
    "tech_stack_signals": ["string", ...]
  },
  "industry": {
    "domain": "string",
    "trends": ["string", ...],
    "challenges": ["string", ...],
    "regulatory_notes": ["string", ...]
  },
  "key_insights": ["string", ...],
  "talking_points": ["3-5 specific talking points Webknot can use in the meeting", ...]
}

Rules:
- Be specific — avoid generic filler statements
- talking_points must be actionable, not generic ("Your recent expansion into X suggests Y" not "We can help you grow")
- If information is unavailable, omit the field rather than hallucinating
- tech_stack_signals = any tech mentions (cloud provider, frameworks, tools) found in search results
"""


async def _search_tavily(
    queries: list[str],
    max_results_per_query: int,
    http_client: httpx.AsyncClient,
) -> list[dict]:
    """Run Tavily searches and collect results."""
    settings = get_settings()
    api_key = getattr(settings, "tavily_api_key", None) or os.getenv("TAVILY_API_KEY", "")

    if not api_key:
        logger.warning("TAVILY_API_KEY not set — returning empty search results")
        return []

    all_results: list[dict] = []
    for query in queries:
        try:
            resp = await http_client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": api_key,
                    "query": query,
                    "max_results": max_results_per_query,
                    "search_depth": "basic",
                    "include_answer": False,
                },
                timeout=15.0,
            )
            resp.raise_for_status()
            data = resp.json()
            all_results.extend(data.get("results", []))
        except Exception as exc:
            logger.warning("Tavily search failed for query '%s': %s", query, exc)

    return all_results


def _build_queries(inp: ResearchInput) -> list[str]:
    """Build targeted search queries for the prospect."""
    queries = [
        f"{inp.client_name} company overview {inp.domain}",
        f"{inp.client_name} technology digital transformation",
        f"{inp.domain} industry trends 2025 2026",
        f"{inp.client_name} recent news announcements",
    ]
    if inp.opportunity_context:
        queries.append(f"{inp.client_name} {inp.opportunity_context[:80]}")
    return queries


def _format_search_results(raw_results: list[dict]) -> str:
    """Format search results into a readable block for the LLM."""
    if not raw_results:
        return "No search results available."

    blocks = []
    for i, r in enumerate(raw_results[:20], 1):
        title = r.get("title", "Untitled")
        url = r.get("url", "")
        content = r.get("content", r.get("snippet", ""))[:400]
        blocks.append(f"[{i}] {title}\nURL: {url}\n{content}\n")

    return "\n".join(blocks)


async def run(payload: dict[str, Any], engagement_id: Optional[str]) -> dict[str, Any]:
    """
    Secondary Research Agent entry point.
    Called by dispatcher.py with the job payload from Node.
    """
    inp = ResearchInput(
        engagement_id=engagement_id or payload.get("engagement_id", ""),
        client_name=payload["client_name"],
        domain=payload["domain"],
        opportunity_context=payload.get("opportunity_context"),
        depth=ResearchDepth(payload.get("depth", ResearchDepth.LIGHT)),
    )

    settings = get_settings()
    max_sources = DEPTH_SOURCE_COUNTS[inp.depth]
    queries = _build_queries(inp)

    logger.info(
        "Research agent starting: client=%s domain=%s depth=%s queries=%d",
        inp.client_name, inp.domain, inp.depth, len(queries),
    )

    # ── Web search ────────────────────────────────────────────────────────────
    async with httpx.AsyncClient() as http_client:
        raw_results = await _search_tavily(
            queries,
            max_results_per_query=max(3, max_sources // len(queries)),
            http_client=http_client,
        )

    sources = [
        ResearchSource(
            url=r.get("url", ""),
            title=r.get("title", ""),
            snippet=r.get("content", r.get("snippet", ""))[:300],
            relevance_score=r.get("score", 0.5),
        )
        for r in raw_results[:max_sources]
    ]

    # ── Determine confidence ──────────────────────────────────────────────────
    min_sources = {"light": 2, "medium": 4, "deep": 8}[inp.depth]
    confidence = "high" if len(sources) >= min_sources * 1.5 else \
                 "medium" if len(sources) >= min_sources else "low"
    warnings = []
    if confidence == "low":
        warnings.append(
            f"Limited research available for {inp.client_name} in {inp.domain}. "
            "Consider providing additional context or proceed with available output."
        )

    # ── LLM synthesis ─────────────────────────────────────────────────────────
    search_text = _format_search_results(raw_results)
    openai_client = AsyncOpenAI(api_key=settings.openai_api_key)

    user_prompt = (
        f"Company: {inp.client_name}\n"
        f"Domain: {inp.domain}\n"
        f"Context: {inp.opportunity_context or 'Not provided'}\n\n"
        f"Search Results:\n{search_text}"
    )

    import json
    response = await openai_client.chat.completions.create(
        model=settings.llm_mid_model,
        messages=[
            {"role": "system", "content": SYNTHESIS_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=1500,
        temperature=0.2,
        response_format={"type": "json_object"},
    )

    raw_json = response.choices[0].message.content or "{}"
    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError:
        logger.error("Research synthesis returned invalid JSON: %s", raw_json[:200])
        data = {}

    # ── Build structured output ───────────────────────────────────────────────
    company_data = data.get("company", {})
    industry_data = data.get("industry", {})

    brief = ResearchBrief(
        company=CompanyIntel(
            name=company_data.get("name", inp.client_name),
            description=company_data.get("description"),
            industry=company_data.get("industry", inp.domain),
            size=company_data.get("size"),
            recent_news=company_data.get("recent_news", []),
            key_challenges=company_data.get("key_challenges", []),
            tech_stack_signals=company_data.get("tech_stack_signals", []),
        ),
        industry=IndustryIntel(
            domain=industry_data.get("domain", inp.domain),
            trends=industry_data.get("trends", []),
            challenges=industry_data.get("challenges", []),
            regulatory_notes=industry_data.get("regulatory_notes", []),
        ),
        sources=sources,
        key_insights=data.get("key_insights", []),
        talking_points=data.get("talking_points", []),
        confidence=confidence,
        warnings=warnings,
        depth=inp.depth,
    )

    logger.info(
        "Research complete: client=%s sources=%d confidence=%s insights=%d",
        inp.client_name, len(sources), confidence, len(brief.key_insights),
    )

    return brief.model_dump()
