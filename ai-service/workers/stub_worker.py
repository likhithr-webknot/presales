"""
Stub worker — used for all job types not yet implemented in Python.
Logs receipt, returns an empty output, and lets the dispatcher send the callback.
Remove from dispatcher.py as real workers are built sprint by sprint.
"""
import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)


async def run(payload: dict[str, Any], engagement_id: str | None) -> dict[str, Any]:
    """
    Stub: acknowledge the job and return empty output.
    Real workers will replace this with actual LLM calls.
    """
    logger.info(
        "[STUB] Received job for engagement=%s payload_keys=%s",
        engagement_id,
        list(payload.keys()),
    )

    # Simulate minimal async work so the event loop stays healthy
    await asyncio.sleep(0.1)

    return {
        "stub": True,
        "message": "Stub worker — replace with real implementation in the relevant sprint",
        "engagement_id": engagement_id,
    }
