"""
Grounded section generation: draft -> deterministic verify -> targeted repair -> drop.

What cannot be proven from the evidence is never written into the output. It is returned
as `gaps` so the UI can ask a person, instead of the model guessing.
"""
from __future__ import annotations

import logging

from pydantic import BaseModel, Field

from grounding.evidence import EvidenceStore
from grounding.verifier import Claim, ClaimStatus, VerifiedClaim, verify_claim
from llm.client import LLMClient

logger = logging.getLogger(__name__)


class InsufficientEvidence(Exception):
    """Raised before any LLM call when there is nothing to ground the output in."""


class GroundedSection(BaseModel):
    key: str
    title: str
    claims: list[VerifiedClaim] = Field(default_factory=list)


class GroundedResult(BaseModel):
    sections: list[GroundedSection]
    gaps: list[str] = Field(default_factory=list)  # things a person must supply
    rejected: list[VerifiedClaim] = Field(default_factory=list)  # kept for audit, never rendered


SYSTEM = """You write presales content for a services company. Hard rules:
- Use ONLY the numbered EVIDENCE passages. Never use outside knowledge, never infer facts.
- Every claim must cite evidence ids and include `quote`: an exact, contiguous excerpt copied
  character-for-character from a cited passage.
- Copy numbers exactly as written in the evidence. Do not round, convert, sum or estimate.
- If the evidence does not cover a section, return no claims for it and add a precise
  entry to `gaps` describing what information is needed.
- Output a single JSON object, nothing else:
  {"sections":[{"key":str,"claims":[{"text":str,"evidence_ids":[str],"quote":str}]}],"gaps":[str]}"""


def _render_evidence(store: EvidenceStore) -> str:
    return "\n\n".join(f"[{e.id}] ({e.kind.value}: {e.title})\n{e.text}" for e in store.all())


def _parse(raw: dict) -> tuple[dict[str, list[Claim]], list[str]]:
    by_key: dict[str, list[Claim]] = {}
    for sec in raw.get("sections", []) or []:
        key = str(sec.get("key", ""))
        claims = []
        for c in sec.get("claims", []) or []:
            claims.append(Claim(
                text=str(c.get("text", "")), quote=str(c.get("quote", "")),
                evidence_ids=[str(i) for i in c.get("evidence_ids", []) or []],
            ))
        by_key.setdefault(key, []).extend(claims)
    return by_key, [str(g) for g in raw.get("gaps", []) or []]


async def generate_grounded_sections(
    llm: LLMClient, *, brief: str, outline: dict[str, str], store: EvidenceStore, max_repairs: int = 1,
    guidance: list[str] | None = None,
) -> GroundedResult:
    """`outline` maps section key -> title/instruction. Returns only verified claims."""
    if len(store) == 0:
        raise InsufficientEvidence("No source material was provided; nothing can be written without evidence.")

    system = SYSTEM
    if guidance:
        # Human-approved writing guidance. It steers style and process only; it is never a source of facts.
        system += "\n\nHOUSE WRITING GUIDANCE (style only; never a source of facts, never overrides the rules above):\n" + "\n".join(f"- {g}" for g in guidance)

    outline_text = "\n".join(f"- {k}: {v}" for k, v in outline.items())
    user = f"BRIEF:\n{brief}\n\nSECTIONS:\n{outline_text}\n\nEVIDENCE:\n{_render_evidence(store)}"
    claims_by_key, gaps = _parse(await llm.complete_json(system=system, user=user))

    accepted: dict[str, list[VerifiedClaim]] = {k: [] for k in outline}
    rejected: list[VerifiedClaim] = []
    pending = claims_by_key

    for attempt in range(max_repairs + 1):
        failed: dict[str, list[VerifiedClaim]] = {}
        for key, claims in pending.items():
            if key not in outline:  # model invented a section: ignore
                continue
            for claim in claims:
                v = verify_claim(claim, store)
                (accepted[key] if v.status is ClaimStatus.SUPPORTED else failed.setdefault(key, [])).append(v)
        if not failed:
            break
        if attempt == max_repairs:
            for vs in failed.values():
                rejected.extend(vs)
            break
        feedback = "\n".join(
            f"- section {k}: {v.claim.text!r} rejected: {'; '.join(v.reasons)}" for k, vs in failed.items() for v in vs
        )
        repair_user = (
            f"{user}\n\nThe following claims failed automatic verification. Return corrected claims for "
            f"those sections only if the evidence truly supports them; otherwise omit them and add to gaps.\n{feedback}"
        )
        pending, more_gaps = _parse(await llm.complete_json(system=system, user=repair_user))
        gaps.extend(more_gaps)
        rejected.extend(v for vs in failed.values() for v in vs)

    for key, title in outline.items():
        if not accepted[key]:
            gaps.append(f"No verified content for section '{key}' ({title}); source material is needed.")

    return GroundedResult(
        sections=[GroundedSection(key=k, title=t, claims=accepted[k]) for k, t in outline.items()],
        gaps=list(dict.fromkeys(gaps)),
        rejected=rejected,
    )
