"""
POST /jobs/dispatch — Node.js sends agent jobs here.
Worker runs as a FastAPI BackgroundTask so the response returns immediately (202 Accepted).
"""
import logging
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request

from config import Settings, get_settings
from schemas.job import DispatchRequest, DispatchResponse
from workers.dispatcher import dispatch

router = APIRouter()
logger = logging.getLogger(__name__)


def _verify_internal_secret(
    x_ai_internal_secret: Annotated[str | None, Header()] = None,
    settings: Settings = Depends(get_settings),
) -> None:
    """Reject requests that don't carry the shared internal secret."""
    if x_ai_internal_secret != settings.ai_internal_secret:
        raise HTTPException(status_code=401, detail="Invalid internal secret")


@router.post(
    "/dispatch",
    response_model=DispatchResponse,
    status_code=202,
    dependencies=[Depends(_verify_internal_secret)],
)
async def dispatch_job(
    request: Request,
    body: DispatchRequest,
    background_tasks: BackgroundTasks,
) -> DispatchResponse:
    """
    Accept a job from Node.js and dispatch it to the appropriate Python worker.
    Returns 202 immediately — worker runs in background.
    Node is notified of completion/failure via POST /api/internal/job-update.
    """
    http_client = request.app.state.http_client
    background_tasks.add_task(dispatch, body, http_client)

    logger.info("Accepted job %s (type=%s)", body.job_id, body.job_type)
    return DispatchResponse(job_id=body.job_id)
