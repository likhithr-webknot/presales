"""Renderers: canonical model -> .pptx / .docx / .xlsx bytes."""
from __future__ import annotations

from io import BytesIO

from docx import Document
from docx.shared import RGBColor
from openpyxl import Workbook as XlWorkbook
from openpyxl.styles import Font, PatternFill
from pptx import Presentation
from pptx.util import Pt

from documents.models import Deck, Doc, Workbook


def _cite(ids: list[str], order: dict[str, int]) -> str:
    return "".join(f"[{order[i]}]" for i in ids if i in order)


def render_pptx(deck: Deck) -> bytes:
    prs = Presentation()
    order = {s.id: n for n, s in enumerate(deck.sources, 1)}
    title_slide = prs.slides.add_slide(prs.slide_layouts[0])
    title_slide.shapes.title.text = deck.title
    title_slide.placeholders[1].text = "Draft: every statement is cited; see the Sources slide"

    for s in deck.slides:
        slide = prs.slides.add_slide(prs.slide_layouts[1])
        slide.shapes.title.text = s.title
        tf = slide.placeholders[1].text_frame
        tf.clear()
        for i, b in enumerate(s.bullets):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.text = f"{b.text} {_cite(b.evidence_ids, order)}".strip()
            p.font.size = Pt(18)
        if s.notes:
            slide.notes_slide.notes_text_frame.text = s.notes

    if deck.open_items:
        slide = prs.slides.add_slide(prs.slide_layouts[1])
        slide.shapes.title.text = "Information needed before this can be finalised"
        tf = slide.placeholders[1].text_frame
        for i, g in enumerate(deck.open_items):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.text = g
            p.font.size = Pt(16)
    if deck.sources:
        slide = prs.slides.add_slide(prs.slide_layouts[1])
        slide.shapes.title.text = "Sources"
        tf = slide.placeholders[1].text_frame
        for i, src in enumerate(deck.sources):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.text = f"[{i + 1}] {src.title} ({src.kind}){' · ' + src.uri if src.uri else ''}"
            p.font.size = Pt(12)
    out = BytesIO()
    prs.save(out)
    return out.getvalue()


def render_docx(doc: Doc) -> bytes:
    d = Document()
    d.add_heading(doc.title, 0)
    order = {s.id: n for n, s in enumerate(doc.sources, 1)}
    for sec in doc.sections:
        d.add_heading(sec.heading, 1)
        if not sec.paragraphs:
            p = d.add_paragraph()
            run = p.add_run("[INPUT NEEDED: no verified content for this section]")
            run.bold = True
            run.font.color.rgb = RGBColor(0xB4, 0x53, 0x09)
        for b in sec.paragraphs:
            d.add_paragraph(f"{b.text} {_cite(b.evidence_ids, order)}".strip())
    if doc.open_items:
        d.add_heading("Information needed", 1)
        for g in doc.open_items:
            d.add_paragraph(g, style="List Bullet")
    if doc.sources:
        d.add_heading("Sources", 1)
        for n, s in enumerate(doc.sources, 1):
            d.add_paragraph(f"[{n}] {s.title} ({s.kind}){' · ' + s.uri if s.uri else ''}")
    out = BytesIO()
    d.save(out)
    return out.getvalue()


def render_xlsx(wb: Workbook) -> bytes:
    x = XlWorkbook()
    ws = x.active
    ws.title = "Estimate"
    header = ["Work package", "Task", "Role", "Hours", "Rate", "Cost"]
    ws.append(header)
    for c in ws[1]:
        c.font = Font(bold=True)
        c.fill = PatternFill("solid", fgColor="E4E4E7")
    for i, ln in enumerate(wb.lines, start=2):
        ws.append([ln.work_package, ln.task, ln.role, ln.hours, ln.rate, f"=D{i}*E{i}"])
    last = len(wb.lines) + 1
    r = last + 2
    rows = [
        ("Labour cost", f"=SUM(F2:F{last})"),
        (f"Contingency ({wb.contingency_pct:g}%)", f"=F{r}*{wb.contingency_pct / 100}"),
        ("Total cost", f"=F{r}+F{r + 1}"),
        (f"Margin ({wb.margin_pct:g}%)", f"=F{r + 4}-F{r + 2}"),
        (f"Proposal value ({wb.currency})", f"=F{r + 2}/(1-{wb.margin_pct / 100})"),
    ]
    for off, (label, formula) in enumerate(rows):
        ws.cell(row=r + off, column=5, value=label).font = Font(bold=off in (2, 4))
        ws.cell(row=r + off, column=6, value=formula).font = Font(bold=off in (2, 4))
    for col, w in zip("ABCDEF", (22, 34, 20, 10, 10, 14)):
        ws.column_dimensions[col].width = w
    out = BytesIO()
    x.save(out)
    return out.getvalue()
