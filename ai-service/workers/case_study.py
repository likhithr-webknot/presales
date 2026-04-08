"""
Case Study Maker
Retrieves relevant Webknot case studies from KB (stub today),
then writes tailored versions framed specifically for the current prospect.
"""
import json
import logging
from typing import Any, Optional

from openai import AsyncOpenAI

from config import get_settings
from schemas.case_study import CaseStudyInput, CaseStudyOutput

logger = logging.getLogger(__name__)

WRITER_SYSTEM = """You are a proposal writer for Webknot Technologies.
Given a prospect's context and a Webknot project, write a tailored case study snippet.

Return ONLY valid JSON (no markdown fences):
{
  "title": "Case study headline (specific, no 'How Webknot helped X')",
  "challenge": "2-3 sentences describing the client challenge",
  "solution": "2-3 sentences on what was built",
  "outcomes": ["measurable outcome 1", "measurable outcome 2"],
  "tailored_angle": "1 sentence on why this is relevant to the current prospect"
}

Rules:
- outcomes must be specific and measurable where possible
- tailored_angle must reference the prospect's domain or challenge explicitly
- Never invent metrics — use 'significantly improved' if no numbers available
"""

# ── Stub KB case studies — replaced by real KB in Sprint 9 ──────────────────

STUB_CASE_STUDIES = [
    {
        "id": "cs-001",
        "title": "E-commerce Platform for Fashion Retailer",
        "client_industry": "retail",
        "challenge": "Manual inventory management causing stockouts and lost sales",
        "solution": "Built a real-time inventory management system with ML-based demand forecasting",
        "outcomes": ["30% reduction in stockouts", "2x faster order processing", "₹2Cr revenue uplift in first quarter"],
        "tech_stack": ["React", "Node.js", "PostgreSQL", "Python ML pipeline"],
        "is_anonymized": True,
        "domains": ["retail", "ecommerce", "fashion"],
    },
    {
        "id": "cs-002",
        "title": "Lending Platform for NBFC",
        "client_industry": "fintech",
        "challenge": "Paper-based loan application process taking 15 days to process",
        "solution": "Digital loan origination system with automated credit scoring and e-KYC",
        "outcomes": ["Loan processing time reduced to 4 hours", "60% reduction in manual effort", "NPA reduced by 12%"],
        "tech_stack": ["React Native", "Node.js", "PostgreSQL", "AWS", "ML credit model"],
        "is_anonymized": False,
        "domains": ["fintech", "banking", "lending", "nbfc"],
    },
    {
        "id": "cs-003",
        "title": "Patient Engagement Platform for Hospital Chain",
        "client_industry": "healthcare",
        "challenge": "Fragmented patient data across 12 hospitals and poor appointment adherence",
        "solution": "Unified patient portal with appointment scheduling, telemedicine, and health records",
        "outcomes": ["Appointment no-shows reduced by 40%", "Patient satisfaction score up 25 points", "30% increase in telemedicine adoption"],
        "tech_stack": ["React", "Node.js", "PostgreSQL", "FHIR API integration", "AWS"],
        "is_anonymized": True,
        "domains": ["healthcare", "hospital", "medtech", "health"],
    },
    {
        "id": "cs-004",
        "title": "Supply Chain Visibility Platform for Logistics Company",
        "client_industry": "logistics",
        "challenge": "Zero real-time visibility into shipment status causing customer escalations",
        "solution": "Real-time tracking platform with IoT integration and automated customer notifications",
        "outcomes": ["Customer escalations down 65%", "On-time delivery improved by 18%", "3x faster exception resolution"],
        "tech_stack": ["React", "Node.js", "PostgreSQL", "Redis", "IoT integration", "GCP"],
        "is_anonymized": False,
        "domains": ["logistics", "supply chain", "shipping", "transport"],
    },
]


def _find_relevant_case_studies(domain: str, max_results: int = 3) -> list[dict]:
    """
    Stub: find case studies relevant to the domain.
    Replace with pgvector semantic search in Sprint 9.
    """
    domain_lower = domain.lower()
    scored = []
    for cs in STUB_CASE_STUDIES:
        score = sum(1 for d in cs["domains"] if d in domain_lower)
        if score == 0:
            score = 0.1  # include with low score as fallback
        scored.append((score, cs))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [cs for _, cs in scored[:max_results]]


async def _write_tailored_case_study(
    cs: dict,
    inp: CaseStudyInput,
    settings,
) -> CaseStudyOutput:
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    research_context = ""
    if inp.research_brief:
        challenges = inp.research_brief.get("company", {}).get("key_challenges", [])[:3]
        research_context = f"Prospect challenges: {', '.join(challenges)}"

    user_prompt = (
        f"Prospect: {inp.client_name} (domain: {inp.domain})\n"
        f"Opportunity: {inp.opportunity_context or 'Not specified'}\n"
        f"{research_context}\n"
        f"Framing guidance: {inp.framing_guidance or 'Highlight technical excellence and measurable outcomes'}\n\n"
        f"Case study to tailor:\n"
        f"Title: {cs['title']}\n"
        f"Challenge: {cs['challenge']}\n"
        f"Solution: {cs['solution']}\n"
        f"Outcomes: {', '.join(cs['outcomes'])}"
    )

    response = await client.chat.completions.create(
        model=settings.llm_mid_model,
        messages=[
            {"role": "system", "content": WRITER_SYSTEM},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=600,
        temperature=0.3,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content or "{}"
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.error("Case study writer returned invalid JSON: %s", raw[:200])
        data = {}

    return CaseStudyOutput(
        title=data.get("title", cs["title"]),
        client_industry=cs["client_industry"],
        challenge=data.get("challenge", cs["challenge"]),
        solution=data.get("solution", cs["solution"]),
        outcomes=data.get("outcomes", cs["outcomes"]),
        tech_stack=cs.get("tech_stack", []),
        relevance_score=min(1.0, 0.5 + (0.1 * len([d for d in cs.get("domains", []) if d in domain.lower()]))),
        tailored_angle=data.get("tailored_angle", "Relevant to your domain and requirements."),
        is_anonymized=cs.get("is_anonymized", True),
    )


async def run(payload: dict[str, Any], engagement_id: Optional[str]) -> dict[str, Any]:
    """Case Study Maker entry point."""
    inp = CaseStudyInput(
        engagement_id=engagement_id or payload.get("engagement_id", ""),
        client_name=payload["client_name"],
        domain=payload["domain"],
        opportunity_context=payload.get("opportunity_context"),
        research_brief=payload.get("research_brief"),
        framing_guidance=payload.get("framing_guidance"),
    )

    settings = get_settings()
    relevant = _find_relevant_case_studies(inp.domain, max_results=3)

    warnings: list[str] = []
    if not relevant:
        warnings.append("No relevant case studies found in Knowledge Base. Add case studies to improve proposals.")
        logger.warning("No relevant case studies for domain=%s", inp.domain)
        return {"case_studies": [], "warnings": warnings}

    logger.info("Case study maker: domain=%s matched=%d", inp.domain, len(relevant))

    # Write tailored versions in parallel
    import asyncio
    tailored = await asyncio.gather(*[
        _write_tailored_case_study(cs, inp, settings)
        for cs in relevant
    ])

    # Sort by relevance
    tailored_sorted = sorted(tailored, key=lambda x: x.relevance_score, reverse=True)

    logger.info("Case study maker complete: %d tailored case studies produced", len(tailored_sorted))
    return {
        "case_studies": [cs.model_dump() for cs in tailored_sorted],
        "warnings": warnings,
    }
