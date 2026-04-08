"""
Presales AI Service — FastAPI application entry point.

All LLM agent logic lives here. Node.js backend delegates AI work via HTTP.
"""
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from routers import collateral, intake, jobs

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup and shutdown logic."""
    settings = get_settings()

    # Validate LLM API keys on startup — fail fast rather than at first job
    logger.info("🚀 Starting Presales AI Service...")
    logger.info(f"   Environment: {settings.environment}")
    logger.info(f"   Cheap model: {settings.llm_cheap_model}")
    logger.info(f"   Mid model:   {settings.llm_mid_model}")
    logger.info(f"   Premium model: {settings.llm_premium_model}")
    logger.info(f"   Backend URL: {settings.backend_url}")

    # Create shared HTTP client for backend callbacks
    app.state.http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(settings.backend_callback_timeout),
        headers={"x-ai-internal-secret": settings.ai_internal_secret},
    )

    logger.info("✅ AI Service ready")
    yield

    # Cleanup
    await app.state.http_client.aclose()
    logger.info("👋 AI Service shutting down")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Presales AI Service",
        description="LLM agent layer for the Presales Orchestrator platform",
        version="0.1.0",
        lifespan=lifespan,
    )

    # CORS — only allow the backend service (internal)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.backend_url],
        allow_methods=["POST", "GET"],
        allow_headers=["*"],
    )

    # ── Routers ───────────────────────────────────────────────────────────────
    app.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
    app.include_router(intake.router, prefix="/intake", tags=["intake"])
    app.include_router(collateral.router, prefix="/collateral", tags=["collateral"])

    # ── Health ────────────────────────────────────────────────────────────────
    @app.get("/health")
    async def health() -> dict:
        return {
            "status": "ok",
            "service": "presales-ai-service",
            "version": "0.1.0",
        }

    return app


app = create_app()
