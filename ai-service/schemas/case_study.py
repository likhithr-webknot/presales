"""Schemas for Case Study Maker output."""
from typing import Optional
from pydantic import BaseModel, Field


class CaseStudyOutput(BaseModel):
    title: str
    client_industry: str
    challenge: str = Field(description="The client's problem we solved")
    solution: str = Field(description="What Webknot built")
    outcomes: list[str] = Field(default_factory=list, description="Measurable results")
    tech_stack: list[str] = Field(default_factory=list)
    relevance_score: float = Field(ge=0.0, le=1.0, default=0.5)
    tailored_angle: str = Field(description="How this case study is framed for the current prospect")
    is_anonymized: bool = False


class CaseStudyInput(BaseModel):
    engagement_id: str
    client_name: str
    domain: str
    opportunity_context: Optional[str] = None
    research_brief: Optional[dict] = None
    framing_guidance: Optional[str] = None   # from Narrative Agent
