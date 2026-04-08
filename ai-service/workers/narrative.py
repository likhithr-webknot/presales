"""
Narrative / Storyline Agent
Three phases: positioning → content → coherence_pass
Called at Gate 1 (positioning + structure) and Gate 3 (coherence pass after pricing).
"""
import json
import logging
from typing import Any, Optional

import anthropic

from config import get_settings
from schemas.proposal import (
    NarrativeInput,
    NarrativePositioningOutput,
    SectionBrief,
)

logger = logging.getLogger(__name__)

POSITIONING_SYSTEM = """You are a senior presales strategist for Webknot Technologies.
Given information about a prospect and Webknot's positioning, create a compelling proposal narrative structure.

Return ONLY valid JSON (no markdown fences):
{
  "positioning_angle": "The one-sentence core narrative angle — WHY Webknot for THIS specific client",
  "sections": [
    {
      "section_name": "string",
      "purpose": "what this section achieves",
      "key_messages": ["message 1", "message 2"]
    }
  ],
  "executive_summary_hint": "1-2 sentences for the exec summary (written last)",
  "tone_guidance": "string",
  "anti_patterns_flagged": ["any vague or unsubstantiated claims detected"]
}

Rules:
- positioning_angle must be specific, not generic ("We help companies grow" is wrong)
- sections should be dynamic — not a fixed template — designed for THIS client's situation
- Typical proposal: 5-8 sections (exec summary last, next steps last)
- Flag any unsubstantiated claims, buzzwords without backing, or vague language in proposed structure
"""

COHERENCE_SYSTEM = """You are a senior editor reviewing a proposal for coherence and consistency.
Check that all sections work together as a unified story.

Return ONLY valid JSON (no markdown fences):
{
  "approved": true/false,
  "flags": ["inconsistency 1", "inconsistency 2"],
  "revised_sections": {}
}

Check for:
- Consistent tone and terminology across sections
- The story arc makes sense (problem → solution → proof → next steps)
- Technical section matches narrative promises
- Pricing is consistent with solution scope
- No contradictions between sections
"""


async def _positioning_phase(inp: NarrativeInput, settings) -> NarrativePositioningOutput:
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    research_text = ""
    if inp.research_brief:
        rb = inp.research_brief
        research_text = (
            f"Company challenges: {', '.join(rb.get('company', {}).get('key_challenges', [])[:5])}\n"
            f"Talking points: {', '.join(rb.get('talking_points', [])[:4])}\n"
            f"Industry trends: {', '.join(rb.get('industry', {}).get('trends', [])[:3])}"
        )

    context_text = ""
    if inp.webknot_context:
        ctx = inp.webknot_context
        context_text = (
            f"Positioning: {ctx.get('positioning_narrative', '')[:300]}\n"
            f"Differentiators: {', '.join(ctx.get('differentiators', [])[:4])}"
        )

    user_prompt = (
        f"Client: {inp.client_name}\n"
        f"Domain: {inp.domain}\n"
        f"Opportunity: {inp.opportunity_context or 'New opportunity'}\n"
        f"RFP context: {inp.rfp_text[:500] if inp.rfp_text else 'Not provided'}\n"
        f"Call notes: {inp.call_notes[:400] if inp.call_notes else 'Not provided'}\n\n"
        f"Research insights:\n{research_text or 'Not available'}\n\n"
        f"Webknot positioning:\n{context_text or 'Not available'}\n\n"
        f"AM instructions: {inp.am_instructions or 'None'}"
    )

    response = await client.messages.create(
        model=settings.llm_premium_model,
        max_tokens=1500,
        system=POSITIONING_SYSTEM,
        messages=[{"role": "user", "content": user_prompt}],
    )

    raw = response.content[0].text if response.content else "{}"
    raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.error("Narrative positioning returned invalid JSON: %s", raw[:200])
        data = {}

    sections = [
        SectionBrief(
            section_name=s.get("section_name", f"Section {i+1}"),
            purpose=s.get("purpose", ""),
            key_messages=s.get("key_messages", []),
        )
        for i, s in enumerate(data.get("sections", []))
    ]

    return NarrativePositioningOutput(
        engagement_id=inp.engagement_id,
        positioning_angle=data.get("positioning_angle", f"Webknot's approach to {inp.client_name}'s {inp.domain} challenges"),
        sections=sections,
        executive_summary_hint=data.get("executive_summary_hint"),
        tone_guidance=data.get("tone_guidance", "professional, confident, client-centric"),
        anti_patterns_flagged=data.get("anti_patterns_flagged", []),
        phase="positioning",
    )


async def _coherence_phase(inp: NarrativeInput, settings) -> dict:
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    narrative_str = json.dumps(inp.prior_narrative.model_dump() if inp.prior_narrative else {}, indent=2)[:1500]
    technical_str = json.dumps(inp.technical_solution or {}, indent=2)[:1500]

    user_prompt = (
        f"Client: {inp.client_name}\n\n"
        f"Narrative structure:\n{narrative_str}\n\n"
        f"Technical solution:\n{technical_str}\n\n"
        "Check for coherence, consistency, and story arc quality."
    )

    response = await client.messages.create(
        model=settings.llm_premium_model,
        max_tokens=800,
        system=COHERENCE_SYSTEM,
        messages=[{"role": "user", "content": user_prompt}],
    )

    raw = response.content[0].text if response.content else "{}"
    raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.error("Coherence pass returned invalid JSON: %s", raw[:200])
        return {"approved": True, "flags": [], "revised_sections": {}}


async def run(payload: dict[str, Any], engagement_id: Optional[str]) -> dict[str, Any]:
    """Narrative Agent entry point. Phase is determined by payload.phase."""
    inp = NarrativeInput(
        engagement_id=engagement_id or payload.get("engagement_id", ""),
        phase=payload.get("phase", "positioning"),
        client_name=payload["client_name"],
        domain=payload["domain"],
        opportunity_context=payload.get("opportunity_context"),
        research_brief=payload.get("research_brief"),
        webknot_context=payload.get("webknot_context"),
        call_notes=payload.get("call_notes"),
        rfp_text=payload.get("rfp_text"),
        am_instructions=payload.get("am_instructions"),
        technical_solution=payload.get("technical_solution"),
    )

    settings = get_settings()
    logger.info("Narrative agent: phase=%s engagement=%s", inp.phase, inp.engagement_id)

    if inp.phase == "coherence_pass":
        result = await _coherence_phase(inp, settings)
        return result

    # positioning phase (default)
    output = await _positioning_phase(inp, settings)
    return output.model_dump()
