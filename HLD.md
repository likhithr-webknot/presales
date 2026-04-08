# HLD — Presales Orchestrator
*High-Level Design | Version 2.0 | April 2026 — updated 2026-04-08 for Python AI Service*

---

## 1. System Overview

The Presales Orchestrator is an AI-powered collateral production platform. An AM (Account Manager) or DM (Delivery Manager) inputs context conversationally; the system coordinates multiple specialized AI agents to produce meeting-ready deliverables across 5 sales lifecycle stages.

**Architectural split (as of 2026-04-08):**
- **Node.js backend** — API layer, auth, state machine, DB (Postgres), WebSocket, file uploads. Zero LLM calls.
- **Python AI service** — ALL LLM logic: intake parsing, collateral detection, all agent workers. FastAPI + async workers.
- **Communication** — Node → Python: HTTP (sync for parsing, async for agent jobs). Python → Node: HTTP callback on job completion.

### 1.1 System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)                       │
│  ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │  Intake Chat │ │Dashboard │ │ Review   │ │Approvals/Gates │  │
│  └──────┬───────┘ └────┬─────┘ └────┬─────┘ └───────┬────────┘  │
└─────────┼──────────────┼────────────┼───────────────┼────────────┘
          │         REST API + WebSocket (Socket.io)   │
          │              │            │                │
┌─────────▼──────────────▼────────────▼───────────────▼────────────┐
│              NODE.JS BACKEND (TypeScript + Express)               │
│  ─────────────────────────────────────────────────────────────    │
│  Auth (Google SSO) │ State Machine │ DB (Prisma) │ WebSocket      │
│  File Uploads      │ Audit Logger  │ RBAC        │ Email Service  │
│                                                                   │
│  ⚠ ZERO LLM CALLS — no OpenAI/Anthropic/Gemini SDK in Node       │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  BullMQ Queues (Redis-backed)                              │   │
│  │  research │ context │ narrative │ technical │ packaging    │   │
│  │  sow │ casestudy │ scoring │ email │ diffgen │ pricing     │   │
│  └─────────────────────────┬──────────────────────────────────┘   │
│                             │                                     │
│  ┌──────────────────────────▼──────────────────────────────────┐  │
│  │  ai-client.ts  (HTTP bridge to Python)                      │  │
│  │  POST /intake/parse        ← sync (Node waits for result)   │  │
│  │  POST /collateral/detect   ← sync (Node waits for result)   │  │
│  │  POST /jobs/dispatch       ← async (202 Accepted)           │  │
│  └──────────────────────────┬──────────────────────────────────┘  │
└─────────────────────────────┼─────────────────────────────────────┘
                              │ HTTP  (internal: x-ai-internal-secret)
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│               PYTHON AI SERVICE (FastAPI)                        │
│  ─────────────────────────────────────────────────────────────   │
│  ALL LLM calls live here. Node never touches LLM APIs directly.  │
│                                                                   │
│  Endpoints:                                                       │
│    POST /intake/parse      → intake_parser.py (GPT-4o-mini) ✅   │
│    POST /collateral/detect → collateral_detector.py (rule+LLM)✅  │
│    POST /jobs/dispatch     → dispatcher.py → worker routing      │
│    GET  /health            → service health check                │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  AGENT WORKERS (ai-service/workers/)                     │    │
│  │  intake_parser.py      ✅ real — GPT-4o-mini             │    │
│  │  collateral_detector.py✅ real — rule-based + LLM        │    │
│  │  research.py           ⏳ Sprint 2                        │    │
│  │  context_manager.py    ⏳ Sprint 2                        │    │
│  │  packaging.py          ⏳ Sprint 2                        │    │
│  │  narrative.py          ⏳ Sprint 3                        │    │
│  │  technical.py          ⏳ Sprint 3                        │    │
│  │  scorer.py             ⏳ Sprint 3 (multi-LLM)           │    │
│  │  case_study.py         ⏳ Sprint 4                        │    │
│  │  sow_maker.py          ⏳ Sprint 5                        │    │
│  └──────────────────────────────────────────────────────────┘    │
│                              │                                    │
│  POST /api/internal/job-update → Node (job done/failed callback) │
└──────────────────────────────┬───────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        OpenAI API      Anthropic API      Gemini API
      (GPT-4o-mini,    (Sonnet 4.6 —     (multi-LLM
        GPT-4o)         narrative, SOW,    scoring)
                        technical)

┌──────────────────────────────────────────────────────────────────┐
│  SHARED INFRASTRUCTURE                                           │
│  PostgreSQL + pgvector │ Redis (BullMQ queues) │ MinIO (files)  │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Service Responsibilities

| Service | Responsibility | LLM calls? |
|---------|---------------|-----------|
| Node.js backend | REST API, auth, state machine, DB, WebSocket, file uploads | ❌ None |
| Python ai-service | All LLM agent logic, intake parsing, collateral detection, compliance scoring | ✅ All |
| Frontend | React UI for AM/DM/Reviewer/Admin | N/A |

### 1.3 Node ↔ Python Communication

| Call direction | Endpoint | When | Sync? |
|---------------|---------|------|-------|
| Node → Python | `POST /intake/parse` | Every AM message in /message route | ✅ Sync |
| Node → Python | `POST /collateral/detect` | Every AM message in /message route | ✅ Sync |
| Node → Python | `POST /jobs/dispatch` | When dispatching an agent job | ❌ Async (202) |
| Python → Node | `POST /api/internal/job-update` | When a job completes or fails | ❌ Fire-and-forget |

Auth: `x-ai-internal-secret` header on all inter-service calls.


### 2.1 Agents (10 total)

All agents now live in **`ai-service/workers/`** (Python). Node.js only holds BullMQ stub workers that call `ai-client.dispatchJob()`.

| Agent | Python Worker | Queue | LLM Tier | Status |
|-------|--------------|-------|----------|--------|
| Presales Orchestrator | (Node routing only — no LLM) | N/A | None | ✅ Done |
| Intake Parser | `intake_parser.py` | sync HTTP | GPT-4o-mini | ✅ Done |
| Collateral Detector | `collateral_detector.py` | sync HTTP | rule + GPT-4o-mini | ✅ Done |
| Secondary Research Agent | `research.py` | `research-queue` | GPT-4o | ⏳ Sprint 2 |
| Webknot Context Manager | `context_manager.py` | `context-queue` | GPT-4o | ⏳ Sprint 2 |
| Packaging Agent | `packaging.py` | `packaging-queue` | GPT-4o-mini + templates | ⏳ Sprint 2 |
| MeetMinds++ | (adapter — no Python worker) | N/A | — | Stub |
| Estimation & Pricing Tool | (adapter — `pricing.py`) | `pricing-queue` | — (external LLM) | ⏳ Sprint 4 |
| Case Study Maker | `case_study.py` | `casestudy-queue` | GPT-4o | ⏳ Sprint 4 |
| SOW Maker | `sow_maker.py` | `sow-queue` | Sonnet 4.6 | ⏳ Sprint 5 |
| Narrative Agent | `narrative.py` | `narrative-queue` | Sonnet 4.6 | ⏳ Sprint 3 |
| Technical Solution Agent | `technical.py` | `technical-queue` | Sonnet 4.6 | ⏳ Sprint 3 |
| Multi-LLM Scorer | `scorer.py` | `scoring-queue` | Claude + Gemini + GPT-4o | ⏳ Sprint 3 |

### 2.2 Adapters (3 total — swap-ready)

| Adapter | Interface | Stub | Future |
|---------|-----------|------|--------|
| MeetMindsAdapter | `IMeetMindsAdapter` | Returns hardcoded transcript JSON | Real API call to MeetMinds++ endpoint |
| PricingAdapter | `IPricingAdapter` | Returns hardcoded BOM structure | LLM call to Pricing Tool + normalizer |
| KnowledgeBaseAdapter | `IKnowledgeBaseAdapter` | File-based markdown stubs | pgvector semantic search |

### 2.3 Supporting Services

| Service | Purpose |
|---------|---------|
| LLM Router | **Python only** — `ai-service/config.py` defines model tiers; Node has no LLM router |
| Multi-LLM Scorer | Parallel Claude + Gemini + GPT scoring; variance detection |
| Email Service | Nodemailer; triggers for gate reviews, reminders, approvals |
| Storage Service | MinIO S3-compatible; uploaded docs, generated files, templates |
| WebSocket Service | Socket.io; real-time job status updates to frontend |
| Auth Middleware | Google SSO + Passport.js; JWT session; RBAC enforcement |

---

## 3. Data Flow by Stage

### Stage 1 — First Meeting Deck

```
AM inputs: client name, domain, opportunity context
         ↓
Orchestrator: parse intake → detect Stage 1 → check for gaps → ask if missing
         ↓
Dispatch PARALLEL:
  ├── research-queue: Secondary Research Agent (light depth)
  └── context-queue: Webknot Context Manager
         ↓
Both complete → Orchestrator assembles context bundle
         ↓
packaging-queue: Packaging Agent → generates 5–7 slide PPTX
         ↓
AM review → iterate if needed → deliver
```

### Stage 2 — Post-Discovery Deck

```
AM inputs: call notes / MeetMinds++ reference, updated client context
         ↓
Orchestrator: retrieve MeetMinds++ transcript via adapter → parse signals
         ↓
Dispatch PARALLEL:
  ├── research-queue: Secondary Research Agent (medium depth, targeted)
  ├── context-queue: Webknot Context Manager
  └── casestudy-queue: Case Study Maker (surface relevant case studies)
         ↓
Orchestrator assembles → packaging-queue: Packaging Agent → PPTX
         ↓
AM review → iterate → deliver
```

### Stage 3 — Proposal (detailed in Section 4)

### Stage 4 — Defense Deck

```
AM inputs: approved Stage 3 proposal (auto-carried forward)
         ↓
Orchestrator: loads approved proposal artifacts from EngagementVersion
         ↓
context-queue: Webknot Context Manager (defense-specific framing)
         ↓
Orchestrator assembles defense content
         ↓
Multi-LLM Compliance Scoring (parallel Claude + Gemini + GPT)
         ↓
packaging-queue: Packaging Agent → 30-min PPTX + Q&A cheat sheet
         ↓
Defense Gate: sent to AM + Sales Head simultaneously
  → Approved: finalize
  → Feedback: route back to appropriate agent → re-package
         ↓
Deliver
```

### Stage 5 — SOW

```
AM inputs: approved Stage 3 proposal (auto-carried forward) + SOW template choice
         ↓
Orchestrator: loads approved proposal → passes to SOW Maker
         ↓
sow-queue: SOW Maker begins section-by-section walkthrough
  Section: In Scope → AM confirms → next
  Section: Out of Scope → AM confirms → next
  Section: Assumptions → AM confirms → next
  Section: Dependencies → AM confirms → next
  Section: SLAs → AM confirms → next
  ... (all sections require explicit affirmation)
         ↓
Draft complete → sent to AM + DM simultaneously for dual approval
         ↓
packaging-queue: Packaging Agent → DOCX (Webknot template or client template)
         ↓
Deliver
```

---

## 4. Stage 3 Gate Flow (Detailed)

```
INPUTS RECEIVED:
  MeetMinds++ transcript + RFP/requirement docs + AM context
         ↓
Orchestrator → Proposal Maker activates
         ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 PRE-GATE: Research Phase (Parallel)
  ├── research-queue: Secondary Research Agent (deep)
  └── context-queue: Webknot Context Manager
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         ↓
narrative-queue: Narrative Agent
  → Produces: positioning, section structure, section-level messaging briefs
         ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GATE 1 — Storyline/Structure
  Multi-LLM Scoring (parallel) → compliance matrix + suggestions
  Sent to: AM + Reviewer(s) simultaneously via email
  Tracks: approval status per reviewer
  AM iterates if needed → narrative-queue: Narrative Agent revision
  Gate clears when: minimum reviewer count met (configurable)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         ↓ Gate 1 APPROVED
         ↓
PARALLEL:
  ├── technical-queue: Technical Solution Agent
  │     → architecture, tech stack, feature breakdown
  └── casestudy-queue: Case Study Maker
        → tailored case studies for target domain
         ↓
Technical Solution complete → Orchestrator calls PricingAdapter
  pricing-queue: PricingAdapter → BOM + cost + timeline
         ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GATE 2 — Technical Solution
  Multi-LLM Scoring → compliance matrix + suggestions
  CASCADE CHECK: Does solution change invalidate Gate 1 narrative? → flag AM
  Sent to: AM + Reviewer(s)
  AM iterates → technical-queue revision
  Gate clears: configurable reviewer count
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         ↓ Gate 2 APPROVED
         ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GATE 3 — Pricing & Estimates
  Pricing output reviewed
  CASCADE RULE: budget exceeded → descope solution (NOT inflate price)
  Multi-LLM Scoring → pricing compliance matrix
  Sent to: AM + Reviewer(s)
  AM can override and proceed without full re-cycle (time-critical)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         ↓ Gate 3 APPROVED
         ↓
narrative-queue: Narrative Agent — COHERENCE PASS
  → Reviews all sections: Technical + Case Studies + Pricing
  → Ensures consistent tone, terminology, story arc
  → Flags inconsistencies back to Orchestrator
         ↓
packaging-queue: Packaging Agent → final DOCX assembly
         ↓
Deliver to AM
```

---

## 5. Frontend ↔ Backend Communication Model

### 5.1 REST API
All state-mutating operations (create engagement, submit feedback, approve gate) are REST calls.

```
POST   /api/engagements              → create engagement
GET    /api/engagements              → list (filtered by user role)
GET    /api/engagements/:id          → get engagement + current state
POST   /api/engagements/:id/message  → send message/instruction to Orchestrator
POST   /api/engagements/:id/approve  → approve a gate
POST   /api/engagements/:id/feedback → submit revision feedback
GET    /api/engagements/:id/versions → version history
GET    /api/engagements/:id/artifacts/:version → get artifact content
GET    /api/jobs/:jobId              → poll job status
POST   /api/upload                   → upload RFP/document
```

### 5.2 WebSocket Events (Socket.io)
Frontend subscribes to engagement-scoped rooms. Events:

```
engagement:<id>:job_started       { agentName, jobId, timestamp }
engagement:<id>:job_progress      { agentName, jobId, message, percent }
engagement:<id>:job_completed     { agentName, jobId, outputSummary }
engagement:<id>:job_failed        { agentName, jobId, error, options: ['retry','proceed','manual'] }
engagement:<id>:gate_ready        { gateNumber, complianceMatrix, suggestions }
engagement:<id>:gate_approved     { gateNumber, reviewerId, timestamp }
engagement:<id>:gate_reminder     { gateNumber, pendingReviewers }
engagement:<id>:artifact_ready    { artifactType, downloadUrl }
engagement:<id>:cascade_detected  { affectedGate, reason }
engagement:<id>:sow_section_ready { section, content }  // SOW walkthrough
```

---

## 6. Authentication & RBAC

### 6.1 Auth Flow
```
User → Google OAuth2 → Passport.js → JWT (httpOnly cookie)
     → Role lookup from DB → attach to req.user
```

### 6.2 Roles & Permissions

| Role | Can Do |
|------|--------|
| `AM` | Create engagements, all stages 1–4, send to reviewers, override gates |
| `DM` | SOW stage only (Stage 5), dual approval on SOW |
| `SALES_HEAD` | View + approve defense decks (Stage 4 gate) |
| `REVIEWER` | View assigned deliverables, provide feedback, approve gates |
| `ADMIN` | Manage users, roles, system config, email settings |

### 6.3 Data Isolation
Each engagement has a `createdBy` (AM). Only the AM who created it, their assigned reviewers, DM (for SOW), Sales Head (for defense), and ADMIN can access it.

---

## 7. Storage Architecture

### 7.1 PostgreSQL (Primary Data)
- All structured data: engagements, versions, gates, jobs, users, roles
- Append-only for audit: GateApproval and AuditLog records never updated, only inserted
- Prisma ORM with migrations

### 7.2 pgvector (Knowledge Base)
- Extension on same Postgres instance
- `KnowledgeBaseEntry` table with `embedding vector(1536)` column
- Used by KnowledgeBaseAdapter for semantic search
- Populated by ADMIN as Webknot builds out the KB
- Today: stub implementation (file-based); tomorrow: vector search

### 7.3 Redis
- BullMQ job queues (all agent work)
- Session cache (JWT validation cache)
- LLM output cache (avoid re-calling for identical inputs within TTL)

### 7.4 MinIO (S3-Compatible)
Buckets:
```
presales-uploads/      → RFPs, requirement docs, Q&A spreadsheets uploaded by AM
presales-artifacts/    → Generated PPTX, DOCX, XLSX (keyed by engagementId/version)
presales-templates/    → SOW templates, PPTX masters, brand assets
presales-exports/      → Final packaged deliverable bundles
```

---

## 8. Multi-LLM Compliance Scoring Flow

Triggered before each gate review (Gates 1, 2, 3, Defense Gate).

```
INPUT: { rfpRequirements, deliverableContent, scoringDimensions }
         ↓
Dispatch PARALLEL to 3 independent scoring jobs:
  ├── Claude (Sonnet 4.6): score each dimension 1–5, provide reasoning
  ├── GPT (GPT-5.1): score each dimension 1–5, provide reasoning
  └── Gemini: score each dimension 1–5, provide reasoning
         ↓
All 3 complete → Aggregator:
  → Calculate mean score per dimension
  → Calculate variance per dimension
  → Flag HIGH-VARIANCE dimensions (variance > threshold, e.g. stddev > 1.0)
  → Generate improvement suggestions for low-scoring dimensions (score < 3)
  → Produce ComplianceMatrix object
         ↓
OUTPUT: {
  dimensions: [{ name, meanScore, variance, scores: {claude, gpt, gemini}, suggestions }],
  overallScore: number,
  highVarianceAreas: string[],   // require explicit human judgment
  improvementSuggestions: string[]
}
         ↓
Sent to AM + Reviewer(s) alongside the draft
```

**High-variance rule:** When models disagree significantly, the area is flagged as requiring human judgment. The system does NOT average and proceed silently — it surfaces the disagreement.

---

## 9. Email Notification Flow

```
TRIGGER EVENTS → Email Service (Nodemailer)

Gate ready for review:
  TO: AM + assigned Reviewer(s)
  SUBJECT: [Presales] Gate {N} ready for review — {ClientName}
  BODY: link to review UI + compliance summary

Gate reminder (if no response after configurable hours):
  TO: AM (to chase reviewer)
  SUBJECT: [Presales] Reminder: Gate {N} awaiting review — {ClientName}

Gate approved:
  TO: AM
  SUBJECT: [Presales] Gate {N} approved — {ClientName}

Gate rejected / feedback received:
  TO: AM
  SUBJECT: [Presales] Gate {N} — feedback from {ReviewerName}

SOW dual approval request:
  TO: AM + DM
  SUBJECT: [Presales] SOW ready for final approval — {ClientName}

Artifact delivered:
  TO: AM
  SUBJECT: [Presales] Your {CollateralType} is ready — {ClientName}
```

**Config:** `EMAIL_FROM`, `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASS` — all env vars, none hardcoded.

---

## 10. Error Handling & Failure Surface Strategy

### 10.1 Agent Failure Handling
```
Agent job fails (after retries exhausted)
         ↓
Orchestrator receives failure event from BullMQ
         ↓
Classify failure:
  - RETRIABLE: transient network/API error → auto-retry (max 3 with backoff)
  - PARTIAL: agent returned incomplete output → surface to AM with partial results
  - FATAL: agent cannot proceed → surface to AM with explicit options
         ↓
WebSocket event: engagement:<id>:job_failed {
  agentName,
  error: human-readable description,
  options: [
    { id: 'retry', label: 'Retry this step' },
    { id: 'proceed', label: 'Proceed with available output' },
    { id: 'manual', label: 'Provide manual input' }
  ]
}
         ↓
AM selects option → Orchestrator acts accordingly
```

**No silent failures.** Every failure is surfaced. Every failure has at least one actionable option.

### 10.2 Retry Strategy (BullMQ)
```
attempts: 3
backoff: { type: 'exponential', delay: 2000 }  // 2s, 4s, 8s
removeOnComplete: false  // keep for audit
removeOnFail: false       // keep for debugging
```

### 10.3 Partial Output Handling
If Research Agent returns minimal results for a niche domain:
→ Flag to AM: "Limited research available for this domain. You can proceed with what's available, provide additional context, or retry."
→ Never proceed silently with thin data.

---

## 11. Version Control & Audit Trail

### 11.1 Version Control
- Every artifact mutation creates a new `EngagementVersion`
- Each version stores the full JSON artifact snapshot
- Diff between versions computed by LLM (GPT-5 Mini) → stored as `diffSummary`
- Frontend shows version timeline with change reasons

### 11.2 Audit Log
Append-only `AuditLog` table records:
- Gate transitions (who approved, when, what feedback)
- Agent invocations (which agent, what input, what output version)
- Override decisions (AM overriding gate without full re-cycle)
- User actions (who viewed, who downloaded)
- Version creation (what triggered it, who)

---

## 12. Context Carry-Forward

The Orchestrator automatically loads prior stage context when advancing:

```
Stage 1 → Stage 2:
  Research brief + Webknot context from Stage 1 loaded as baseline
  New MeetMinds++ transcript appended
  AM only needs to provide what's NEW

Stage 2 → Stage 3:
  All prior research + call notes available
  AM provides RFP/requirements doc if not already uploaded

Stage 3 → Stage 4:
  Approved proposal artifacts auto-loaded as input
  AM provides defense framing instructions only

Stage 3 → Stage 5:
  Approved proposal auto-loaded as SOW input
  AM selects/provides SOW template
```

---

## Open Questions (HLD Level)

- [ ] Should the platform support multiple simultaneous active engagements per AM? (Assumed YES — filtered by AM on dashboard)
- [ ] Is there a maximum file size for RFP uploads? (MinIO can handle large files; need UI guidance)
- [ ] Should generated artifacts expire from MinIO after a period? (Storage cost consideration)
- [ ] Will Webknot require SSO with a specific Google Workspace domain, or any Google account?
- [ ] Gate reminder interval — what's the default hours before a reminder fires? (Suggested: 24h, configurable)
