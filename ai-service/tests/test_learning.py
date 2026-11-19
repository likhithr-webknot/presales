from grounding import EvidenceKind, EvidenceStore, generate_grounded_sections
from learning.lint import lint_lesson
from learning.proposer import FeedbackEventIn, propose_lessons
from tests.test_grounding import RFP, FakeLLM


def ev(i, text):
    return FeedbackEventIn(id=i, type="HUMAN_EDIT", collateral_type="FIRST_MEETING_DECK", payload={"removed": [text], "added": ["Shorter."]})


def test_lint_blocks_facts_links_and_client_names():
    assert lint_lesson("Lead with the client's goal.", "structure").ok
    assert not lint_lesson("Uptime is 99.9%.", "tone").ok
    assert not lint_lesson("See https://x.com", "tone").ok
    assert not lint_lesson("Never mention Acme.", "tone", ["Acme"]).ok
    assert not lint_lesson("Be nice.", "vibes").ok


async def test_proposer_requires_support_and_real_quotes():
    events = [ev("a", "A very long winded opening sentence"), ev("b", "Another long winded opening sentence")]
    good = {"text": "Open with one short sentence.", "category": "tone", "source_event_ids": ["a", "b"], "evidence_quote": "long winded opening"}
    one_event = {"text": "Prefer short bullets.", "category": "formatting", "source_event_ids": ["a"], "evidence_quote": "long winded"}
    fake_quote = {"text": "Avoid jargon.", "category": "tone", "source_event_ids": ["a", "b"], "evidence_quote": "never said this"}
    with_fact = {"text": "Always say we have 500 engineers.", "category": "tone", "source_event_ids": ["a", "b"], "evidence_quote": "long winded"}
    res = await propose_lessons(FakeLLM({"lessons": [good, one_event, fake_quote, with_fact]}), events, existing=[], forbidden_terms=[])
    assert [c.text for c in res.candidates] == [good["text"]]
    assert len(res.dropped) == 3


async def test_single_event_never_calls_llm():
    llm = FakeLLM()
    res = await propose_lessons(llm, [ev("a", "x")], existing=[], forbidden_terms=[])
    assert res.candidates == [] and llm.calls == 0


async def test_guidance_reaches_prompt_but_does_not_relax_verification():
    seen = {}

    class Spy(FakeLLM):
        async def complete_json(self, *, system, user, max_tokens=4096):
            seen["system"] = system
            return await super().complete_json(system=system, user=user)

    store = EvidenceStore()
    ids = store.add_document(kind=EvidenceKind.UPLOAD, title="RFP", text=RFP)
    bad = {"text": "Uptime is 99.999%.", "evidence_ids": ids[:1], "quote": "availability of 99.95%"}
    res = await generate_grounded_sections(
        Spy({"sections": [{"key": "a", "claims": [bad]}], "gaps": []}), brief="b", outline={"a": "A"}, store=store,
        max_repairs=0, guidance=["Open with the client's goal."],
    )
    assert "Open with the client's goal." in seen["system"]
    assert res.sections[0].claims == []  # guidance cannot make an unsupported figure pass
