"""Schemas for Narrative Agent and Technical Solution Agent outputs."""
from typing import Optional, Any
from pydantic import BaseModel, Field


class SectionBrief(BaseModel):
    section_name: str
    purpose: str
    key_messages: list[str] = Field(default_factory=list)
    content: Optional[str] = None       # filled during content phase


class NarrativePositioningOutput(BaseModel):
    engagement_id: str
    positioning_angle: str = Field(description="The core narrative angle — WHY Webknot for THIS client")
    sections: list[SectionBrief] = Field(description="Proposed section structure")
    executive_summary_hint: Optional[str] = None
    tone_guidance: str = "professional, confident, client-centric"
    anti_patterns_flagged: list[str] = Field(
        default_factory=list,
        description="Vague language or unsubstantiated claims detected in the proposed structure",
    )
    phase: str = Field(default="positioning", description="positioning|content|coherence_pass")


class NarrativeInput(BaseModel):
    engagement_id: str
    phase: str = "positioning"           # positioning | content | coherence_pass
    client_name: str
    domain: str
    opportunity_context: Optional[str] = None
    research_brief: Optional[dict[str, Any]] = None
    webknot_context: Optional[dict[str, Any]] = None
    call_notes: Optional[str] = None
    rfp_text: Optional[str] = None
    prior_narrative: Optional[NarrativePositioningOutput] = None
    technical_solution: Optional[dict[str, Any]] = None   # for coherence pass
    am_instructions: Optional[str] = None


class FeatureItem(BaseModel):
    module: str
    features: list[str] = Field(default_factory=list)
    tasks: list[str] = Field(default_factory=list)
    complexity: str = Field(default="medium", description="low|medium|high")


class TechnicalSolutionOutput(BaseModel):
    engagement_id: str
    architecture_overview: str
    tech_stack: list[str] = Field(default_factory=list)
    integrations: list[str] = Field(default_factory=list)
    feature_breakdown: list[FeatureItem] = Field(default_factory=list)
    infrastructure: str = ""
    security_approach: str = ""
    scalability_notes: str = ""
    feasibility_flags: list[str] = Field(
        default_factory=list,
        description="Aggressive timeline warnings, over-scope flags, phasing recommendations",
    )
    phase_suggestions: list[str] = Field(default_factory=list)


class TechnicalInput(BaseModel):
    engagement_id: str
    client_name: str
    domain: str
    opportunity_context: Optional[str] = None
    rfp_text: Optional[str] = None
    research_brief: Optional[dict[str, Any]] = None
    narrative_output: Optional[NarrativePositioningOutput] = None
    budget_constraint_inr: Optional[float] = None
    timeline_weeks: Optional[int] = None
    am_instructions: Optional[str] = None
