"""
Evidence store. Everything the AI may state as fact must come from here:
uploaded documents, approved knowledge-base entries, fetched web pages (with URL and
retrieval time) or deterministic calculations. Nothing else is citable.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


class EvidenceKind(str, Enum):
    UPLOAD = "upload"
    KNOWLEDGE_BASE = "kb"
    WEB = "web"
    CALCULATION = "calculation"  # produced by deterministic code, never by an LLM


class Evidence(BaseModel):
    id: str
    kind: EvidenceKind
    title: str
    text: str
    uri: str | None = None
    retrieved_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    verified_by_human: bool = False


def _chunk(text: str, max_chars: int) -> list[str]:
    """Split on paragraph boundaries; hard-split paragraphs that exceed max_chars."""
    out: list[str] = []
    buf = ""
    for para in (p.strip() for p in text.split("\n\n")):
        if not para:
            continue
        while len(para) > max_chars:
            cut = para.rfind(". ", 0, max_chars) + 1 or max_chars
            if buf:
                out.append(buf)
                buf = ""
            out.append(para[:cut].strip())
            para = para[cut:].strip()
        if buf and len(buf) + len(para) + 2 > max_chars:
            out.append(buf)
            buf = ""
        buf = f"{buf}\n\n{para}" if buf else para
    if buf:
        out.append(buf)
    return out


class EvidenceStore:
    """Passages keyed by a stable, content-derived id (so re-ingesting is idempotent)."""

    def __init__(self) -> None:
        self._items: dict[str, Evidence] = {}

    def add_document(
        self, *, kind: EvidenceKind, title: str, text: str, uri: str | None = None,
        verified_by_human: bool = False, max_chars: int = 1200,
    ) -> list[str]:
        ids: list[str] = []
        for i, passage in enumerate(_chunk(text, max_chars)):
            digest = hashlib.sha1(f"{kind.value}|{uri or title}|{i}|{passage}".encode()).hexdigest()[:10]
            ev = Evidence(
                id=f"{kind.value}-{digest}", kind=kind, title=title, text=passage,
                uri=uri, verified_by_human=verified_by_human,
            )
            self._items[ev.id] = ev
            ids.append(ev.id)
        return ids

    def get(self, evidence_id: str) -> Evidence | None:
        return self._items.get(evidence_id)

    def all(self) -> list[Evidence]:
        return list(self._items.values())

    def __len__(self) -> int:
        return len(self._items)

    def to_sources(self, kinds: set[EvidenceKind] | None = None) -> list[dict]:
        """Serialise evidence so later pipeline steps can re-cite it (whole passages, no edits)."""
        return [
            {"kind": e.kind.value, "title": e.title, "text": e.text, "uri": e.uri, "verified": e.verified_by_human}
            for e in self._items.values() if kinds is None or e.kind in kinds
        ]
