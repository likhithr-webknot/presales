"""
Technical Solution Agent
Designs architecture, tech stack, feature decomposition, and pricing-ready BOM structure.
Uses Claude Sonnet for deep technical reasoning.
"""
import json
import logging
from typing import Any, Optional

import anthropic

from config import get_settings
from schemas.proposal import FeatureItem, TechnicalInput, TechnicalSolutionOutput

logger = logging.getLogger(__name__)

TECHNICAL_SYSTEM = """You are a senior solutions architect at Webknot Technologies.
Design a technical solution for the client based on their requirements.

Return ONLY valid JSON (no markdown fences):
{
  "architecture_overview": "2-3 paragraph technical architecture description",
  "tech_stack": ["technology 1", "technology 2"],
  "integrations": ["integration 1", "integration 2"],
  "feature_breakdown": [
    {
      "module": "Module Name",
      "features": ["feature 1", "feature 2"],
      "tasks": ["task 1", "task 2"],
      "complexity": "low|medium|high"
    }
  ],
  "infrastructure": "Infrastructure approach (cloud, containers, etc.)",
  "security_approach": "Security design considerations",
  "scalability_notes": "How the solution scales",
  "feasibility_flags": ["flag if timeline is aggressive", "flag if scope is large"],
  "phase_suggestions": ["Phase 1: MVP", "Phase 2: scale"]
}

Rules:
- tech_stack: be specific (React, Node.js, PostgreSQL — not just 'web technologies')
- feature_breakdown must be granular enough for estimation (module → features → tasks)
- feasibility_flags: flag aggressively if timeline < 8 weeks for medium complexity
- phase_suggestions: always suggest phasing for large scope
- security_approach: always include auth, data encryption, API security at minimum
"""


async def run(payload: dict[str, Any], engagement_id: Optional[str]) -> dict[str, Any]:
    """Technical Solution Agent entry point."""
    inp = TechnicalInput(
        engagement_id=engagement_id or payload.get("engagement_id", ""),
        client_name=payload["client_name"],
        domain=payload["domain"],
        opportunity_context=payload.get("opportunity_context"),
        rfp_text=payload.get("rfp_text"),
        research_brief=payload.get("research_brief"),
        budget_constraint_inr=payload.get("budget_constraint_inr"),
        timeline_weeks=payload.get("timeline_weeks"),
        am_instructions=payload.get("am_instructions"),
    )

    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    research_text = ""
    if inp.research_brief:
        rb = inp.research_brief
        research_text = (
            f"Tech signals: {', '.join(rb.get('company', {}).get('tech_stack_signals', [])[:5])}\n"
            f"Challenges: {', '.join(rb.get('company', {}).get('key_challenges', [])[:4])}"
        )

    constraints = []
    if inp.budget_constraint_inr:
        constraints.append(f"Budget: ₹{inp.budget_constraint_inr:,.0f}")
    if inp.timeline_weeks:
        constraints.append(f"Timeline: {inp.timeline_weeks} weeks")

    user_prompt = (
        f"Client: {inp.client_name}\n"
        f"Domain: {inp.domain}\n"
        f"Opportunity: {inp.opportunity_context or 'Custom software development'}\n"
        f"RFP/Requirements: {inp.rfp_text[:600] if inp.rfp_text else 'Not provided'}\n"
        f"Constraints: {', '.join(constraints) or 'Not specified'}\n"
        f"Research insights:\n{research_text or 'Not available'}\n"
        f"AM instructions: {inp.am_instructions or 'None'}"
    )

    logger.info("Technical agent: client=%s domain=%s", inp.client_name, inp.domain)

    response = await client.messages.create(
        model=settings.llm_premium_model,
        max_tokens=2000,
        system=TECHNICAL_SYSTEM,
        messages=[{"role": "user", "content": user_prompt}],
    )

    raw = response.content[0].text if response.content else "{}"
    raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.error("Technical agent returned invalid JSON: %s", raw[:200])
        data = {}

    feature_breakdown = [
        FeatureItem(
            module=f.get("module", f"Module {i+1}"),
            features=f.get("features", []),
            tasks=f.get("tasks", []),
            complexity=f.get("complexity", "medium"),
        )
        for i, f in enumerate(data.get("feature_breakdown", []))
    ]

    output = TechnicalSolutionOutput(
        engagement_id=inp.engagement_id,
        architecture_overview=data.get("architecture_overview", "Architecture to be defined."),
        tech_stack=data.get("tech_stack", []),
        integrations=data.get("integrations", []),
        feature_breakdown=feature_breakdown,
        infrastructure=data.get("infrastructure", ""),
        security_approach=data.get("security_approach", ""),
        scalability_notes=data.get("scalability_notes", ""),
        feasibility_flags=data.get("feasibility_flags", []),
        phase_suggestions=data.get("phase_suggestions", []),
    )

    logger.info("Technical solution complete: modules=%d flags=%d",
                len(feature_breakdown), len(output.feasibility_flags))
    return output.model_dump()
