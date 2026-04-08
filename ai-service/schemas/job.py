"""Schemas for job dispatch and callback between Node.js and Python AI service."""
from enum import Enum
from typing import Any
from pydantic import BaseModel, Field


class JobType(str, Enum):
    """All job types the AI service handles. Mirrors BullMQ queue names in Node."""
    RESEARCH       = "research"
    CONTEXT        = "context"
    CASE_STUDY     = "casestudy"
    SOW            = "sow"
    NARRATIVE      = "narrative"
    TECHNICAL      = "technical"
    PACKAGING      = "packaging"
    PRICING        = "pricing"
    SCORING        = "scoring"
    EMAIL          = "email"
    DIFFGEN        = "diffgen"


class JobStatus(str, Enum):
    QUEUED     = "QUEUED"
    RUNNING    = "RUNNING"
    COMPLETED  = "COMPLETED"
    FAILED     = "FAILED"


class DispatchRequest(BaseModel):
    """Payload Node.js sends to POST /jobs/dispatch."""
    job_id: str = Field(..., description="AgentJob DB ID for status tracking")
    engagement_id: str = Field(..., description="Parent engagement ID")
    job_type: JobType = Field(..., description="Which agent to invoke")
    payload: dict[str, Any] = Field(default_factory=dict, description="Agent-specific input data")


class JobCallback(BaseModel):
    """Payload Python sends to Node's POST /api/internal/job-update."""
    job_id: str
    status: JobStatus
    output: dict[str, Any] | None = None
    error: str | None = None
    agent_name: str | None = None


class DispatchResponse(BaseModel):
    """Response from POST /jobs/dispatch."""
    accepted: bool = True
    job_id: str
    message: str = "Job dispatched to worker"
