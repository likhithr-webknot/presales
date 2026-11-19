"""
Context Manager: normalises the engagement's own evidence (uploads, approved KB entries,
meeting transcripts) into one deduplicated source list for later steps. No LLM, so it cannot
add or alter facts.
"""
from __future__ import annotations

from typing import Any

from workers.collateral_generator import build_store


async def run(payload: dict[str, Any], engagement_id: str | None) -> dict[str, Any]:
    store = build_store(payload)
    if len(store) == 0:
        return {"status": "needs_input", "message": "No uploaded documents or approved knowledge-base entries were found for this engagement.", "sources": []}
    return {"status": "ready", "sources": store.to_sources(), "passage_count": len(store)}
