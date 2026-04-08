"""POST /intake/parse — synchronous intake parsing endpoint."""
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException

from config import Settings, get_settings
from schemas.intake import IntakeParseRequest, IntakeParseResponse
from workers.intake_parser import parse

router = APIRouter()
logger = logging.getLogger(__name__)


def _verify_internal_secret(
    x_ai_internal_secret: Annotated[str | None, Header()] = None,
    settings: Settings = Depends(get_settings),
) -> None:
    if x_ai_internal_secret != settings.ai_internal_secret:
        raise HTTPException(status_code=401, detail="Invalid internal secret")


@router.post(
    "/parse",
    response_model=IntakeParseResponse,
    dependencies=[Depends(_verify_internal_secret)],
)
async def parse_intake(body: IntakeParseRequest) -> IntakeParseResponse:
    """
    Parse an AM's freeform message into structured intake fields.
    Called synchronously by the Node /message route before dispatching agents.
    """
    logger.info("Parsing intake for engagement=%s", body.engagement_id)
    return await parse(body)
