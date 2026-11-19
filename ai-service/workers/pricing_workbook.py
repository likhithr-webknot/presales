"""Pricing workbook: all figures come from the estimator's inputs; the LLM is not involved."""
from __future__ import annotations

from typing import Any

from documents import EstimateLine, build_estimate_workbook


async def run(payload: dict[str, Any], engagement_id: str | None) -> dict[str, Any]:
    if not payload.get("lines"):
        return {"status": "needs_input", "message": "No estimate lines were provided; pricing is calculated only from an estimator's inputs."}
    wb = build_estimate_workbook(
        str(payload.get("title", "Estimate")),
        [EstimateLine(**ln) for ln in payload.get("lines", [])],
        contingency_pct=float(payload.get("contingency_pct", 0)),
        margin_pct=float(payload.get("margin_pct", 0)),
    )
    return {"status": "draft", "kind": "workbook", "document": wb.model_dump(mode="json")}
