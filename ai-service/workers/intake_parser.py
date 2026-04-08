"""
Intake Parser Worker — real GPT-4o-mini call.
Extracts structured fields from an AM's freeform message.
"""
import json
import logging
from typing import Optional

from openai import AsyncOpenAI

from config import get_settings
from schemas.collateral import CollateralType
from schemas.intake import ContactDetails, IntakeParseRequest, IntakeParseResponse, ParsedFields

logger = logging.getLogger(__name__)

# Required fields per collateral type — determines which missing fields to surface
REQUIRED_FIELDS: dict[CollateralType, list[str]] = {
    CollateralType.FIRST_MEETING_DECK:    ["client_name", "domain"],
    CollateralType.POST_DISCOVERY_DECK:   ["client_name", "domain", "opportunity_context"],
    CollateralType.TECHNICAL_PROPOSAL:    ["client_name", "domain", "opportunity_context"],
    CollateralType.PROPOSAL_DEFENSE_DECK: ["client_name", "domain"],
    CollateralType.STATEMENT_OF_WORK:     ["client_name", "domain", "opportunity_context"],
    CollateralType.COMMERCIAL_ESTIMATION: ["client_name", "domain", "opportunity_context"],
    CollateralType.CASE_STUDY_DOCUMENT:   ["client_name", "domain"],
    CollateralType.MARKETING_CONTENT:     ["domain"],
}

FIELD_LABELS: dict[str, str] = {
    "client_name":         "the client name",
    "domain":              "the industry or domain",
    "opportunity_context": "what they are looking to build or solve",
}

SYSTEM_PROMPT = """You are a presales assistant helping an Account Manager prepare sales collateral.
Extract structured information from their message. Return ONLY valid JSON, no markdown fences.

Schema:
{
  "client_name": "string or null",
  "domain": "industry/sector string or null",
  "opportunity_context": "what they want to build/solve or null",
  "contact_details": { "name": "string", "email": "string", "role": "string" } or null,
  "collateral_type": "FIRST_MEETING_DECK|POST_DISCOVERY_DECK|TECHNICAL_PROPOSAL|PROPOSAL_DEFENSE_DECK|STATEMENT_OF_WORK|COMMERCIAL_ESTIMATION|CASE_STUDY_DOCUMENT|MARKETING_CONTENT or null",
  "stage": 1-5 or null
}

Rules:
- Use null for any field not explicitly mentioned.
- Do NOT invent information.
- domain = industry/sector (e.g. "retail", "fintech", "healthcare"), not company domain.
"""


def _build_follow_up(missing: list[str], client_name: Optional[str]) -> Optional[str]:
    if not missing:
        return None
    client = f"for {client_name}" if client_name else ""
    labels = [FIELD_LABELS.get(f, f) for f in missing]
    if len(labels) == 1:
        return f"Could you share {labels[0]}?"
    last = labels.pop()
    return f"Could you share {', '.join(labels)} and {last}?"


async def parse(request: IntakeParseRequest) -> IntakeParseResponse:
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Provide existing context so LLM knows what's already been captured
    if request.existing_context:
        existing_json = request.existing_context.model_dump(exclude_none=True)
        if existing_json:
            messages.append({
                "role": "assistant",
                "content": f"Previously extracted context: {json.dumps(existing_json)}",
            })

    messages.append({"role": "user", "content": request.message})

    response = await client.chat.completions.create(
        model=settings.llm_cheap_model,
        messages=messages,
        max_tokens=512,
        temperature=0.1,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content or "{}"
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse LLM JSON for intake: %s | raw=%s", exc, raw[:200])
        data = {}

    # Map snake_case from LLM output (LLM follows our schema)
    contact_raw = data.get("contact_details")
    contact = ContactDetails(**contact_raw) if isinstance(contact_raw, dict) else None

    llm_type = data.get("collateral_type")
    collateral_type = None
    if llm_type and llm_type in CollateralType.__members__:
        collateral_type = CollateralType(llm_type)

    llm_parsed = ParsedFields(
        client_name=data.get("client_name"),
        domain=data.get("domain"),
        opportunity_context=data.get("opportunity_context"),
        contact_details=contact,
        collateral_type=collateral_type,
        stage=data.get("stage"),
    )

    # Merge: existing context wins for already-set fields
    existing = request.existing_context or ParsedFields()
    merged = ParsedFields(
        client_name=existing.client_name or llm_parsed.client_name,
        domain=existing.domain or llm_parsed.domain,
        opportunity_context=existing.opportunity_context or llm_parsed.opportunity_context,
        contact_details=existing.contact_details or llm_parsed.contact_details,
        collateral_type=existing.collateral_type or llm_parsed.collateral_type,
        stage=existing.stage or llm_parsed.stage,
    )

    # Determine which required fields are still missing
    effective_type = merged.collateral_type or CollateralType.FIRST_MEETING_DECK
    required = REQUIRED_FIELDS.get(effective_type, [])
    missing = [f for f in required if not getattr(merged, f, None)]

    follow_up = _build_follow_up(missing, merged.client_name)

    logger.info(
        "Intake parsed: client=%s type=%s missing=%s",
        merged.client_name, effective_type, missing,
    )

    return IntakeParseResponse(
        parsed=merged,
        missing_fields=missing,
        follow_up_question=follow_up,
        raw_message=request.message,
    )
