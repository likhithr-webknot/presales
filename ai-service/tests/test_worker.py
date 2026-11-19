import pytest

from tests.test_grounding import FakeLLM
from workers.collateral_generator import run


async def test_no_sources_returns_needs_input_without_llm():
    llm = FakeLLM()
    out = await run({"collateral_type": "FIRST_MEETING_DECK", "brief": "x"}, "e1", llm=llm)
    assert out["status"] == "needs_input" and llm.calls == 0


async def test_proposal_draft_is_grounded():
    src = {"title": "RFP", "text": "Delivery window is 14 months starting Q1 2027.", "uri": "rfp.pdf"}
    from grounding import EvidenceKind, EvidenceStore
    ids = EvidenceStore().add_document(kind=EvidenceKind.UPLOAD, title="RFP", text=src["text"], uri="rfp.pdf")
    claim = {"text": "Delivery takes 14 months.", "evidence_ids": ids, "quote": "Delivery window is 14 months"}
    llm = FakeLLM({"sections": [{"key": "delivery", "claims": [claim]}], "gaps": []})
    out = await run({"collateral_type": "TECHNICAL_PROPOSAL", "sources": [src], "brief": "b"}, "e1", llm=llm)
    assert out["kind"] == "doc" and out["document"]["sections"][-1]["paragraphs"][0]["text"] == "Delivery takes 14 months."
    assert any("understanding" in g for g in out["open_items"])
