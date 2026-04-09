"""
Configuration for the Presales AI Service.
All settings are loaded from environment variables with strict validation on startup.
"""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_SERVICE_DIR = Path(__file__).resolve().parent
_REPO_ROOT_ENV = _SERVICE_DIR.parent / ".env"
_LOCAL_ENV = _SERVICE_DIR / ".env"


def _dotenv_files() -> tuple[str | Path, ...]:
    """Prefer ai-service/.env, then repo-root .env (so `uvicorn` from ai-service/ still finds keys)."""
    files: list[Path] = []
    if _LOCAL_ENV.is_file():
        files.append(_LOCAL_ENV)
    if _REPO_ROOT_ENV.is_file():
        files.append(_REPO_ROOT_ENV)
    return tuple(files) if files else (".env",)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_dotenv_files(),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── LLM API Keys ──────────────────────────────────────────────────────────
    openai_api_key: str
    anthropic_api_key: str = ""
    gemini_api_key: str = ""

    # ── Service Communication ─────────────────────────────────────────────────
    # URL that ai-service uses to call back into the Node backend
    backend_url: str = "http://backend:3000"

    # Shared secret for internal service-to-service auth
    ai_internal_secret: str

    # ── Server ────────────────────────────────────────────────────────────────
    port: int = 8000
    environment: str = "development"

    # ── LLM Model Config ─────────────────────────────────────────────────────
    # Cheap tier (intake parsing, collateral detection, summaries)
    llm_cheap_model: str = "gpt-4o-mini"

    # Mid tier (research synthesis, case studies, drafts)
    llm_mid_model: str = "gpt-4o"

    # Premium tier (narrative, SOW, technical architecture)
    llm_premium_model: str = "gpt-4o"

    # ── Web Search
    tavily_api_key: str = ""
    search_provider: str = "tavily"  # tavily | brave
    brave_api_key: str = ""

    # ── Timeouts ──────────────────────────────────────────────────────────────
    # How long to wait on backend callback before giving up (seconds)
    backend_callback_timeout: int = 10

    # Max LLM response timeout (seconds)
    llm_timeout: int = 120


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance. Call once at startup."""
    return Settings()
