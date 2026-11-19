"""
Turns recorded mistakes (human edits, verifier rejections, comments) into CANDIDATE lessons.
Candidates are never used until a person approves them. To limit overfitting and invention:
  - each lesson must cite >= MIN_SUPPORT distinct events that exist,
  - its `evidence_quote` must appear verbatim in the cited events,
  - it must pass the deterministic lint (no figures, links, client names).
"""
from __future__ import annotations

import json

from pydantic import BaseModel

from grounding.verifier import normalise
from learning.lint import CATEGORIES, lint_lesson
from llm.client import LLMClient

MIN_SUPPORT = 2

SYSTEM = f"""You review corrections people made to AI-written presales documents and extract reusable
WRITING GUIDANCE. Rules:
- A lesson describes how to write (tone, structure, terminology, process, formatting). It never states facts.
- No numbers, names of clients or people, links, or claims about the world.
- Only propose a lesson supported by at least {MIN_SUPPORT} different events; cite their ids.
- `evidence_quote` must be copied exactly from one cited event's text.
- If nothing recurs, return an empty list. Do not pad.
Return JSON only: {{"lessons":[{{"text":str,"category":one of {sorted(CATEGORIES)},"source_event_ids":[str],"evidence_quote":str}}]}}"""


class FeedbackEventIn(BaseModel):
    id: str
    type: str
    collateral_type: str
    payload: dict


class Candidate(BaseModel):
    text: str
    category: str
    source_event_ids: list[str]


class Dropped(BaseModel):
    text: str
    reasons: list[str]


class ProposeResult(BaseModel):
    candidates: list[Candidate]
    dropped: list[Dropped]


def _event_text(e: FeedbackEventIn) -> str:
    return json.dumps(e.payload, ensure_ascii=False)


async def propose_lessons(
    llm: LLMClient, events: list[FeedbackEventIn], *, existing: list[str], forbidden_terms: list[str],
) -> ProposeResult:
    if len(events) < MIN_SUPPORT:
        return ProposeResult(candidates=[], dropped=[])

    by_id = {e.id: e for e in events}
    user = "EVENTS:\n" + "\n".join(f"[{e.id}] ({e.type}, {e.collateral_type}) {_event_text(e)}" for e in events)
    if existing:
        user += "\n\nALREADY KNOWN (do not repeat):\n" + "\n".join(f"- {t}" for t in existing)
    raw = await llm.complete_json(system=SYSTEM, user=user)

    known = {normalise(t) for t in existing}
    candidates: list[Candidate] = []
    dropped: list[Dropped] = []
    for item in raw.get("lessons", []) or []:
        text = str(item.get("text", "")).strip()
        category = str(item.get("category", ""))
        ids = list(dict.fromkeys(str(i) for i in item.get("source_event_ids", []) or []))
        reasons = list(lint_lesson(text, category, forbidden_terms).reasons)

        missing = [i for i in ids if i not in by_id]
        if missing:
            reasons.append(f"cites unknown events: {', '.join(missing)}")
        if len(set(ids) - set(missing)) < MIN_SUPPORT:
            reasons.append(f"supported by fewer than {MIN_SUPPORT} events")
        quote = normalise(str(item.get("evidence_quote", "")))
        cited_text = normalise(" ".join(_event_text(by_id[i]) for i in ids if i in by_id))
        if not quote or quote not in cited_text:
            reasons.append("evidence quote not found in cited events")
        if normalise(text) in known:
            reasons.append("duplicate of an existing lesson")

        if reasons:
            dropped.append(Dropped(text=text, reasons=reasons))
        else:
            candidates.append(Candidate(text=text, category=category, source_event_ids=ids))
            known.add(normalise(text))
    return ProposeResult(candidates=candidates, dropped=dropped)
