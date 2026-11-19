"""Minimal LLM abstraction so agents are testable without network access."""
from __future__ import annotations

import json
import re
from typing import Protocol

from config import get_settings


class LLMError(RuntimeError):
    pass


class LLMClient(Protocol):
    async def complete_json(self, *, system: str, user: str, max_tokens: int = 4096) -> dict: ...


def parse_json_object(raw: str) -> dict:
    """Parse a JSON object, tolerating a fenced block or leading/trailing prose."""
    raw = raw.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", raw, re.S)
    candidate = fenced.group(1) if fenced else raw[raw.find("{"): raw.rfind("}") + 1]
    try:
        value = json.loads(candidate)
    except json.JSONDecodeError as exc:
        raise LLMError(f"model did not return valid JSON: {exc}") from exc
    if not isinstance(value, dict):
        raise LLMError("model JSON was not an object")
    return value


class AnthropicClient:
    """Premium-tier client (config.llm_premium_model). Temperature 0 for reproducibility."""

    def __init__(self) -> None:
        from anthropic import AsyncAnthropic

        s = get_settings()
        self._client = AsyncAnthropic(api_key=s.anthropic_api_key, timeout=s.llm_timeout)
        self._model = s.llm_premium_model

    async def complete_json(self, *, system: str, user: str, max_tokens: int = 4096) -> dict:
        msg = await self._client.messages.create(
            model=self._model, max_tokens=max_tokens, temperature=0, system=system,
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
        return parse_json_object(text)
