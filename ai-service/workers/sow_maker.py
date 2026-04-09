"""
SOW Maker
Generates a Statement of Work section by section.
After each section: fires a callback so Node sends a WebSocket event to the frontend.
AM confirms or requests revision before the next section is generated.
Uses Claude Sonnet for precision language.
"""
import json
import logging
from typing import Any, Optional

from openai import AsyncOpenAI

from config import get_settings

logger = logging.getLogger(__name__)

# Banned vague language — auto-revised if found
BANNED_WORDS = [
    "ensure", "make sure", "all-encompassing", "seamless", "robust",
    "world-class", "best-in-class", "cutting-edge", "state-of-the-art",
    "innovative", "synergy", "leverage", "utilize",
]

SECTION_ORDER = [
    "project_overview",
    "in_scope",
    "out_of_scope",
    "assumptions",
    "dependencies",
    "deliverables",
    "milestones",
    "slas",
    "payment_milestones",
    "change_management",
    "legal_clauses",
]

SECTION_PROMPTS = {
    "project_overview": "Write a precise project overview section. Include: project name, client name, brief description of what will be built, and the business objective. 2-3 paragraphs.",
    "in_scope": "Write a detailed In Scope section. List all features, modules, integrations, and work items that ARE included. Use numbered bullet points. Be specific.",
    "out_of_scope": "Write an Out of Scope section. List everything that is explicitly NOT included. Be precise to prevent scope creep. Use numbered bullet points.",
    "assumptions": "Write an Assumptions section. List all assumptions the project is based on (client responsibilities, third-party availability, infrastructure, etc.). Numbered list.",
    "dependencies": "Write a Dependencies section. List external dependencies the project relies on (APIs, third-party systems, client teams, hardware). Numbered list.",
    "deliverables": "Write a Deliverables section. List all tangible outputs with acceptance criteria. Include: source code, documentation, deployment scripts, test reports. Numbered list with acceptance criteria per item.",
    "milestones": "Write a Project Milestones section. List major milestones with estimated completion dates (use relative dates: Week 4, Week 8, etc.). Include: milestone name, description, deliverable, acceptance criteria.",
    "slas": "Write an SLA section. Define: response times for bug fixes by severity (P0/P1/P2/P3), uptime SLA (if applicable), support window, escalation path. Use a table format where possible.",
    "payment_milestones": "Write a Payment Milestones section. Define payment schedule tied to project milestones. Include: milestone name, percentage of total, trigger condition.",
    "change_management": "Write a Change Management section. Define: how scope changes are requested, approval process, impact assessment, change order process.",
    "legal_clauses": "Write standard legal clauses: IP ownership, confidentiality, limitation of liability, governing law (Indian law), dispute resolution. Keep it clear and concise.",
}

SOW_SYSTEM = """You are a technical writer creating a Statement of Work for Webknot Technologies.
Write precise, legally sound SOW sections. No vague language. No fluff.

Rules:
- Be specific and measurable — avoid "ensure", "seamless", "robust", "world-class"
- Use numbered lists for scope items, deliverables, assumptions
- Every deliverable must have acceptance criteria
- Legal language must be clear and unambiguous
- Write in third person: "Webknot shall...", "Client shall..."

Return the section content as a plain string (no JSON wrapper needed for section text).
"""

BANNED_CHECK_SYSTEM = """You are an editor checking SOW text for vague language.
If the text contains any of these banned words or phrases, rewrite them with precise alternatives:
banned: ensure, make sure, seamless, robust, world-class, best-in-class, cutting-edge, state-of-the-art, innovative, synergy, leverage, utilize

Return ONLY the revised text. If no banned words found, return the original text unchanged.
"""


async def _generate_section(
    section_key: str,
    context: dict,
    settings,
) -> str:
    """Generate one SOW section using Claude Sonnet."""
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    section_instruction = SECTION_PROMPTS.get(section_key, f"Write the {section_key} section.")

    project_context = (
        f"Project: {context.get('client_name', 'Client')} — {context.get('opportunity_context', 'Custom software development')}\n"
        f"Domain: {context.get('domain', 'Technology')}\n"
        f"Tech stack: {', '.join(context.get('tech_stack', []))}\n"
        f"Timeline: {context.get('timeline_weeks', 'TBD')} weeks\n"
        f"Budget: {context.get('budget_inr', 'TBD')}\n"
    )

    if context.get("approved_proposal"):
        proposal_str = json.dumps(context["approved_proposal"], indent=2)[:1000]
        project_context += f"\nApproved proposal context:\n{proposal_str}"

    response = await client.messages.create(
        model=settings.llm_premium_model,
        max_tokens=800,
        system=SOW_SYSTEM,
        messages=[{
            "role": "user",
            "content": f"{project_context}\n\nInstruction: {section_instruction}",
        }],
    )

    return response.content[0].text if response.content else ""


async def _check_and_revise(text: str, settings) -> tuple[str, bool]:
    """
    Check for banned words. Revise if found.
    Returns (final_text, was_revised).
    """
    if not any(word in text.lower() for word in BANNED_WORDS):
        return text, False

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    response = await client.chat.completions.create(
        model=settings.llm_premium_model,
        max_tokens=800,
        messages=[
            {"role": "system", "content": BANNED_CHECK_SYSTEM},
            {"role": "user", "content": text}
        ],
        response_format={"type": "json_object"},
    )

    revised = response.content[0].text if response.content else text
    return revised, True


async def run(payload: dict[str, Any], engagement_id: Optional[str]) -> dict[str, Any]:
    """
    SOW Maker entry point.
    Generates all sections, applies language validation, returns structured output.

    Note: Section-by-section confirmation loop (AM confirms each section via WebSocket)
    is handled by the Node orchestrator calling this worker per-section via the
    POST /api/engagements/:id/sow/sections/:section endpoint.
    The full generation mode (payload.mode='full') generates all sections at once
    for preview. Production flow uses mode='section' with section_key specified.
    """
    settings = get_settings()
    mode = payload.get("mode", "full")
    context = {
        "client_name":        payload.get("client_name", "Client"),
        "domain":             payload.get("domain", "Technology"),
        "opportunity_context": payload.get("opportunity_context"),
        "tech_stack":         payload.get("tech_stack", []),
        "timeline_weeks":     payload.get("timeline_weeks"),
        "budget_inr":         payload.get("budget_inr"),
        "approved_proposal":  payload.get("approved_proposal"),
    }

    if mode == "section":
        # Single section mode — used in section-by-section walkthrough
        section_key = payload.get("section_key", "project_overview")
        am_feedback = payload.get("am_feedback")  # for revisions

        if am_feedback:
            # AM requested revision — regenerate with feedback
            prev_content = payload.get("previous_content", "")
            client = AsyncOpenAI(api_key=settings.openai_api_key)
            response = await client.messages.create(
                model=settings.llm_premium_model,
                max_tokens=800,
                system=SOW_SYSTEM,
                messages=[
                    {"role": "assistant", "content": prev_content},
                    {"role": "user", "content": f"Please revise this section based on feedback: {am_feedback}"},
                ],
            )
            content = response.content[0].text if response.content else prev_content
        else:
            content = await _generate_section(section_key, context, settings)

        content, was_revised = await _check_and_revise(content, settings)

        logger.info("SOW section generated: %s revised=%s", section_key, was_revised)
        return {
            "section_key": section_key,
            "content": content,
            "was_language_revised": was_revised,
            "section_index": SECTION_ORDER.index(section_key) if section_key in SECTION_ORDER else 0,
            "total_sections": len(SECTION_ORDER),
            "is_last": section_key == SECTION_ORDER[-1],
        }

    # Full mode — generate all sections sequentially (used for initial preview / packaging)
    results = {}
    revision_count = 0

    for section_key in SECTION_ORDER:
        content = await _generate_section(section_key, context, settings)
        content, was_revised = await _check_and_revise(content, settings)
        if was_revised:
            revision_count += 1
        results[section_key] = content

    logger.info("SOW full generation complete: %d sections, %d language revisions",
                len(results), revision_count)

    return {
        "sections": results,
        "section_order": SECTION_ORDER,
        "total_sections": len(SECTION_ORDER),
        "language_revisions": revision_count,
        "client_name": context["client_name"],
    }
