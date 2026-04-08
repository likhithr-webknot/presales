# SPRINTS.md — Presales Orchestrator
*Sprint Plan | Version 1.0 | April 2026*
*Written by Kira 📋 | Reviewed by Goku | Awaiting sign-off*

---

## Planning Notes

### Future-Scoped Integrations (Stub → Real Pattern)
Three external systems are NOT yet built or fully defined. The platform is designed to work without them from Day 1 via stub adapters. Real implementations slot in via Sprint 9 when those systems are ready.

| External System | Status | Stub Behaviour | Real Swap Sprint |
|----------------|--------|---------------|-----------------|
| MeetMinds++ API | No API exists yet | Returns hardcoded transcript JSON | Sprint 9 |
| Estimation & Pricing Tool | LLM-based, output schema TBD | Returns hardcoded BOM structure | Sprint 9 |
| Webknot Knowledge Base | Doesn't exist yet | File-based capability stubs, empty project/case study lists | Sprint 9 |

**Rule:** Every sprint treats these as black-box adapters. Forge never hardcodes assumptions about their internals. The adapter interface is the only contract.

### Agent & Frontend Dependency Map
```
Sprint 0: Infra + skeleton
Sprint 1: Orchestrator brain (no agents yet — Node only)
Sprint 1.5: Python AI Service scaffold (ai-service/, HTTP bridge, real intake parser + collateral detector)
Sprint 2: Stage 1 + 2 working end-to-end (Python agents: Research + Context + Packaging)
Sprint 3: Stage 3 backbone (Narrative + Technical + Gate machinery)
Sprint 4: Stage 3 complete (Case Study + Pricing wiring + Defense)
Sprint 5: Stage 5 (SOW Maker)
Sprint 6: Governance layer (versions, audit, cascade, diff)
Sprint 7: Full frontend
Sprint 8: Admin + ops panel
Sprint 9: Real adapter implementations (future-scoped)
Sprint 10: Hardening, security, deployment
```

### Team Assignments
- **Forge** — All backend work (agents, routes, jobs, services, DB)
- **Nova** — All frontend work (starts Sprint 7, reads INTERFACE.md written by Forge)
- **Warden** — Code review after every sprint (REVIEW_PASS required before next sprint)
- **Sentinel** — QA after every sprint (QA_PASS required before next sprint)
- **Kira** — Updates SPRINT-STATUS.md after each sprint

---

## Sprint 0 — Skeleton & Infrastructure
**Owner:** Forge
**Goal:** Runnable project scaffold. No features yet — but everything stands up, connects, and is ready for Sprint 1 to add logic into.

### Backend Tasks

**S0-B-01 — Monorepo + TypeScript scaffold**
- Init `backend/` with Node.js + TypeScript + Express
- Init `frontend/` with React + Vite + TypeScript
- Configure `tsconfig.json`, `eslint`, `prettier` for both
- Root `docker-compose.yml` with Postgres, Redis, MinIO services
- Root `.env.example` from LLD env manifest
- AC: `docker-compose up` starts all infra services cleanly

**S0-B-02 — Prisma schema + migrations**
- Implement full Prisma schema from LLD Section 1
- Write initial migration SQL including pgvector extension + KnowledgeBaseEntry embedding column
- Seed script with: 1 ADMIN user, sample SystemConfig rows (gate_reminder_hours=24, min_reviewer_count=1, compliance_variance_threshold=1.0)
- AC: `prisma migrate dev` runs clean; `prisma db seed` populates seed data

**S0-B-03 — Config + env validation**
- `src/config/env.ts` — Zod schema validating all env vars from LLD manifest
- Fail fast on startup if required vars missing (clear error message listing what's absent)
- `src/config/redis.ts` — BullMQ-compatible Redis connection
- `src/config/storage.ts` — MinIO client with bucket auto-creation on startup
- AC: App refuses to start with missing required env vars; logs clear error

**S0-B-04 — Google SSO + JWT auth**
- Passport.js Google OAuth2 strategy
- JWT in httpOnly cookie (7d expiry, configurable)
- `GET /auth/google`, `GET /auth/google/callback`, `POST /auth/logout`, `GET /auth/me`
- `ALLOWED_GOOGLE_DOMAINS` env var: if set, reject accounts outside the domain
- AC: Login flow completes; `/auth/me` returns user + roles; logout clears cookie

**S0-B-05 — RBAC middleware**
- `auth.middleware.ts` — validates JWT, attaches `req.user` with roles
- `rbac.middleware.ts` — `requireRole(...roles)` middleware factory
- `engagement-access.ts` — checks user is a participant on the specific engagement
- AC: Protected routes return 401 without JWT; 403 with wrong role

**S0-B-06 — BullMQ queue setup + worker registration**
- All 11 queues defined from LLD (research, context, casestudy, sow, narrative, technical, packaging, pricing, scoring, email, diffgen)
- Worker files created as stubs (log "STUB: [queue] job received", mark complete)
- QueueEvents listeners emit DB status updates (QUEUED → RUNNING → COMPLETED/FAILED)
- AC: Enqueue a test job on any queue; worker logs receipt; DB AgentJob row updates

**S0-B-07 — WebSocket server**
- Socket.io server on same Express HTTP server
- Room management: `engagement:${id}` rooms
- Auth: socket handshake validates JWT cookie
- Typed event emitter helpers from LLD Section 7
- AC: Authenticated client joins room; server emits test event; client receives it

**S0-B-08 — MinIO bucket initialisation**
- On startup: create 4 buckets if not exist (uploads, artifacts, templates, exports)
- Storage service with: `put(bucket, key, buffer)`, `get(bucket, key)`, `presignedUrl(bucket, key, ttlHours)`, `delete(bucket, key)`
- AC: File upload via storage service; presigned URL returns accessible file

**S0-B-09 — Adapter factory (all stubs)**
- `src/adapters/factory.ts` reads env vars (`MEETMINDS_ADAPTER`, `PRICING_ADAPTER`, `KB_ADAPTER`)
- Returns stub implementations when set to `stub` (default)
- Returns `real.ts` implementation when set to `real` (real files exist but are empty stubs that throw `NotImplementedError` with clear message)
- AC: Factory returns correct adapter based on env; stub runs without error; real throws `NotImplementedError` with message "Replace with real implementation when [system] API is available"

**S0-B-10 — Global error handler + health check**
- `error.middleware.ts` — catches all unhandled errors, formats consistent JSON error response
- `GET /health` — returns `{ status: 'ok', timestamp, services: { db, redis, storage } }`
- AC: Throwing in a route returns `{ error, message, statusCode }`; `/health` reports service connectivity

### Frontend Tasks

**S0-F-01 — React app scaffold**
- Vite + React + TypeScript baseline
- React Router v6 setup with routes: `/login`, `/dashboard`, `/engagements/:id`, `/approvals/:token`, `/admin`
- Auth guard: redirect to `/login` if no JWT cookie
- AC: App loads; unauthenticated user lands on `/login`; authenticated user on `/dashboard`

**S0-F-02 — Login page**
- Google SSO button → redirects to `/auth/google`
- Handles OAuth2 callback redirect
- AC: Clicking "Sign in with Google" initiates OAuth2 flow

---

## Sprint 1 — Orchestrator Core
**Owner:** Forge
**Goal:** The Orchestrator brain is working. AM can create engagements, send messages, and the Orchestrator correctly parses intent, detects collateral type, and tracks state. No actual agent work yet — but the routing + state machine logic is solid.

**S1-B-01 — Engagement CRUD routes**
- `POST /api/engagements` — create with validation
- `GET /api/engagements` — list with role-based filtering + pagination
- `GET /api/engagements/:id` — full engagement + active jobs + current version
- `PATCH /api/engagements/:id` — update metadata
- `DELETE /api/engagements/:id` — ADMIN only, soft delete
- AC: CRUD operations work; AM only sees own engagements; ADMIN sees all

**S1-B-02 — Document upload routes**
- `POST /api/uploads` — multer multipart, store in MinIO `presales-uploads/`, create EngagementUpload record
- PDF/DOCX/XLSX text extraction service (`document-parser.ts`) using `pdf-parse` and `mammoth`
- Extracted text stored in `parsedContent` JSON field
- `GET /api/uploads/:id`, `DELETE /api/uploads/:id`
- AC: Upload PDF; record created in DB; `parsedContent` contains extracted text

**S1-B-03 — Intake parser**
- `src/agents/orchestrator/intake-parser.ts`
- GPT-5 Mini prompt: extract structured fields from freeform AM message
- Output: `{ clientName?, domain?, opportunityContext?, contactDetails?, collateralType?, stage?, missingFields[], rawMessage }`
- `missingFields[]` = which required fields for the detected collateral type are still absent
- AC: "I need a deck for Acme Corp, they're in retail, meeting next Tuesday" → extracts clientName=Acme Corp, domain=retail, flags missing=opportunityContext

**S1-B-04 — Collateral type detector**
- `src/agents/orchestrator/collateral-detector.ts`
- GPT-5 Mini classification: given AM message, return CollateralType enum value
- Fallback rules (no LLM): if message contains "proposal" → TECHNICAL_PROPOSAL, "SOW" → STATEMENT_OF_WORK, etc.
- AC: "Build a proposal for Cenomi" → TECHNICAL_PROPOSAL; "Prep me for a first meeting with Paytm" → FIRST_MEETING_DECK

**S1-B-05 — Engagement state machine**
- `src/agents/orchestrator/state-machine.ts`
- Valid transitions: INITIATED → RESEARCH_COMPLETE → PROPOSAL_IN_PROGRESS → UNDER_REVIEW → APPROVED → DELIVERED
- BLOCKED can be entered from any state; exits to prior state on resolution
- Illegal transitions throw `InvalidTransitionError` (logged to AuditLog)
- AC: Valid transition succeeds + AuditLog row written; invalid transition throws error

**S1-B-06 — /message route + orchestrator dispatch**
- `POST /api/engagements/:id/message`
- Intake parser → collateral detector → gap check → if gaps: return follow-up question(s)
- If complete: create AgentJob records → enqueue to correct queues (stub workers for now)
- WebSocket: `job_started` events fired per agent
- AC: Sending message with complete context creates AgentJob rows in DB + enqueues BullMQ jobs + WS events fire

**S1-B-07 — Orchestrator routing map**
- `src/agents/orchestrator/routing.ts`
- Maps collateral type + stage → array of agents to invoke, in order, with parallelism annotations
- Example: Stage 1 → `[{ agents: ['SECONDARY_RESEARCH', 'CONTEXT_MANAGER'], parallel: true }, { agents: ['PACKAGING_AGENT'], parallel: false }]`
- AC: Each collateral type returns correct agent sequence per HLD Section 3

**S1-B-08 — Context carry-forward**
- `src/agents/orchestrator/context-builder.ts`
- Given `engagementId` + target stage: loads prior stage artifacts from EngagementVersion, structures carry-forward bundle
- Stage 1→2: research brief + webknot context; Stage 2→3: all prior + call notes; Stage 3→4+5: approved proposal artifacts
- AC: Advancing to Stage 2 auto-includes Stage 1 research output in the context bundle

**S1-B-09 — Advance stage route**
- `POST /api/engagements/:id/advance-stage` with `{ toStage }`
- Validates current stage is complete (no pending jobs, no open gates)
- Loads carry-forward context → attaches to new stage context bundle
- AC: Cannot advance with pending jobs; advancing loads prior context; AuditLog records transition

**S1-B-10 — Audit logger**
- `src/services/audit/logger.ts` — thin wrapper around Prisma AuditLog insert
- Called from: state machine transitions, gate events, version creation, agent job lifecycle
- AC: Key actions produce AuditLog rows with correct userId, action, detail JSON

---

## Sprint 1.5 — Python AI Service Scaffold ✅ COMPLETE (2026-04-08)
**Owner:** Forge
**Goal:** Introduce the Python `ai-service/` alongside the Node backend. All LLM logic moves to Python. Node gets a thin HTTP bridge. Intake parser + collateral detector are ported to real Python implementations.

**S1.5-AI-01 — ai-service/ project scaffold** ✅
- `ai-service/pyproject.toml` — Poetry: fastapi, uvicorn, httpx, pydantic-settings, openai, anthropic, google-generativeai
- `ai-service/Dockerfile` — Python 3.11-slim
- `docker-compose.yml` updated with `ai-service` container (port 8001 external / 8000 internal)
- `.env.example` updated with `AI_SERVICE_URL`, `AI_INTERNAL_SECRET`, LLM API keys
- AC: `docker-compose up` starts ai-service; `GET /health` returns `{ status: ok }`

**S1.5-AI-02 — FastAPI app structure** ✅
- `ai-service/main.py` — FastAPI app with lifespan context manager
- `ai-service/config.py` — Pydantic BaseSettings (fail-fast on startup)
- `ai-service/routers/jobs.py` — POST /jobs/dispatch (async, 202 Accepted)
- `ai-service/routers/intake.py` — POST /intake/parse (sync)
- `ai-service/routers/collateral.py` — POST /collateral/detect (sync)
- AC: POST /jobs/dispatch with valid payload returns 202; health endpoint returns ok

**S1.5-AI-03 — Pydantic schemas** ✅
- `ai-service/schemas/job.py` — DispatchRequest, JobCallback, JobStatus, JobType enum
- `ai-service/schemas/intake.py` — IntakeParseRequest/Response, ParsedFields
- `ai-service/schemas/collateral.py` — CollateralType enum, CollateralDetectRequest/Response
- AC: All schemas importable; Pydantic v2 syntax throughout

**S1.5-AI-04 — Worker dispatcher + stub worker** ✅
- `ai-service/workers/dispatcher.py` — routes jobType → worker coroutine; sends RUNNING + COMPLETED/FAILED callbacks to Node
- `ai-service/workers/stub_worker.py` — generic stub for all unimplemented job types
- All 11 job types registered (research, context, casestudy, sow, narrative, technical, packaging, pricing, scoring, email, diffgen)
- AC: Any jobType dispatched → stub runs → Node callback called with COMPLETED status

**S1.5-AI-05 — Node.js bridge updates** ✅
- `backend/src/services/ai-client.ts` — new HTTP client: parseIntake(), detectCollateral(), dispatchJob()
- `backend/src/agents/orchestrator/intake-parser.ts` — replaced OpenAI calls with aiClient.parseIntake()
- `backend/src/agents/orchestrator/collateral-detector.ts` — replaced OpenAI calls with aiClient.detectCollateral()
- `backend/src/services/llm/router.ts` — gutted; deprecation notice; no LLM logic remains
- `backend/src/config/env.ts` — removed LLM API keys; added AI_SERVICE_URL + AI_INTERNAL_SECRET
- AC: POST /api/engagements/:id/message still works end-to-end; intake parsing done by Python

**S1.5-AI-06 — Python intake parser (real)** ✅
- `ai-service/workers/intake_parser.py` — real GPT-4o-mini call, structured JSON output
- Extracts: clientName, domain, opportunityContext, contactDetails, collateralType, stage, missingFields[]
- Merges with existing context (existing fields win)
- Generates natural follow-up question for missing fields
- AC: "I need a deck for Acme Corp, retail sector" → structured ParsedFields returned

**S1.5-AI-07 — Python collateral detector (real)** ✅
- `ai-service/workers/collateral_detector.py` — rule-based fast path + GPT-4o-mini LLM fallback
- Rules cover 8 patterns (SOW, proposal, defense, first meeting, etc.)
- LLM only fires for ambiguous inputs
- AC: "Build a proposal for Cenomi" → TECHNICAL_PROPOSAL (rule); ambiguous input → LLM classifies

**S1.5-AI-08 — Docker wiring** ✅
- `docker-compose.yml` ai-service: build ./ai-service, healthcheck, depends_on postgres + redis
- backend service: depends_on ai-service (waits for health before starting)
- AC: `docker-compose up` starts all services in correct order

---

## Sprint 2 — Stage 1 & 2: Research + Context + Packaging
**Owner:** Forge
**Goal:** Full end-to-end flow for Stage 1 (First Meeting Deck) and Stage 2 (Post-Discovery Deck) works. AM can submit a request and receive a generated PPTX.

**⚠️ IMPORTANT — Sprint 2 builds Python workers, not Node.js workers.**
All agent logic goes in `ai-service/workers/`. The Node.js BullMQ workers already exist as stubs that call `aiClient.dispatchJob()`. Do NOT add LLM logic to Node.

**S2-AI-01 — Secondary Research Agent (Python)**
- `ai-service/workers/research.py` — async worker consuming `research` job type
- Web search via Tavily API (env: `TAVILY_API_KEY`) or Brave Search (`SEARCH_PROVIDER` env configurable)
- Register in `workers/dispatcher.py` worker_map once built
- `search.ts`: construct 4-6 targeted queries from clientName + domain + opportunityContext
- `synthesizer.ts`: GPT-5.1 synthesis of search results → ResearchBrief schema (LLD Section 5.1)
- Depth scaling: `light` (3-5 sources), `medium` (5-10), `deep` (10-20)
- Confidence scoring: if fewer than minimum sources found → `confidence: 'low'` + warnings[]
- AC: Research job completes; output matches ResearchBrief schema; low-confidence cases populate warnings[]

**S2-B-02 — Webknot Context Manager**
- `src/agents/context-manager/index.ts` — BullMQ worker consuming `context-queue`
- `retriever.ts`: calls KnowledgeBaseAdapter (stub returns placeholder capabilities + empty projects)
- `positioning-gen.ts`: GPT-5.1 generates positioning narrative from KB results + prospect context
- Graceful degradation: if KB returns empty → surface warning "No matching projects found; using general positioning"
- AC: Context job completes with WebknotContextOutput schema; stub KB returns placeholder without error; warning populated when KB empty

**S2-B-03 — MeetMinds++ Adapter wiring**
- Wire MeetMindsAdapter into the Orchestrator dispatch for Stage 2
- `POST /api/engagements/:id/meetminds-reference` — AM provides meetingId or manual transcript
- If meetingId: adapter.getTranscript() → store as EngagementUpload (type: OTHER, parsedContent: structured MeetMindsOutput)
- If manual: AM pastes transcript → GPT-5 Mini extracts MeetMindsOutput fields from raw text
- AC: Stub adapter returns mock output; manual transcript path extracts structured fields; both stored correctly

**S2-B-04 — Packaging Agent (Stage 1 + 2)**
- `src/agents/proposal/packaging/index.ts` — BullMQ worker consuming `packaging-queue`
- `pptx-generator.ts`: PptxGenJS — map section JSON to slides; apply Webknot brand (dark navy headers, cyan accents)
- `docx-generator.ts`: docxtemplater — populate DOCX template from section JSON
- `quality-checker.ts`: scan output for `{{`, `[[`, `TBD`, `INSERT`, `PLACEHOLDER`; verify no tracked changes
- Upload final file to MinIO `presales-artifacts/`; return presigned URL (24h TTL)
- AC: Stage 1 content JSON → PPTX with correct branding; quality checker catches placeholder text; MinIO URL returned

**S2-B-05 — Stage 1 end-to-end flow**
- Wire Research + Context (parallel) → Packaging (sequential after both complete)
- BullMQ job dependency: packaging job waits for both research + context job IDs to be in COMPLETED state
- WebSocket events fire at each step: job_started, job_completed per agent, artifact_ready at end
- AC: Full Stage 1 flow from message to PPTX download URL; WS events in correct order

**S2-B-06 — Stage 2 end-to-end flow**
- Wire MeetMinds++ retrieval → Research (medium) + Context + Case Study Maker (parallel) → Packaging
- Case Study Maker stub: returns empty array (KB not populated yet); Orchestrator surfaces "No relevant case studies found" gracefully
- AC: Full Stage 2 flow completes; empty case study list handled without error

**S2-B-07 — Job status + feedback routes**
- `GET /api/jobs/:jobId` — status, progress, output summary
- `POST /api/jobs/:jobId/retry` — re-enqueue failed job
- `POST /api/engagements/:id/feedback` — AM natural language feedback → Orchestrator routes to correct agent queue
- Feedback routing: "swap case study" → casestudy-queue; "change tone" → narrative-queue (future sprints); "shorten timeline" → packaging-queue
- AC: Retry works; feedback for Stage 1/2 routes to correct agent; new EngagementVersion created after revision

**Forge INTERFACE.md update required after this sprint** — document all routes + response shapes for Nova.

---

## Sprint 3 — Proposal Backbone (Stage 3 Gates)
**Owner:** Forge
**Goal:** Stage 3 core working — Narrative Agent, Technical Solution Agent, Gate 1 and Gate 2 machinery, multi-LLM compliance scoring, email notifications. This is the most complex sprint.

**S3-B-01 — Narrative Agent (positioning phase)**
- `src/agents/proposal/narrative/positioning.ts` — BullMQ worker, `narrative-queue`, phase=`positioning`
- Sonnet 4.6: given research brief + webknot context + call notes + AM instructions → produce NarrativePositioningOutput (LLD Section 5.3)
- Dynamic section structure: not a fixed template — agent determines optimal sections for this RFP/client
- Anti-pattern detection: flag vague language, unsubstantiated claims in proposed structure
- AC: Narrative job produces positioning + section structure JSON; narrative angle is explicitly stated; no fixed template assumed

**S3-B-02 — Multi-LLM Compliance Scorer**
- `src/services/llm/scorer.ts`
- Dispatch parallel jobs to Claude (Sonnet 4.6), GPT-5.1, Gemini
- Each scores dimensions 1-5 with reasoning
- Aggregator: mean, stdDev per dimension; flag HIGH_VARIANCE (stdDev > threshold from SystemConfig)
- Improvement suggestions for mean < 3 dimensions
- Return ComplianceMatrix schema (LLD Section 5.8)
- AC: 3 parallel scoring calls complete; variance flagged correctly; ComplianceMatrix matches schema

**S3-B-03 — Gate 1 machinery**
- `POST /api/engagements/:id/gates/GATE_1/submit`
- Triggers S3-B-02 scoring → stores ComplianceMatrix on GateApproval records
- Sends emails to AM + all assigned Reviewers (gate_review template)
- WebSocket: `gate_ready` event with complianceMatrix + reviewerEmails
- `POST /api/engagements/:id/gates/GATE_1/approve` — records approval/rejection per reviewer
- Checks min reviewer count (SystemConfig) → if met: advance to technical phase
- `POST /api/engagements/:id/gates/GATE_1/override` — AM override with justification → AuditLog
- AC: Gate 1 submit fires emails + WS; approval recorded; minimum count check works; override logs to AuditLog

**S3-B-04 — Gate reminder scheduler**
- `src/jobs/scheduler.ts` — checks every hour for gates in PENDING state older than `gate_reminder_hours`
- Enqueues email job (gate_reminder template) to AM
- WebSocket: `gate_reminder` event
- AC: Gate open > threshold hours triggers reminder email to AM; WS event fires

**S3-B-05 — Reviewer assignment routes**
- `POST /api/engagements/:id/gates/:gateNumber/assign-reviewer`
- Support alternate reviewer designation
- AC: Reviewer assigned to gate; email sent notifying them; alternate flag stored correctly

**S3-B-06 — Technical Solution Agent**
- `src/agents/proposal/technical/index.ts` — BullMQ worker, `technical-queue`
- Sonnet 4.6: parse requirements → design architecture → select tech stack → integration design → infrastructure → security → scalability → feature decomposition
- `architect.ts`: full solution design per LLD Section 5.4 output schema
- `decomposer.ts`: feature breakdown structured to match PricingInput schema (ready for Pricing Adapter)
- Feasibility flags: aggressive timeline → flag; over-scope → recommend phasing
- AC: Technical job produces TechnicalSolutionOutput; featureBreakdown is valid PricingInput-compatible structure

**S3-B-07 — Gate 2 machinery + cascade detection**
- Gate 2 submit/approve/override same mechanics as Gate 1
- `src/agents/orchestrator/cascade-detector.ts`
- After Gate 2 approve: check if technical solution changes impact Gate 1 positioning (e.g., tech stack pivot vs narrative promise)
- If cascade detected: WebSocket `cascade_detected` event + AuditLog entry; AM must acknowledge before proceeding
- AC: Gate 2 mechanics work; cascade detection fires when relevant; AM acknowledgement required before unblocking

**S3-B-08 — Pricing Adapter wiring**
- After Gate 2 approval: Orchestrator extracts featureBreakdown from TechnicalSolutionOutput → calls PricingAdapter.estimate()
- `pricing-queue` worker wraps adapter call
- `normalizer.ts`: coerce raw adapter output to PricingOutput schema; always preserve `rawLLMOutput`
- Cascade check: if totalCostINR > budget constraint → flag cascade → route back to Technical Agent for descoping
- AC: Pricing job calls stub adapter; PricingOutput schema returned; budget exceeded → cascade fires; descope loop routes back to technical-queue

**S3-B-09 — Gate 3 machinery**
- Same mechanics as Gates 1 + 2
- Gate 3 sends pricing summary + BOM as part of review package
- AM time-critical override: `{ skipReapproval: true, justification }` — Orchestrator skips full re-cycle
- AC: Gate 3 works; override-without-reapproval path logged to AuditLog; pricing figures included in review package

**S3-B-10 — Email service**
- `src/services/email/service.ts` — Nodemailer wrapper
- All 7 templates from LLD Section 8 implemented
- Config: all SMTP + FROM address from env vars; `EMAIL_ENABLED=false` skips sending in dev (logs to console instead)
- AC: All 7 templates render correctly; EMAIL_ENABLED=false logs without error; real send works with valid SMTP

---

## Sprint 4 — Proposal Complete (Case Studies + Coherence + Defense)
**Owner:** Forge
**Goal:** Stage 3 fully complete with case studies, coherence pass, and executive summary. Stage 4 Defense deck flow working.

**S4-B-01 — Case Study Maker**
- `src/agents/case-study/index.ts` — BullMQ worker, `casestudy-queue`
- `matcher.ts`: KnowledgeBaseAdapter.searchCaseStudies() → rank by domain + capability relevance
- `writer.ts`: GPT-5.1 generate tailored case study per LLD Section 5.5 output schema
- Angle adaptation: same project, different framing based on framingGuidance from Narrative Agent
- Anonymization: respect `isAnonymized` flag from KB entry
- Graceful degradation: empty KB → return `[]` with warning; Orchestrator surfaces gap to AM
- AC: Case study job runs; stub KB returns empty + warning; real KB entries produce tailored write-ups with correct framing

**S4-B-02 — Narrative Agent (content + coherence phases)**
- `src/agents/proposal/narrative/content.ts` — phase=`content`
- Sonnet 4.6: write section prose (openings, closings, connective tissue) + value proposition section
- Executive summary written LAST (after all sections complete)
- `src/agents/proposal/narrative/coherence.ts` — phase=`coherence_pass`
- Review all sections: consistent tone + terminology; story arc check; flag inconsistencies
- Output: `{ approved: boolean, flags: string[], revisedSections?: object }`
- AC: Content phase produces prose for all sections; coherence pass flags tone inconsistency correctly; inconsistency routes back to offending agent

**S4-B-03 — Proposal Maker coordinator**
- `src/agents/proposal/index.ts` — coordinates internal Proposal sequence
- Manages dependencies: Gate 1 locked → Technical + CaseStudy parallel → Gate 2 → Pricing → Gate 3 → Coherence → Packaging
- Detects missing case study domain → routes request to Case Study Maker via Orchestrator
- AC: Full Stage 3 sequence completes end-to-end; missing case study gap detected + surfaced to AM

**S4-B-04 — Stage 3 version control**
- Every gate approval + feedback iteration creates new EngagementVersion
- `diffgen-queue` worker: GPT-5 Mini generates plain-language diff summary between versions
- `GET /api/engagements/:id/versions/:v/diff` — returns diffSummary + changedSections
- AC: Each revision increments version; diff summary is human-readable; changedSections identifies which sections changed

**S4-B-05 — Stage 4 Defense deck flow**
- Orchestrator loads approved Stage 3 artifacts (context carry-forward)
- Context Manager (defense framing) → Packaging Agent (30-min PPTX + Q&A cheat sheet as separate artifact)
- Q&A cheat sheet: GPT-5.1 generates likely panel questions + suggested answers from proposal content
- Defense Gate: same mechanics as Gates 1-3; reviewer role = SALES_HEAD
- AC: Defense flow produces PPTX + Q&A DOCX; Defense Gate routes to SALES_HEAD role; stage gate mechanics identical to Proposal gates

**S4-B-06 — Artifact download routes**
- `GET /api/engagements/:id/artifacts/download?version=&format=`
- Returns presigned MinIO URL (24h TTL)
- Records download in AuditLog
- AC: Download URL works; 24h expiry; AuditLog records who downloaded when

---

## Sprint 5 — SOW Maker (Stage 5)
**Owner:** Forge
**Goal:** Full Stage 5 SOW generation working — section-by-section walkthrough with AM + DM dual approval.

**S5-B-01 — SOW Maker agent**
- `src/agents/sow-maker/index.ts` — BullMQ worker, `sow-queue`
- Loads approved proposal from EngagementVersion + SOW template from MinIO `presales-templates/`
- Default template: Webknot standard (uploaded to MinIO on first deployment); client template override if provided
- `sections.config.ts`: ordered section list with prompts per section
- `section-generator.ts`: Sonnet 4.6 generates each section one at a time
- After each section: WebSocket `sow_section_ready` event → wait for AM confirmation signal before proceeding
- AC: SOW sections generated in order; each fires WS event; worker pauses awaiting confirmation; template loading works for both Webknot default + client override

**S5-B-02 — Language validator**
- `src/agents/sow-maker/language-validator.ts`
- Banned word list: `ensure`, `make sure`, `all-encompassing`, `seamless`, `robust`, `world-class`, `best-in-class`, and any other vague non-measurable language
- Scanner runs on every generated section before WS event fires
- If banned words found: auto-revise with Sonnet 4.6 until clean (max 2 revision cycles)
- AC: Section with "ensure" is auto-revised; clean sections pass through; revision cycles capped

**S5-B-03 — SOW section confirmation route**
- `POST /api/engagements/:id/sow/sections/:sectionName/confirm` — AM confirms section
- `POST /api/engagements/:id/sow/sections/:sectionName/revise` with `{ feedback }` — AM requests revision
- Revision: re-enqueue section generation with feedback; WS event fires again on completion
- AC: Confirm advances to next section; revise triggers regeneration; sections cannot be skipped

**S5-B-04 — SOW dual approval**
- Once all sections confirmed: Orchestrator sends SOW for dual approval (AM + DM simultaneously)
- GateApproval records created for `SOW_AM` and `SOW_DM`
- SOW finalized only when BOTH approve
- Email: `sow_approval` template sent to both AM + DM
- AC: Both must approve before packaging; one approval alone does not finalize; email sent to both

**S5-B-05 — SOW packaging**
- Packaging Agent: docxtemplater populates Webknot SOW DOCX template or client template
- Quality checker runs (no placeholders, no vague language remnants)
- Upload to MinIO; presigned URL returned
- AC: Final SOW DOCX correct; all confirmed sections present; quality checks pass

---

## Sprint 6 — Governance Layer
**Owner:** Forge
**Goal:** Version history, audit trail, cascade detection, and diff view fully implemented. The governance backbone is solid.

**S6-B-01 — Version history routes**
- `GET /api/engagements/:id/versions` — list all versions with metadata
- `GET /api/engagements/:id/versions/:v` — full artifact JSON at that version
- `GET /api/engagements/:id/versions/:v/diff` — diff from previous version
- Version timeline includes: version number, timestamp, triggeredBy, changeReason, diffSummary
- AC: All versions accessible; diff endpoint returns human-readable summary; latest version flagged

**S6-B-02 — Cascade detection (full implementation)**
- `src/agents/orchestrator/cascade-detector.ts` — full logic
- Trigger: any gate approval → check if approved content contradicts earlier approved gate
- Detection rules:
  - Gate 2 solution changes tech stack significantly → may contradict Gate 1 narrative promises
  - Gate 3 pricing over budget → must descope solution (cannot inflate price) → Gate 2 re-check required
  - SOW scope changes vs approved proposal → flag for AM review
- `cascade_detected` WS event with `requiresReapproval` + `canOverride` flags
- AM override path: logs to AuditLog with justification
- AC: Budget exceeded triggers pricing cascade; tech stack pivot triggers narrative cascade; override path audited

**S6-B-03 — Engagement status surface route**
- `GET /api/engagements/:id/status` — structured status response:
  ```json
  {
    "stage": "STAGE_3",
    "status": "UNDER_REVIEW",
    "currentGate": "GATE_2",
    "gateStatus": { "pending": 2, "approved": 1, "total": 3 },
    "currentBlocker": "Waiting for reviewer approvals at Gate 2",
    "activeJobs": [...],
    "lastActivity": "2026-04-07T16:00:00Z"
  }
  ```
- AC: Status reflects real-time engagement state; blocker field populated when applicable

**S6-B-04 — Audit trail route**
- `GET /api/engagements/:id/audit` — paginated audit log for an engagement
- Fields: action, userId, timestamp, detail
- ADMIN only: `GET /api/audit` — system-wide audit log with filters
- AC: Audit log shows complete history; sensitive gate override events clearly labelled

**S6-B-05 — Agent failure handling (full implementation)**
- All workers: catch errors → update AgentJob.status = FAILED + AgentJob.error
- Orchestrator failure handler: classify RETRIABLE / PARTIAL / FATAL
- RETRIABLE: BullMQ auto-retry (3 attempts, exponential backoff 2s/4s/8s)
- PARTIAL / FATAL after retries: WebSocket `job_failed` event with options array
- `POST /api/jobs/:jobId/retry` — manual retry after AM selects option
- AC: Job failure after 3 retries fires WS event with 3 options; retry option re-enqueues; partial option advances with available output

---

## Sprint 7 — Full Frontend
**Owner:** Nova
**Prerequisite:** Forge has written `INTERFACE.md` after Sprint 6. Nova reads it before writing a single API call.
**Goal:** Complete frontend across all user flows. AM can use the platform end-to-end from browser.

**S7-F-01 — Dashboard page**
- Engagement list with status cards: clientName, domain, stage, status, currentBlocker
- Role-aware: AM sees own; ADMIN sees all with filters
- "New Engagement" button → opens intake chat
- AC: Dashboard loads; engagements filtered by role; status cards show correct state

**S7-F-02 — Intake chat UI**
- Conversational chat interface (not a form)
- AM types naturally; backend parses and asks follow-up questions for missing fields
- File upload zone: drag-drop RFP, requirement docs, Q&A spreadsheets
- "Start" button once Orchestrator confirms all required fields collected
- AC: Chat flow collects fields conversationally; follow-up prompts for missing fields; file upload stores to backend; Start triggers engagement creation

**S7-F-03 — Job status panel**
- Live agent progress feed (WebSocket `job_started`, `job_progress`, `job_completed`, `job_failed`)
- Agent names + human-readable progress messages
- `job_failed` renders option cards: Retry / Proceed / Manual Input — AM selects action
- AC: Jobs appear in real-time; failure shows option cards; selecting an option calls correct API

**S7-F-04 — Artifact review UI**
- Section-by-section artifact display once agents complete
- Each section independently editable via feedback input
- "Submit feedback" → sends to `/feedback` route → shows revision in progress
- Version badge: shows current version number; "View History" link
- AC: Sections display correctly; feedback submission triggers revision; version badge updates

**S7-F-05 — Gate review panel**
- Shows gate number, compliance matrix table (dimensions, scores per LLM, mean, variance flags)
- HIGH_VARIANCE areas highlighted with "⚠ Requires human judgment" label
- Improvement suggestions listed per low-scoring dimension
- Approve / Approve with feedback / Reject buttons
- Override button (AM only) with required justification text field
- AC: Compliance matrix renders correctly; variance flags visible; approval actions call correct routes; override requires justification

**S7-F-06 — Version history page**
- Timeline view of all versions
- Each version: version number, timestamp, who triggered, changeReason, diffSummary
- "Compare" button → side-by-side diff view of two selected versions
- AC: History loads; diff view shows changed sections; labels are human-readable

**S7-F-07 — SOW walkthrough UI**
- Section-by-section display (sections arrive via WebSocket `sow_section_ready`)
- "Confirm section" button + "Request revision" text input per section
- Progress indicator: "Section 4 of 14"
- Final dual-approval step: shows AM + DM approval status
- AC: Sections appear one at a time; confirm/revise actions work; dual approval status visible

**S7-F-08 — Reviewer approval page**
- Accessible via link in email (token-based, no login required for reviewers)
- Shows gate draft content + compliance matrix
- Approve / Approve with feedback / Reject
- AC: Link from email opens correctly without requiring full login; approval recorded; confirmation shown

**S7-F-09 — Cascade warning UI**
- Banner component: `CascadeWarningBanner` shown when `cascade_detected` WS event fires
- Shows: what changed, what earlier gate is affected, whether re-approval required
- AM acknowledges or triggers override
- AC: Banner appears on cascade event; acknowledge clears it; override opens justification modal

---

## Sprint 8 — Admin & Operations Panel
**Owner:** Nova (frontend) + Forge (any new backend routes needed)
**Goal:** ADMIN users can manage users, roles, knowledge base, system config, and email settings.

**S8-01 — User management UI**
- List users with roles
- Assign / revoke roles (AM, DM, SALES_HEAD, REVIEWER, ADMIN)
- AC: Role changes save; user list refreshes

**S8-02 — Knowledge Base management UI**
- CRUD for KnowledgeBaseEntry (type, title, content, metadata)
- Search + filter by type and domain
- Note: pgvector embedding generation on create/update
- AC: Entries created, edited, deactivated; search works

**S8-03 — System config UI**
- Edit SystemConfig keys: gate_reminder_hours, min_reviewer_count, compliance_variance_threshold
- AC: Config changes persist; gate reminder scheduler reads updated values

**S8-04 — Email config UI**
- Display current SMTP config (masked passwords)
- "Send test email" button → validates config is working
- Note: Actual SMTP credentials are env vars — UI shows current values + confirms send works
- AC: Test email sends successfully; UI confirms delivery

**S8-05 — SOW template management**
- Upload Webknot standard SOW template to MinIO `presales-templates/`
- Mark as default
- Upload client-specific templates associated to an engagement
- AC: Default template loads for all new SOW flows; per-engagement template overrides work

---

## Sprint 9 — Real Adapter Implementations (Future-Scoped)
**Owner:** Forge
**Status:** FUTURE SPRINT — do not begin until external systems are ready
**Gate condition:** Sprint 9 cannot start until:
  - [ ] MeetMinds++ API is built and documented
  - [ ] Estimation & Pricing Tool API/interface is finalised
  - [ ] Webknot Knowledge Base content exists and is structured

**Goal:** Swap stub adapters for real implementations. Platform continues to work with stubs until this sprint runs. Zero rework to Orchestrator or agent logic.

**S9-B-01 — Real MeetMinds++ Adapter**
- Implement `src/adapters/meetminds/real.ts`
- `getTranscript(meetingId)` → real API call to MeetMinds++ endpoint
- `listMeetings()` → real API call
- `registerWebhook()` → register callback URL with MeetMinds++
- Webhook handler route: `POST /api/webhooks/meetminds` — receives new transcript notification
- Normalizer: if MeetMinds++ output is unstructured → parsing layer extracts presales signals
- Set `MEETMINDS_ADAPTER=real` in env to activate
- AC: Real transcript retrieved; webhook fires on new transcript; all MeetMindsOutput fields populated

**S9-B-02 — Real Pricing Adapter**
- Implement `src/adapters/pricing/real.ts`
- Call Estimation & Pricing Tool API/LLM with PricingInput as structured prompt
- `normalizer.ts` (already stubbed): coerce actual output to PricingOutput schema
- Preserve `rawLLMOutput` always
- Handle variability in LLM output gracefully — normalizer must be robust to format variation
- Set `PRICING_ADAPTER=real` in env to activate
- AC: Real pricing call returns PricingOutput; normalizer handles varied LLM responses; rawLLMOutput always saved

**S9-B-03 — Real Knowledge Base Adapter (pgvector)**
- Implement `src/adapters/knowledge-base/pgvector.ts`
- Embedding generation: OpenAI `text-embedding-3-small` on KB entry create/update
- Semantic search: pgvector cosine similarity search via Prisma `$queryRaw`
- `searchProjects()`, `searchCapabilities()`, `searchCaseStudies()`, `getPositioning()` all use vector search
- Set `KB_ADAPTER=real` in env to activate
- AC: KB entries with embeddings return semantically relevant results; cosine similarity threshold configurable

**S9-B-04 — Knowledge Base population tooling**
- Script: `scripts/kb-import.ts` — bulk import projects, capabilities, case studies from CSV/JSON
- Generates embeddings on import
- ADMIN UI (Sprint 8) is already wired — just needs real adapter behind it
- AC: Import script processes 50 entries without error; embeddings generated; search returns relevant results

---

## Sprint 10 — Hardening, Security & Deployment
**Owner:** Forge + Sentinel (QA lead on this sprint)
**Goal:** Production-ready. All error paths tested, security hardened, deployed to Linode.

**S10-B-01 — Error handling audit**
- Review every agent worker and route for uncaught errors
- Ensure every failure path produces an AuditLog entry
- Ensure no 500 errors return stack traces to client
- AC: All error scenarios return structured JSON; no stack traces in responses

**S10-B-02 — Rate limiting + request validation**
- `express-rate-limit` on all API routes (configurable limits per env)
- Zod input validation on all POST/PATCH request bodies — no raw unvalidated data reaches DB or LLM
- AC: Rate limit triggers 429; invalid request bodies return 400 with field-level errors

**S10-B-03 — Security hardening**
- Helmet.js headers
- CORS: only `FRONTEND_URL` allowed
- File upload: MIME type validation (PDF, DOCX, XLSX only); virus scan hook (pluggable, stub if no AV available)
- MinIO presigned URLs: 24h TTL enforced
- AC: Security headers present; CORS blocks unauthorized origins; wrong MIME type rejected

**S10-B-04 — Load testing**
- Sentinel runs load test: 10 concurrent Stage 1 engagements
- Identify queue saturation points; tune `QUEUE_CONCURRENCY` values
- AC: 10 concurrent Stage 1 flows complete without queue starvation or timeout

**S10-B-05 — Linode deployment**
- Nginx config for reverse proxy (backend on 3000, frontend served as static)
- PM2 ecosystem config: backend server + all BullMQ workers as separate processes
- PostgreSQL + Redis + MinIO via docker-compose on server
- GitHub Actions CI/CD: test → build → SSH deploy
- AC: `git push main` triggers deploy; `/health` returns `ok` on production URL

**S10-B-06 — Production smoke test**
- Sentinel runs end-to-end: create engagement → Stage 1 → download PPTX
- Verify all WebSocket events fire on production
- Verify email sending works (test SMTP)
- AC: Full Stage 1 flow works on production; PPTX downloadable; WS events received

---

## Sprint Status Tracking

After each sprint, Kira writes `SPRINT-STATUS.md` with:
```
Sprint N — [name]
WARDEN: PASS/FAIL/PENDING
SENTINEL: PASS/FAIL/PENDING
AUTHORIZED: YES/NO
Blocker (if NO): [what's blocking]
```

No sprint begins until previous sprint shows `AUTHORIZED: YES`.

---

## Summary

| Sprint | Focus | Owner | Key Gate | Status |
|--------|-------|-------|----------|--------|
| Sprint 0 | Scaffold + infra | Forge | Skeleton runs; all services connect | ✅ Done |
| Sprint 1 | Orchestrator core (Node) | Forge | Intake → state machine → routing works | ✅ Done |
| Sprint 1.5 | **Python AI Service scaffold** | Forge | ai-service running; intake + collateral real; Node bridge wired | ✅ Done |
| Sprint 2 | Stage 1 + 2 end-to-end (Python agents) | Forge | AM gets a PPTX from first message | ⏳ Next |
| Sprint 3 | Stage 3 backbone (gates) | Forge | Gate 1+2+3 + multi-LLM scoring work |
| Sprint 4 | Stage 3 complete + Stage 4 | Forge | Full proposal + defense deck |
| Sprint 5 | Stage 5 SOW | Forge | SOW walkthrough + dual approval |
| Sprint 6 | Governance layer | Forge | Versions, audit, cascade, diff |
| Sprint 7 | Full frontend | Nova | All flows usable in browser |
| Sprint 8 | Admin + ops | Nova + Forge | Users, KB, config manageable |
| Sprint 9 | Real adapters | Forge | MeetMinds++, Pricing, KB live *(future-gated)* |
| Sprint 10 | Hardening + deploy | Forge + Sentinel | Production live |
