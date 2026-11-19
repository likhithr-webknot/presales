"""Packaging: assembles the final collateral from every source gathered by earlier steps."""
from __future__ import annotations

from typing import Any

from workers.collateral_generator import run as generate


async def run(payload: dict[str, Any], engagement_id: str | None) -> dict[str, Any]:
    return await generate(payload, engagement_id)
