"""
Collateral Type Detector — rule-based fast path + LLM fallback.
Rule-based is free and instant. LLM only fires for ambiguous inputs.
"""
import json
import logging
import re
from typing import Optional

from openai import AsyncOpenAI

from config import get_settings
from schemas.collateral import CollateralDetectRequest, CollateralDetectResponse, CollateralType, DetectionConfidence

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a presales assistant. Classify the user's request into exactly one collateral type.
Return ONLY valid JSON: { "collateral_type": "<TYPE>" }
Valid types: FIRST_MEETING_DECK, POST_DISCOVERY_DECK, TECHNICAL_PROPOSAL, PROPOSAL_DEFENSE_DECK, STATEMENT_OF_WORK, COMMERCIAL_ESTIMATION, CASE_STUDY_DOCUMENT, MARKETING_CONTENT
If the request is ambiguous or unclear, default to FIRST_MEETING_DECK.
"""


def _detect_by_rules(message: str) -> Optional[CollateralType]:
    """
    Rule-based fast path. No LLM cost for obvious cases.
    Returns None if no rule matches — triggers LLM fallback.
    """
    m = message.lower()

    if re.search(r"\bsow\b|statement of work", m):
        return CollateralType.STATEMENT_OF_WORK

    if re.search(r"defense|defend|proposal defense", m):
        return CollateralType.PROPOSAL_DEFENSE_DECK

    if re.search(r"post.?discovery|after.?(first|initial|second) meeting|follow.?up deck", m):
        return CollateralType.POST_DISCOVERY_DECK

    if re.search(r"\bproposal\b|\brfp\b", m):
        return CollateralType.TECHNICAL_PROPOSAL

    if re.search(r"first meeting|introductory|intro meeting|initial meeting", m):
        return CollateralType.FIRST_MEETING_DECK

    if re.search(r"case study|case-study", m):
        return CollateralType.CASE_STUDY_DOCUMENT

    if re.search(r"estimation|pricing|bom|bill of material", m):
        return CollateralType.COMMERCIAL_ESTIMATION

    if re.search(r"linkedin|blog|one.?pager|thought leadership|capability deck", m):
        return CollateralType.MARKETING_CONTENT

    return None


async def detect(request: CollateralDetectRequest) -> CollateralDetectResponse:
    """Detect collateral type: try rules first, LLM fallback if ambiguous."""

    # Fast path — rule-based
    rule_result = _detect_by_rules(request.message)
    if rule_result is not None:
        logger.info("Collateral detected by rule: %s", rule_result)
        return CollateralDetectResponse(
            collateral_type=rule_result,
            confidence=DetectionConfidence.RULE,
        )

    # LLM fallback
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    response = await client.chat.completions.create(
        model=settings.llm_cheap_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": request.message},
        ],
        max_tokens=64,
        temperature=0,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content or "{}"
    try:
        data = json.loads(raw)
        detected_str = data.get("collateral_type", "FIRST_MEETING_DECK")
        collateral_type = CollateralType(detected_str)
    except (json.JSONDecodeError, ValueError):
        logger.warning("LLM returned invalid collateral type, defaulting to FIRST_MEETING_DECK. raw=%s", raw[:100])
        collateral_type = CollateralType.FIRST_MEETING_DECK

    logger.info("Collateral detected by LLM: %s", collateral_type)
    return CollateralDetectResponse(
        collateral_type=collateral_type,
        confidence=DetectionConfidence.LLM,
    )
