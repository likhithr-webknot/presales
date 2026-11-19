"""
Deterministic claim verification. No LLM involved, so it cannot be talked into agreeing.

A claim is SUPPORTED only if:
  1. it cites at least one evidence id and every id exists in the store;
  2. its `quote` appears verbatim (whitespace/quote-normalised) in a cited passage;
  3. every number, percentage, money amount and year in the claim text appears in the
     cited passages. A figure the sources do not contain is rejected, not rounded.

Limits (be honest about them): this proves the claim is anchored in the sources and
that its figures are real. It cannot prove that the prose faithfully paraphrases the quote;
that is why claims are rendered next to their quote/citation and reviewed by a person.
"""
from __future__ import annotations

import re
from enum import Enum

from pydantic import BaseModel, Field

from grounding.evidence import EvidenceStore


class Claim(BaseModel):
    text: str
    evidence_ids: list[str] = Field(default_factory=list)
    quote: str = ""


class ClaimStatus(str, Enum):
    SUPPORTED = "supported"
    UNSUPPORTED = "unsupported"


class VerifiedClaim(BaseModel):
    claim: Claim
    status: ClaimStatus
    reasons: list[str] = Field(default_factory=list)


_QUOTES = str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", " ": " "})
_NUMBER = re.compile(r"(?<![\w.])\d[\d,]*(?:\.\d+)?")


def normalise(text: str) -> str:
    return re.sub(r"\s+", " ", text.translate(_QUOTES)).strip().casefold()


def numbers_in(text: str) -> set[str]:
    """Numeric tokens with thousands separators removed, e.g. '1,840' -> '1840'."""
    return {m.group(0).replace(",", "").rstrip(".") for m in _NUMBER.finditer(text)}


def verify_claim(claim: Claim, store: EvidenceStore) -> VerifiedClaim:
    reasons: list[str] = []
    if not claim.text.strip():
        reasons.append("empty claim")
    if not claim.evidence_ids:
        reasons.append("no evidence cited")

    cited = []
    for eid in claim.evidence_ids:
        ev = store.get(eid)
        if ev is None:
            reasons.append(f"unknown evidence id {eid!r}")
        else:
            cited.append(ev)

    if cited:
        haystack = normalise(" ".join(e.text for e in cited))
        quote = normalise(claim.quote)
        if not quote:
            reasons.append("no supporting quote")
        elif quote not in haystack:
            reasons.append("quote not found verbatim in cited evidence")
        missing = sorted(numbers_in(claim.text) - numbers_in(" ".join(e.text for e in cited)))
        if missing:
            reasons.append(f"figures not present in cited evidence: {', '.join(missing)}")

    return VerifiedClaim(
        claim=claim,
        status=ClaimStatus.UNSUPPORTED if reasons else ClaimStatus.SUPPORTED,
        reasons=reasons,
    )
