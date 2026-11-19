"""Learning endpoints used by the Node backend (shared-secret auth, like /jobs)."""
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from config import Settings, get_settings
from learning.lint import LintResult, lint_lesson
from learning.proposer import FeedbackEventIn, ProposeResult, propose_lessons
from llm import AnthropicClient

router = APIRouter()


def _auth(x_ai_internal_secret: Annotated[str | None, Header()] = None, s: Settings = Depends(get_settings)) -> None:
    if x_ai_internal_secret != s.ai_internal_secret:
        raise HTTPException(status_code=401, detail="Invalid internal secret")


class ProposeRequest(BaseModel):
    events: list[FeedbackEventIn] = Field(max_length=300)
    existing_lessons: list[str] = Field(default_factory=list)
    forbidden_terms: list[str] = Field(default_factory=list)


class LintRequest(BaseModel):
    text: str
    category: str
    forbidden_terms: list[str] = Field(default_factory=list)


@router.post("/propose", response_model=ProposeResult, dependencies=[Depends(_auth)])
async def propose(body: ProposeRequest) -> ProposeResult:
    return await propose_lessons(
        AnthropicClient(), body.events, existing=body.existing_lessons, forbidden_terms=body.forbidden_terms,
    )


@router.post("/lint", response_model=LintResult, dependencies=[Depends(_auth)])
async def lint(body: LintRequest) -> LintResult:
    return lint_lesson(body.text, body.category, body.forbidden_terms)
