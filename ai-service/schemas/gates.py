"""Schemas for gate machinery — compliance scoring, gate submissions, approvals."""
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class GateNumber(str, Enum):
    GATE_1       = "GATE_1"
    GATE_2       = "GATE_2"
    GATE_3       = "GATE_3"
    DEFENSE_GATE = "DEFENSE_GATE"


class LLMProvider(str, Enum):
    CLAUDE = "claude"
    GPT    = "gpt"
    GEMINI = "gemini"


class DimensionScore(BaseModel):
    dimension: str
    mean_score: float = Field(ge=1.0, le=5.0)
    std_dev: float = Field(ge=0.0)
    scores: dict[str, float]          # provider → score
    reasoning: dict[str, str]         # provider → reasoning text
    is_high_variance: bool = False
    suggestions: list[str] = Field(default_factory=list)


class ComplianceMatrix(BaseModel):
    gate_number: GateNumber
    engagement_id: str
    dimensions: list[DimensionScore]
    overall_score: float = Field(ge=1.0, le=5.0)
    high_variance_areas: list[str] = Field(default_factory=list)
    improvement_suggestions: list[str] = Field(default_factory=list)
    scoring_model_versions: dict[str, str] = Field(default_factory=dict)


class ScoringInput(BaseModel):
    engagement_id: str
    gate_number: GateNumber
    content: dict                      # the deliverable being scored
    rfp_requirements: Optional[str] = None
    dimensions: list[str] = Field(
        default_factory=lambda: [
            "technical_accuracy",
            "client_relevance",
            "completeness",
            "clarity",
            "value_proposition",
        ]
    )
