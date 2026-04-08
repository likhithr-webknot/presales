"""Schemas for intake parsing (AM message → structured fields)."""
from typing import Optional
from pydantic import BaseModel, Field
from schemas.collateral import CollateralType


class ContactDetails(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None


class ParsedFields(BaseModel):
    """Structured fields extracted from an AM's freeform message."""
    client_name: Optional[str] = None
    domain: Optional[str] = None
    opportunity_context: Optional[str] = None
    contact_details: Optional[ContactDetails] = None
    collateral_type: Optional[CollateralType] = None
    stage: Optional[int] = Field(None, ge=1, le=5)


class IntakeParseRequest(BaseModel):
    """Request to POST /intake/parse."""
    message: str = Field(..., min_length=1, description="Raw AM message to parse")
    existing_context: Optional[ParsedFields] = Field(
        None, description="Already-extracted fields to merge with"
    )
    engagement_id: Optional[str] = None


class IntakeParseResponse(BaseModel):
    """Response from POST /intake/parse."""
    parsed: ParsedFields
    missing_fields: list[str] = Field(
        default_factory=list,
        description="Required fields still absent for the detected collateral type",
    )
    follow_up_question: Optional[str] = Field(
        None, description="Natural language question to ask AM for missing fields"
    )
    raw_message: str
