"""
Webknot Context Manager
Retrieves Webknot's internal knowledge (capabilities, projects, case studies)
via the KnowledgeBase adapter, then generates a tailored positioning narrative.
Today: KB adapter returns stubs. Tomorrow: pgvector semantic search.
"""
import json
import logging
from typing import Any, Optional

from openai import AsyncOpenAI

from config import get_settings
from schemas.agents import (
    ContextInput,
    ResearchBrief,
    WebknotCapability,
    WebknotContextOutput,
    WebknotProject,
)

logger = logging.getLogger(__name__)

POSITIONING_SYSTEM_PROMPT = """You are a presales strategist for Webknot Technologies.
Given information about a prospect and Webknot's capabilities/projects, generate a positioning narrative.

Return ONLY valid JSON (no markdown fences) matching this exact schema:
{
  "positioning_narrative": "2-3 paragraph narrative on how Webknot should position itself for this prospect",
  "differentiators": ["specific differentiator relevant to this prospect", ...],
  "talking_points": ["actionable talking point", ...]
}

Rules:
- positioning_narrative must be specific to the prospect, not generic
- Reference actual capabilities and projects where relevant
- differentiators should be specific to WHY Webknot is the right fit for THIS client
- If KB data is empty, craft positioning from first principles using the research brief
"""

# ── Stub KB data — replaced in Sprint 9 with real pgvector KB ─────────────────

STUB_CAPABILITIES = [
    WebknotCapability(
        name="Custom Software Development",
        description="Full-stack web and mobile application development",
        relevant_domains=["fintech", "retail", "healthcare", "logistics", "edtech"],
    ),
    WebknotCapability(
        name="AI/ML Integration",
        description="LLM integration, recommendation systems, NLP pipelines",
        relevant_domains=["fintech", "retail", "healthcare", "media"],
    ),
    WebknotCapability(
        name="Cloud Architecture & DevOps",
        description="AWS/GCP/Azure architecture, CI/CD, containerisation",
        relevant_domains=["all"],
    ),
    WebknotCapability(
        name="Data Engineering & Analytics",
        description="Data pipelines, dashboards, real-time analytics",
        relevant_domains=["fintech", "logistics", "retail", "media"],
    ),
    WebknotCapability(
        name="Product Discovery & Design",
        description="UX research, prototyping, product strategy",
        relevant_domains=["all"],
    ),
]

STUB_PROJECTS: list[WebknotProject] = []  # Empty until KB is populated — handled gracefully


def _get_stub_kb_data(domain: str) -> tuple[list[WebknotCapability], list[WebknotProject]]:
    """
    Stub KB retrieval — returns capabilities filtered by domain relevance.
    Replace with real pgvector search in Sprint 9.
    """
    domain_lower = domain.lower()
    relevant = [
        cap for cap in STUB_CAPABILITIES
        if "all" in cap.relevant_domains
        or any(d in domain_lower for d in cap.relevant_domains)
    ]
    return relevant or STUB_CAPABILITIES[:3], STUB_PROJECTS


async def run(payload: dict[str, Any], engagement_id: Optional[str]) -> dict[str, Any]:
    """
    Webknot Context Manager entry point.
    Called by dispatcher.py with the job payload from Node.
    """
    inp = ContextInput(
        engagement_id=engagement_id or payload.get("engagement_id", ""),
        client_name=payload["client_name"],
        domain=payload["domain"],
        opportunity_context=payload.get("opportunity_context"),
        research_brief=ResearchBrief(**payload["research_brief"]) if payload.get("research_brief") else None,
    )

    settings = get_settings()

    logger.info(
        "Context manager starting: client=%s domain=%s",
        inp.client_name, inp.domain,
    )

    # ── KB retrieval (stub for now) ────────────────────────────────────────────
    capabilities, projects = _get_stub_kb_data(inp.domain)
    warnings: list[str] = []

    if not projects:
        warnings.append(
            "No matching Webknot projects found in Knowledge Base. "
            "Positioning based on general capabilities. "
            "Add relevant case studies to the KB for stronger positioning."
        )
        logger.info("KB returned no projects — using general positioning")

    # ── Build context for LLM ──────────────────────────────────────────────────
    capabilities_text = "\n".join(
        f"- {c.name}: {c.description}" for c in capabilities
    )
    projects_text = "\n".join(
        f"- {p.name} ({p.domain}): {p.summary}" for p in projects
    ) if projects else "No specific project history available yet."

    research_text = ""
    if inp.research_brief:
        rb = inp.research_brief
        research_text = (
            f"Company insights: {', '.join(rb.key_insights[:5])}\n"
            f"Key challenges: {', '.join(rb.company.key_challenges[:5])}\n"
            f"Talking points identified: {', '.join(rb.talking_points[:3])}"
        )

    user_prompt = (
        f"Prospect: {inp.client_name}\n"
        f"Domain: {inp.domain}\n"
        f"Opportunity: {inp.opportunity_context or 'First meeting — general introduction'}\n\n"
        f"Webknot Capabilities:\n{capabilities_text}\n\n"
        f"Webknot Relevant Projects:\n{projects_text}\n\n"
        f"Research Insights:\n{research_text or 'Not yet available'}"
    )

    # ── LLM positioning generation ────────────────────────────────────────────
    openai_client = AsyncOpenAI(api_key=settings.openai_api_key)

    response = await openai_client.chat.completions.create(
        model=settings.llm_mid_model,
        messages=[
            {"role": "system", "content": POSITIONING_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=1000,
        temperature=0.3,
        response_format={"type": "json_object"},
    )

    raw_json = response.choices[0].message.content or "{}"
    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError:
        logger.error("Context manager LLM returned invalid JSON: %s", raw_json[:200])
        data = {}

    output = WebknotContextOutput(
        positioning_narrative=data.get(
            "positioning_narrative",
            f"Webknot Technologies is well-positioned to support {inp.client_name} "
            f"in their {inp.domain} initiatives through our expertise in custom software development and AI integration.",
        ),
        relevant_capabilities=capabilities,
        relevant_projects=projects,
        differentiators=data.get("differentiators", []),
        warnings=warnings,
    )

    logger.info(
        "Context manager complete: client=%s capabilities=%d projects=%d warnings=%d",
        inp.client_name, len(capabilities), len(projects), len(warnings),
    )

    return output.model_dump()
