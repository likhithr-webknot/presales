from io import BytesIO

import pytest
from docx import Document
from openpyxl import load_workbook
from pptx import Presentation

from documents import EstimateLine, build_deck, build_doc, build_estimate_workbook
from documents.render import render_docx, render_pptx, render_xlsx
from grounding import EvidenceKind, EvidenceStore, generate_grounded_sections
from tests.test_grounding import FakeLLM, RFP


@pytest.mark.asyncio
async def test_deck_and_doc_carry_citations_and_open_items():
    store = EvidenceStore()
    ids = store.add_document(kind=EvidenceKind.UPLOAD, title="RFP", text=RFP, uri="rfp.pdf")
    claim = {"text": "RTO is 1 hour.", "evidence_ids": ids[:1], "quote": "RTO of 1 hour"}
    llm = FakeLLM({"sections": [{"key": "nfr", "claims": [claim]}], "gaps": ["Client budget"]})
    res = await generate_grounded_sections(llm, brief="b", outline={"nfr": "NFRs", "ctx": "Context"}, store=store)

    deck_text = " ".join(sh.text_frame.text for sl in Presentation(BytesIO(render_pptx(build_deck("D", res, store)))).slides
                         for sh in sl.shapes if sh.has_text_frame)
    assert "RTO is 1 hour. [1]" in deck_text and "Client budget" in deck_text and "rfp.pdf" in deck_text

    doc_text = "\n".join(p.text for p in Document(BytesIO(render_docx(build_doc("P", res, store)))).paragraphs)
    assert "[INPUT NEEDED" in doc_text and "RTO is 1 hour. [1]" in doc_text


def test_workbook_uses_formulas_not_literals():
    wb = build_estimate_workbook("E", [EstimateLine(work_package="WP1", task="t", role="Eng", hours=100, rate=85)],
                                 contingency_pct=10, margin_pct=30)
    ws = load_workbook(BytesIO(render_xlsx(wb)))["Estimate"]
    assert ws["F2"].value == "=D2*E2" and ws["F4"].value == "=SUM(F2:F2)"
    assert ws["F8"].value.startswith("=F6/(1-")
