"""
Job dispatcher — routes jobType → correct worker coroutine.
Node.js sends a DispatchRequest; this module picks the right worker.
"""
import logging
from typing import Any

import httpx

from config import get_settings
from schemas.job import DispatchRequest, JobCallback, JobStatus

logger = logging.getLogger(__name__)


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


# ── Individual worker imports ─────────────────────────────────────────────────
# Real workers are imported here. Stubs are used for unimplemented types.

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
        output = await _run_worker(request, http_client)

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


async def _run_worker(
    request: DispatchRequest,
    http_client: httpx.AsyncClient,
) -> dict[str, Any]:
    """
    Route to the appropriate worker. Add imports here as real agents are built.
    """
    from workers.stub_worker import run as stub_run

    job_type = request.job_type.value

    # Sprint 2+ — replace stub imports with real worker imports as they're built:
    # from workers.research import run as research_run
    # from workers.context_manager import run as context_run
    # etc.

    from workers.research import run as research_run
    from workers.context_manager import run as context_run
    from workers.packaging import run as packaging_run

    worker_map = {
        "research":  research_run,   # Sprint 2 ✅
        "context":   context_run,    # Sprint 2 ✅
        "packaging": packaging_run,  # Sprint 2 ✅
        # "narrative": narrative_run,   # Sprint 3
        # "technical": technical_run,   # Sprint 3
        # "scoring":   scorer_run,      # Sprint 3
        # "casestudy": case_study_run,  # Sprint 4
        # "sow":       sow_run,         # Sprint 5
        # All other types fall through to stub_run
    }

    worker = worker_map.get(job_type, stub_run)
    return await worker(request.payload, request.engagement_id)


async def dispatch(request: DispatchRequest, http_client: httpx.AsyncClient) -> None:
    """
    Entry point called by the /jobs/dispatch route.
    Runs the worker as a background task — returns immediately to the caller.
    """
    logger.info("Dispatching job %s (type=%s, engagement=%s)",
                request.job_id, request.job_type, request.engagement_id)
    await _dispatch_to_worker(request, http_client)
