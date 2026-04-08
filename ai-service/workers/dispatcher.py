"""
Job dispatcher — routes jobType → correct worker coroutine.
Node.js sends a DispatchRequest; this module picks the right worker.
"""
import logging
from typing import Any

import httpx

# ── Worker imports (module level — fail fast on startup if a worker has a syntax error) ──
from workers.research import run as research_run
from workers.context_manager import run as context_run
from workers.packaging import run as packaging_run
from workers.narrative import run as narrative_run
from workers.technical import run as technical_run
from workers.scorer import run as scorer_run
from workers.case_study import run as case_study_run
from workers.diffgen import run as diffgen_run
from workers.sow_maker import run as sow_run
from workers.stub_worker import run as stub_run

from config import get_settings
from schemas.job import DispatchRequest, JobCallback, JobStatus

logger = logging.getLogger(__name__)

# Maps job type string → worker coroutine
WORKER_MAP = {
    "research":  research_run,   # Sprint 2 ✅
    "context":   context_run,    # Sprint 2 ✅
    "packaging": packaging_run,  # Sprint 2 ✅
    "narrative": narrative_run,  # Sprint 3 ✅
    "technical": technical_run,  # Sprint 3 ✅
    "scoring":   scorer_run,     # Sprint 3 ✅
    "casestudy": case_study_run, # Sprint 4 ✅
    "diffgen":   diffgen_run,    # Sprint 4 ✅
    "sow":       sow_run,        # Sprint 5 ✅
    # "pricing":  pricing_run,   # Sprint 9 — external system not built yet
    # All other types fall through to stub_run
}


async def _send_callback(http_client: httpx.AsyncClient, callback: JobCallback) -> None:
    """
    Notify Node.js backend that a job has completed or failed.
    Fire-and-forget: log errors but don't raise — we can't retry Node being down.
    """
    settings = get_settings()
    url = f"{settings.backend_url}/api/internal/job-update"
    try:
        resp = await http_client.post(url, json=callback.model_dump())
        if resp.status_code not in (200, 204):
            logger.error(
                "Job callback to Node returned %s for job %s: %s",
                resp.status_code, callback.job_id, resp.text[:200],
            )
    except httpx.RequestError as exc:
        logger.error("Failed to reach Node callback for job %s: %s", callback.job_id, exc)


async def _dispatch_to_worker(
    request: DispatchRequest,
    http_client: httpx.AsyncClient,
) -> None:
    """Route the job to the correct worker and send callback when done."""
    job_id = request.job_id
    job_type = request.job_type.value

    # Notify Node: job is now running
    await _send_callback(http_client, JobCallback(
        job_id=job_id,
        status=JobStatus.RUNNING,
        agent_name=job_type,
    ))

    try:
        worker = WORKER_MAP.get(job_type, stub_run)
        output = await worker(request.payload, request.engagement_id)

        await _send_callback(http_client, JobCallback(
            job_id=job_id,
            status=JobStatus.COMPLETED,
            output=output,
            agent_name=job_type,
        ))

    except Exception as exc:
        logger.exception("Worker %s failed for job %s", job_type, job_id)
        await _send_callback(http_client, JobCallback(
            job_id=job_id,
            status=JobStatus.FAILED,
            error=str(exc),
            agent_name=job_type,
        ))


async def dispatch(request: DispatchRequest, http_client: httpx.AsyncClient) -> None:
    """
    Entry point called by the /jobs/dispatch route.
    Runs the worker as a background task — returns immediately to the caller.
    """
    logger.info("Dispatching job %s (type=%s, engagement=%s)",
                request.job_id, request.job_type, request.engagement_id)
    await _dispatch_to_worker(request, http_client)
