"""
Diff Generation Worker
Produces a plain-language summary of what changed between two engagement versions.
Uses GPT-4o-mini (cheap) — this is a utility task, not a creative one.
"""
import json
import logging
from typing import Any, Optional

from openai import AsyncOpenAI

from config import get_settings

logger = logging.getLogger(__name__)

DIFF_SYSTEM = """You are a technical writer comparing two versions of a presales proposal.
Given two JSON artifacts, describe what changed in plain English.

Return ONLY valid JSON (no markdown fences):
{
  "summary": "1-2 sentence overall summary of what changed",
  "changed_sections": ["section name 1", "section name 2"],
  "additions": ["brief description of what was added"],
  "removals": ["brief description of what was removed"],
  "modifications": ["brief description of what was modified"]
}

Rules:
- summary must be human-readable, not technical
- changed_sections: list only sections that materially changed
- Be concise — this is read by the AM in a timeline view
"""


async def run(payload: dict[str, Any], engagement_id: Optional[str]) -> dict[str, Any]:
    """Diff generation worker entry point."""
    prev_artifacts = payload.get("previous_artifacts", {})
    curr_artifacts = payload.get("current_artifacts", {})
    change_reason = payload.get("change_reason", "")

    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    # Truncate large artifacts for token budget
    prev_str = json.dumps(prev_artifacts, indent=2)[:2000]
    curr_str = json.dumps(curr_artifacts, indent=2)[:2000]

    user_prompt = (
        f"Change reason: {change_reason or 'Not specified'}\n\n"
        f"Previous version:\n{prev_str}\n\n"
        f"Current version:\n{curr_str}"
    )

    response = await client.chat.completions.create(
        model=settings.llm_cheap_model,
        messages=[
            {"role": "system", "content": DIFF_SYSTEM},
            {"role": "user",   "content": user_prompt},
        ],
        max_tokens=400,
        temperature=0.1,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content or "{}"
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.error("Diff gen returned invalid JSON: %s", raw[:200])
        data = {"summary": "Changes recorded.", "changed_sections": [], "additions": [], "removals": [], "modifications": []}

    logger.info("Diff generated for engagement=%s sections_changed=%d",
                engagement_id, len(data.get("changed_sections", [])))
    return data
