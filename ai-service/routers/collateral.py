"""POST /collateral/detect — synchronous collateral type detection endpoint."""
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException

from config import Settings, get_settings
from schemas.collateral import CollateralDetectRequest, CollateralDetectResponse
from workers.collateral_detector import detect

router = APIRouter()
logger = logging.getLogger(__name__)


def _verify_internal_secret(
    x_ai_internal_secret: Annotated[str | None, Header()] = None,
    settings: Settings = Depends(get_settings),
) -> None:
    if x_ai_internal_secret != settings.ai_internal_secret:
        raise HTTPException(status_code=401, detail="Invalid internal secret")


@router.post(
    "/detect",
    response_model=CollateralDetectResponse,
    dependencies=[Depends(_verify_internal_secret)],
)
async def detect_collateral(body: CollateralDetectRequest) -> CollateralDetectResponse:
    """
    Classify an AM message into a collateral type.
    Uses rule-based detection first, LLM fallback for ambiguous inputs.
    """
    logger.info("Detecting collateral type for engagement=%s", body.engagement_id)
    return await detect(body)
