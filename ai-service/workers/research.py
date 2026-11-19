"""
Secondary research: fetches the supplied public URLs and returns them as citable web evidence
(URL + retrieval time). Depth scales how many pages are read. It does not guess URLs and never
adds facts from model memory; a search provider can be plugged in via research.web.SearchProvider.
"""
from __future__ import annotations

from typing import Any

import httpx

from grounding import EvidenceKind, EvidenceStore
from research.web import collect_web_evidence
from workers.collateral_generator import build_store

DEPTH_LIMIT = {"light": 2, "medium": 5, "deep": 10}


async def run(payload: dict[str, Any], engagement_id: str | None) -> dict[str, Any]:
    limit = DEPTH_LIMIT.get(str(payload.get("depth", "light")), 2)
    urls = list(dict.fromkeys(payload.get("urls") or []))[:limit]

    web = EvidenceStore()
    failed: list[str] = []
    if urls:
        async with httpx.AsyncClient(timeout=15) as http:
            failed = await collect_web_evidence(urls, web, http)

    own = build_store(payload)
    if len(web) == 0 and len(own) == 0:
        return {
            "status": "needs_input", "sources": [], "failed_urls": failed,
            "message": "No public URLs or source documents were provided for research. Add the client's website or filings.",
        }
    return {
        "status": "ready", "failed_urls": failed,
        "sources": own.to_sources() + web.to_sources({EvidenceKind.WEB}),
    }
