"""
Deterministic gate for lessons. A lesson may steer HOW the AI writes (tone, structure, process).
It may never carry facts, because facts must come from cited evidence. Anything with figures,
links, contact details or a client name is refused here, before a human even sees it.
"""
from __future__ import annotations

import re

from pydantic import BaseModel

CATEGORIES = {"tone", "structure", "terminology", "process", "formatting"}
MAX_LEN = 240
_URL = re.compile(r"https?://|www\.", re.I)
_EMAIL = re.compile(r"\S+@\S+\.\S+")
_DIGIT = re.compile(r"\d")


class LintResult(BaseModel):
    ok: bool
    reasons: list[str]


def lint_lesson(text: str, category: str, forbidden_terms: list[str] | None = None) -> LintResult:
    reasons: list[str] = []
    t = text.strip()
    if not t:
        reasons.append("empty")
    if len(t) > MAX_LEN:
        reasons.append(f"longer than {MAX_LEN} characters")
    if category not in CATEGORIES:
        reasons.append(f"unknown category {category!r}")
    if _DIGIT.search(t):
        reasons.append("contains figures; facts belong in source documents or the knowledge base, not lessons")
    if _URL.search(t) or _EMAIL.search(t):
        reasons.append("contains a link or contact detail")
    lowered = t.casefold()
    for term in forbidden_terms or []:
        if term and term.casefold() in lowered:
            reasons.append(f"mentions client-specific term {term!r}")
    return LintResult(ok=not reasons, reasons=reasons)
