"""
Generates grounded collateral (decks, proposals, SOW) from supplied sources.
Output is the canonical JSON model; editors and exporters consume that.
"""
from __future__ import annotations

from typing import Any

import httpx

from documents import build_deck, build_doc
from grounding import EvidenceKind, EvidenceStore, InsufficientEvidence, generate_grounded_sections
from llm import AnthropicClient
from research.web import collect_web_evidence

DECK_OUTLINE = {
    "client_context": "Who the client is and what they are trying to achieve",
    "challenges": "Challenges and requirements stated in the sources",
    "approach": "Proposed approach, only where the sources describe it",
    "evidence": "Relevant past work or case studies present in the sources",
}
PROPOSAL_OUTLINE = {
    "understanding": "Understanding of the client's needs",
    "scope": "Scope of work stated in the sources",
    "requirements": "Functional and non-functional requirements",
    "assumptions": "Assumptions and constraints stated in the sources",
    "delivery": "Delivery approach and timeline, only where sources define them",
}
DECK_TYPES = {"FIRST_MEETING_DECK", "POST_DISCOVERY_DECK", "PROPOSAL_DEFENSE_DECK", "MARKETING_CONTENT"}


def build_store(payload: dict[str, Any]) -> EvidenceStore:
    """Evidence = the job's own sources plus every source emitted by earlier pipeline steps."""
    store = EvidenceStore()
    pools = [payload.get("sources", [])] + [
        (p.get("output") or {}).get("sources", []) for p in payload.get("previous", [])
    ]
    for pool in pools:
        for s in pool:
            if not str(s.get("text", "")).strip():
                continue
            store.add_document(
                kind=EvidenceKind(s.get("kind", "upload")), title=s.get("title", "Untitled"), text=s["text"],
                uri=s.get("uri"), verified_by_human=bool(s.get("verified", False)),
            )
    return store


async def run(payload: dict[str, Any], engagement_id: str | None, *, llm=None) -> dict[str, Any]:
    collateral_type = str(payload.get("collateral_type", "FIRST_MEETING_DECK"))
    store = build_store(payload)
    failed_urls: list[str] = []
    if payload.get("urls"):
        async with httpx.AsyncClient(timeout=15) as http:
            failed_urls = await collect_web_evidence(list(payload["urls"]), store, http)

    is_deck = collateral_type in DECK_TYPES
    outline = DECK_OUTLINE if is_deck else PROPOSAL_OUTLINE
    try:
        result = await generate_grounded_sections(
            llm or AnthropicClient(), brief=str(payload.get("brief", "")), outline=outline, store=store,
            guidance=[str(g) for g in payload.get("lessons", [])][:10],
        )
    except InsufficientEvidence as exc:
        return {"status": "needs_input", "message": str(exc), "failed_urls": failed_urls}

    title = str(payload.get("title") or collateral_type.replace("_", " ").title())
    doc = build_deck(title, result, store) if is_deck else build_doc(title, result, store)
    return {
        "status": "draft",
        "kind": "deck" if is_deck else "doc",
        "document": doc.model_dump(mode="json"),
        "open_items": result.gaps,
        "rejected_claims": len(result.rejected),
        # Kept so the platform can learn from what the verifier stopped (claim text + why).
        "rejected_details": [
            {"section_text": v.claim.text[:300], "reasons": v.reasons} for v in result.rejected[:20]
        ],
        "failed_urls": failed_urls,
    }
