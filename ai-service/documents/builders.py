"""Turn verified results into canonical documents. Unverified content never passes through here."""
from __future__ import annotations

from documents.models import Bullet, Deck, Doc, EstimateLine, Section, Slide, SourceRef, Workbook
from grounding.evidence import EvidenceStore
from grounding.generator import GroundedResult


def _sources(result: GroundedResult, store: EvidenceStore) -> list[SourceRef]:
    used: dict[str, SourceRef] = {}
    for sec in result.sections:
        for vc in sec.claims:
            for eid in vc.claim.evidence_ids:
                ev = store.get(eid)
                if ev and ev.id not in used:
                    used[ev.id] = SourceRef(id=ev.id, title=ev.title, kind=ev.kind.value, uri=ev.uri)
    return list(used.values())


def _bullet(vc) -> Bullet:
    return Bullet(text=vc.claim.text, evidence_ids=vc.claim.evidence_ids, quote=vc.claim.quote)


def build_deck(title: str, result: GroundedResult, store: EvidenceStore) -> Deck:
    slides = [
        Slide(title=s.title, bullets=[_bullet(vc) for vc in s.claims],
              notes="\n".join(f'"{vc.claim.quote}" [{", ".join(vc.claim.evidence_ids)}]' for vc in s.claims))
        for s in result.sections if s.claims
    ]
    return Deck(title=title, slides=slides, sources=_sources(result, store), open_items=result.gaps)


def build_doc(title: str, result: GroundedResult, store: EvidenceStore) -> Doc:
    return Doc(
        title=title,
        sections=[Section(heading=s.title, paragraphs=[_bullet(vc) for vc in s.claims]) for s in result.sections],
        sources=_sources(result, store), open_items=result.gaps,
    )


def build_estimate_workbook(title: str, lines: list[EstimateLine], *, contingency_pct: float, margin_pct: float) -> Workbook:
    """Numbers come from the estimator's inputs only; the workbook carries live formulas."""
    return Workbook(title=title, lines=lines, contingency_pct=contingency_pct, margin_pct=margin_pct)
