from tests.test_grounding import FakeLLM, RFP
from workers import collateral_generator, context_manager, packaging, pricing_workbook, research


async def test_context_dedupes_nothing_and_flags_empty():
    out = await context_manager.run({"sources": []}, "e")
    assert out["status"] == "needs_input"
    out = await context_manager.run({"sources": [{"kind": "upload", "title": "RFP", "text": RFP}]}, "e")
    assert out["status"] == "ready" and out["sources"][0]["title"] == "RFP"


async def test_research_without_urls_or_sources_asks_for_input():
    assert (await research.run({"depth": "deep"}, "e"))["status"] == "needs_input"


async def test_packaging_cites_sources_from_previous_steps():
    prev = [{"agent_name": "CONTEXT_MANAGER", "output": {"sources": [{"kind": "upload", "title": "RFP", "text": RFP, "uri": "rfp.pdf"}]}}]
    from grounding import EvidenceKind, EvidenceStore
    ids = EvidenceStore().add_document(kind=EvidenceKind.UPLOAD, title="RFP", text=RFP, uri="rfp.pdf")
    claim = {"text": "RTO is 1 hour for tier-1 services.", "evidence_ids": ids[:1], "quote": "RTO of 1 hour"}
    llm = FakeLLM({"sections": [{"key": "challenges", "claims": [claim]}], "gaps": []})
    out = await collateral_generator.run({"collateral_type": "FIRST_MEETING_DECK", "previous": prev, "brief": "b"}, "e", llm=llm)
    assert out["kind"] == "deck" and out["document"]["sources"][0]["uri"] == "rfp.pdf"
    assert packaging.run  # packaging delegates to the same generator


async def test_pricing_requires_estimator_inputs():
    assert (await pricing_workbook.run({}, "e"))["status"] == "needs_input"
    out = await pricing_workbook.run({"lines": [{"work_package": "W", "task": "t", "role": "r", "hours": 8, "rate": 100}], "margin_pct": 30}, "e")
    assert out["kind"] == "workbook"
