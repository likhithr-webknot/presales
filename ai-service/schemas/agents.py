"""
Agent input/output schemas for all Sprint 2 workers.
All intermediate outputs are structured JSON — no PPTX/DOCX until Packaging Agent.
"""
from enum import Enum
from typing import Optional, Any
from pydantic import BaseModel, Field


# ── Research Agent ────────────────────────────────────────────────────────────

class ResearchDepth(str, Enum):
    LIGHT  = "light"   # Stage 1: 3-5 sources
    MEDIUM = "medium"  # Stage 2: 5-10 sources
    DEEP   = "deep"    # Stage 3: 10-20 sources


class ResearchSource(BaseModel):
    url: str
    title: str
    snippet: str
    relevance_score: float = Field(ge=0.0, le=1.0)


class CompanyIntel(BaseModel):
    name: str
    description: Optional[str] = None
    industry: Optional[str] = None
    size: Optional[str] = None
    recent_news: list[str] = Field(default_factory=list)
    key_challenges: list[str] = Field(default_factory=list)
    tech_stack_signals: list[str] = Field(default_factory=list)


class IndustryIntel(BaseModel):
    domain: str
    trends: list[str] = Field(default_factory=list)
    challenges: list[str] = Field(default_factory=list)
    regulatory_notes: list[str] = Field(default_factory=list)


class ResearchBrief(BaseModel):
    company: CompanyIntel
    industry: IndustryIntel
    sources: list[ResearchSource] = Field(default_factory=list)
    key_insights: list[str] = Field(default_factory=list)
    talking_points: list[str] = Field(default_factory=list)
    confidence: str = Field(default="medium", description="low|medium|high")
    warnings: list[str] = Field(
        default_factory=list,
        description="Populated when confidence is low or sources are thin",
    )
    depth: ResearchDepth = ResearchDepth.LIGHT


class ResearchInput(BaseModel):
    engagement_id: str
    client_name: str
    domain: str
    opportunity_context: Optional[str] = None
    depth: ResearchDepth = ResearchDepth.LIGHT
    prior_research: Optional[ResearchBrief] = None  # Stage 2+ carry-forward


# ── Context Manager ───────────────────────────────────────────────────────────

class WebknotCapability(BaseModel):
    name: str
    description: str
    relevant_domains: list[str] = Field(default_factory=list)


class WebknotProject(BaseModel):
    name: str
    domain: str
    summary: str
    tech_stack: list[str] = Field(default_factory=list)
    outcomes: list[str] = Field(default_factory=list)
    is_anonymized: bool = False


class WebknotContextOutput(BaseModel):
    positioning_narrative: str = Field(
        description="How Webknot should position itself for this specific prospect"
    )
    relevant_capabilities: list[WebknotCapability] = Field(default_factory=list)
    relevant_projects: list[WebknotProject] = Field(default_factory=list)
    differentiators: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(
        default_factory=list,
        description="Populated when KB is empty or returns thin results",
    )


class ContextInput(BaseModel):
    engagement_id: str
    client_name: str
    domain: str
    opportunity_context: Optional[str] = None
    research_brief: Optional[ResearchBrief] = None


# ── Packaging Agent ───────────────────────────────────────────────────────────

class SlideContent(BaseModel):
    title: str
    body: list[str] = Field(default_factory=list, description="Bullet points or paragraphs")
    speaker_notes: Optional[str] = None
    slide_type: str = Field(default="content", description="title|content|two-col|image")


class PackagingInput(BaseModel):
    engagement_id: str
    collateral_type: str           # mirrors CollateralType enum value
    stage: int
    research_brief: Optional[ResearchBrief] = None
    webknot_context: Optional[WebknotContextOutput] = None
    additional_context: dict[str, Any] = Field(default_factory=dict)
    output_format: str = Field(default="pptx", description="pptx|docx")
    version: int = 1


class PackagingOutput(BaseModel):
    engagement_id: str
    file_key: str = Field(description="MinIO object key for the generated file")
    presigned_url: str = Field(description="24h presigned download URL")
    format: str
    slide_count: Optional[int] = None
    quality_warnings: list[str] = Field(
        default_factory=list,
        description="Placeholder text, missing sections, etc.",
    )
    version: int
