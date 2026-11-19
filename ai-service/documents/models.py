"""
Canonical, editable document models. The platform's editors read and write these JSON models;
.pptx/.docx/.xlsx are *export formats* rendered from them. Every text element keeps its
provenance so an edit that removes the citation is visible to reviewers.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class SourceRef(BaseModel):
    id: str
    title: str
    kind: str
    uri: str | None = None


class Bullet(BaseModel):
    text: str
    evidence_ids: list[str] = Field(default_factory=list)
    quote: str = ""
    origin: Literal["ai_verified", "human", "placeholder"] = "ai_verified"


class Slide(BaseModel):
    title: str
    bullets: list[Bullet] = Field(default_factory=list)
    notes: str = ""


class Deck(BaseModel):
    title: str
    slides: list[Slide]
    sources: list[SourceRef] = Field(default_factory=list)
    open_items: list[str] = Field(default_factory=list)


class Section(BaseModel):
    heading: str
    paragraphs: list[Bullet] = Field(default_factory=list)


class Doc(BaseModel):
    title: str
    sections: list[Section]
    sources: list[SourceRef] = Field(default_factory=list)
    open_items: list[str] = Field(default_factory=list)


class EstimateLine(BaseModel):
    work_package: str
    task: str
    role: str
    hours: float = Field(ge=0)
    rate: float = Field(ge=0)


class Workbook(BaseModel):
    title: str
    lines: list[EstimateLine]
    contingency_pct: float = Field(ge=0, le=100)
    margin_pct: float = Field(ge=0, lt=100)
    currency: str = "USD"
