"""Schemas for collateral type detection."""
from enum import Enum
from pydantic import BaseModel, Field


class CollateralType(str, Enum):
    """Mirrors the Prisma CollateralType enum exactly."""
    FIRST_MEETING_DECK      = "FIRST_MEETING_DECK"
    POST_DISCOVERY_DECK     = "POST_DISCOVERY_DECK"
    TECHNICAL_PROPOSAL      = "TECHNICAL_PROPOSAL"
    PROPOSAL_DEFENSE_DECK   = "PROPOSAL_DEFENSE_DECK"
    STATEMENT_OF_WORK       = "STATEMENT_OF_WORK"
    COMMERCIAL_ESTIMATION   = "COMMERCIAL_ESTIMATION"
    CASE_STUDY_DOCUMENT     = "CASE_STUDY_DOCUMENT"
    MARKETING_CONTENT       = "MARKETING_CONTENT"


class DetectionConfidence(str, Enum):
    RULE = "rule"    # Rule-based match (fast, free)
    LLM  = "llm"     # LLM classification (slower, costs tokens)


class CollateralDetectRequest(BaseModel):
    """Request to POST /collateral/detect."""
    message: str = Field(..., min_length=1, description="Raw AM message to classify")
    engagement_id: str | None = None


class CollateralDetectResponse(BaseModel):
    """Response from POST /collateral/detect."""
    collateral_type: CollateralType
    confidence: DetectionConfidence
