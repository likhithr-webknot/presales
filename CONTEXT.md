# PROJECT-CONTEXT.md — Presales Orchestrator
*Loaded by all agents at the start of every session on this project.*
*Updated by the agent that made the change. Keep it current — stale context is worse than no context.*

---

## Project Overview
- **Name:** Presales Orchestrator
- **Client:** Webknot Technologies (internal product)
- **Status:** [ ] Planning | [ ] Design | [x] Development | [ ] QA | [ ] Live
- **Current Sprint:** Sprint 8 COMPLETE — Warden reviewed & passed ✅
- **Next Sprint:** Sprint 9 (real adapters — future-gated) OR Sprint 10 (hardening + deploy)
- **Branch:** `refactor/sprint`
- **Project path:** `/home/likhithrajup/.openclaw/workspace/projects/presales-orchestrator/`

---

## Sprints Completed

| Sprint | What | Status |
|--------|------|--------|
| Sprint 0 | Node scaffold, Prisma schema (11 models), Docker, Google SSO, BullMQ, WebSocket | ✅ Warden PASS |
| Sprint 1 | Engagement CRUD, intake parser, collateral detector, state machine, routing | ✅ Warden PASS |
| Sprint 1.5 | Python AI service scaffold (FastAPI, all routes, dispatcher, schemas) | ✅ |
| Sprint 2 | Research (Tavily+GPT-4o), Context Manager, Packaging (PPTX+MinIO), pipeline auto-advance | ✅ |
| Sprint 3 | Narrative (Claude), Technical (Claude), Multi-LLM Scorer, Gate machinery + reminders | ✅ |
| Sprint 4 | Case Study maker, Diff generator, Version control, Artifact download, Feedback router | ✅ |
| Sprint 5 | SOW Maker (11 sections, language validator), Dual approval (AM+DM) | ✅ |
| Sprint 6 | Cascade detector, Audit trail API, Unified status endpoint | ✅ Warden PASS |
| Sprint 7 | Full React frontend (Dashboard, Chat, Gates, Versions, Audit, Approvals, Admin stub) | ✅ Warden PASS |
| Sprint 8 | Admin panel (User mgmt, KB CRUD, System config, Email test, SOW templates) | ✅ Warden PASS |

**All 10 Python workers are real:** research, context, packaging, narrative, technical, scoring, casestudy, diffgen, sow, intake_parser, collateral_detector.

---

## Tech Stack
| Layer | Choice | Notes |
|-------|--------|-------|
| Backend API | Node.js + TypeScript (Express) | Auth, state machine, DB, WebSocket — **zero LLM calls** |
| AI Service | Python 3.11 + FastAPI | ALL LLM logic — agents, intake parsing, collateral detection |
| Frontend | React + Vite + TypeScript + react-query | Dashboard, engagement chat, gates, admin |
| Database | PostgreSQL + pgvector | All relational data + KB embeddings |
| Cache / Queue | Redis + BullMQ | Agent job queues |
| Auth | Google SSO (Passport.js + JWT cookie) | Roles: AM / DM / SALES_HEAD / REVIEWER / ADMIN |
| AI Tier 1 | OpenAI GPT-4o-mini | Intake parsing, collateral detection, diffgen |
| AI Tier 2 | OpenAI GPT-4o | Research synthesis, context manager, case study |
| AI Tier 3 | Anthropic Claude Sonnet 4.6 | Narrative, Technical, SOW Maker, coherence pass |
| AI Scoring | Claude + GPT-4o + Gemini (parallel) | Compliance scoring only |
| Service Bridge | HTTP Node→Python | POST /jobs/dispatch (async) + /intake/parse + /collateral/detect (sync) |
| Service Bridge | HTTP Python→Node | POST /api/internal/job-update (job completion callback) |
| Document Output | python-pptx, python-docx | Packaging Agent only |
| Storage | MinIO (self-hosted S3-compatible) | Artifacts, uploads, SOW templates |
| Email | Nodemailer + SMTP | Gate notifications, reminders |
| Admin | Custom React admin panel | Users, KB, config, email test, templates |

---

## Architecture (Non-Negotiable Rules)

1. **Node has zero LLM calls** — all AI in Python ai-service
2. **Orchestrator is the ONLY entry point** — no agent-to-agent direct calls
3. **Everything is JSON until last mile** — PPTX/DOCX generated only by Packaging Agent
4. **Adapter pattern for external systems** — MeetMinds, Pricing, KB all behind interface
5. **Async jobs with callback** — Python dispatches 202, calls back `POST /api/internal/job-update`
6. **Sync HTTP for intake/collateral** — Node waits for these before dispatching agents

---

## Key File Locations

### Backend
- `backend/src/routes/` — all Express routes
- `backend/src/agents/orchestrator/` — pipeline, cascade, feedback router
- `backend/src/services/` — ai-client, audit, websocket, storage, email
- `backend/src/jobs/` — gate reminder scheduler
- `backend/prisma/schema.prisma` — full DB schema (12 models, 3 enums)

### Python AI Service
- `ai-service/workers/` — all 10 real workers
- `ai-service/routers/` — jobs, intake, collateral endpoints
- `ai-service/workers/dispatcher.py` — WORKER_MAP routing

### Frontend
- `frontend/src/pages/` — Dashboard, Engagement, Approvals, Admin, Login
- `frontend/src/components/` — AgentFeed, GatePanel, PipelineProgress, CascadeBanner, AuditTimeline
- `frontend/src/hooks/` — useAuth, useEngagementStatus (WS + adaptive poll)
- `frontend/src/services/` — api.ts (typed axios client), socket.ts

---

## API Contract
See `INTERFACE.md` for the full route list + WebSocket events.

---

## Environment Variables
See `.env.example` for all required vars. Key ones:
- `DATABASE_URL` — Postgres connection string
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` — LLM providers (Python only)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google SSO
- `AI_SERVICE_URL` — Python service URL (docker: `http://ai-service:8000`, local: `http://localhost:8001`)
- `AI_INTERNAL_SECRET` — shared secret for Node↔Python auth
- `TAVILY_API_KEY` — web search for Research Agent

---

## Known Pending Items
- `prisma generate` must be run after any schema change (done as of Sprint 8)
- Sprint 9 (real adapters) is future-gated — MeetMinds++ API + Pricing Tool not ready yet
- Sprint 10 (hardening + deploy) — rate limiting, production docker, nginx, CI/CD
- Sentinel QA has not run yet — deferred to Sprint 10 pre-deploy

---

## Gate Status (Sprints)
- Sprints 0-8: WARDEN PASS ✅
- Sprints 0-8: SENTINEL PENDING ⏳
- Sprint 9: AUTHORIZED ✅ (future-gated on external systems)
- Sprint 10: AUTHORIZED ✅
