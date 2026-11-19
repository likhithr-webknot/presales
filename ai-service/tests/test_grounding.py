import pytest

from grounding import (Claim, EvidenceKind, EvidenceStore, InsufficientEvidence,
                       generate_grounded_sections, verify_claim)

RFP = "The platform shall achieve availability of 99.95% per calendar month.\n\nTier-1 services need an RTO of 1 hour."


def make_store():
    store = EvidenceStore()
    ids = store.add_document(kind=EvidenceKind.UPLOAD, title="RFP", text=RFP, uri="rfp.pdf")
    return store, ids


class FakeLLM:
    def __init__(self, *responses):
        self.responses, self.calls = list(responses), 0

    async def complete_json(self, *, system, user, max_tokens=4096):
        self.calls += 1
        return self.responses.pop(0)


def test_supported_claim():
    store, ids = make_store()
    c = Claim(text="Availability must be 99.95% monthly.", evidence_ids=ids[:1], quote="availability of 99.95% per calendar month")
    assert verify_claim(c, store).status == "supported"


@pytest.mark.parametrize("claim,reason", [
    (Claim(text="Uptime is 99.99%.", evidence_ids=["x"], quote="q"), "unknown evidence id"),
    (Claim(text="Uptime is high.", evidence_ids=[], quote=""), "no evidence cited"),
    (Claim(text="Availability is 99.99%.", evidence_ids=[], quote="availability of 99.95%"), "no evidence cited"),
])
def test_rejections(claim, reason):
    store, _ = make_store()
    assert reason in " ".join(verify_claim(claim, store).reasons)


def test_wrong_number_and_fabricated_quote_rejected():
    store, ids = make_store()
    wrong_num = Claim(text="Availability must be 99.99%.", evidence_ids=ids[:1], quote="availability of 99.95% per calendar month")
    fake_quote = Claim(text="Availability must be 99.95%.", evidence_ids=ids[:1], quote="the vendor guarantees 99.95% uptime")
    assert "figures not present" in " ".join(verify_claim(wrong_num, store).reasons)
    assert "quote not found" in " ".join(verify_claim(fake_quote, store).reasons)


@pytest.mark.asyncio
async def test_no_evidence_means_no_llm_call():
    llm = FakeLLM()
    with pytest.raises(InsufficientEvidence):
        await generate_grounded_sections(llm, brief="b", outline={"a": "A"}, store=EvidenceStore())
    assert llm.calls == 0


@pytest.mark.asyncio
async def test_hallucination_dropped_and_reported_as_gap():
    store, ids = make_store()
    good = {"text": "RTO is 1 hour for tier-1.", "evidence_ids": ids[:1], "quote": "RTO of 1 hour"}
    bad = {"text": "The client has 40 million customers.", "evidence_ids": ids[:1], "quote": "40 million customers"}
    llm = FakeLLM({"sections": [{"key": "nfr", "claims": [good, bad]}], "gaps": []},
                  {"sections": [{"key": "nfr", "claims": [bad]}], "gaps": []})
    res = await generate_grounded_sections(llm, brief="b", outline={"nfr": "NFRs", "ctx": "Context"}, store=store)
    assert [v.claim.text for v in res.sections[0].claims] == [good["text"]]
    assert res.sections[1].claims == []
    assert any("ctx" in g for g in res.gaps)
    assert all("40 million" not in v.claim.text for s in res.sections for v in s.claims)
    assert res.rejected and llm.calls == 2


@pytest.mark.asyncio
async def test_invented_section_ignored():
    store, ids = make_store()
    c = {"text": "RTO is 1 hour.", "evidence_ids": ids[:1], "quote": "RTO of 1 hour"}
    llm = FakeLLM({"sections": [{"key": "made_up", "claims": [c]}], "gaps": []})
    res = await generate_grounded_sections(llm, brief="b", outline={"nfr": "NFRs"}, store=store, max_repairs=0)
    assert res.sections[0].claims == []
