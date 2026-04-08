# PROJECT-CONTEXT.md — Presales Orchestrator
*Loaded by all agents at the start of every session on this project.*
*Updated by the agent that made the change. Keep it current — stale context is worse than no context.*

---

## Project Overview
- **Name:** Presales Orchestrator
- **Client:** Webknot Technologies (internal product)
- **Status:** [x] Planning | [ ] Design | [ ] Development | [ ] QA | [ ] Live
- **Current Sprint:** Pre-Sprint — Architecture & SPEC
- **Repo:** TBD
- **Live URL:** TBD

---

## Tech Stack
| Layer | Choice | Notes |
|-------|--------|-------|
| Backend | Node.js + TypeScript (Express) | Webknot standard; all agents as services behind Orchestrator |
| Frontend | React + Vite + TypeScript | Webknot standard |
| Database | PostgreSQL | Engagements, audit trails, version history, approvals — all relational |
| Vector DB | pgvector (Postgres extension) | Knowledge base semantic search for Webknot Context Manager + Case Study Maker |
| Cache / Queue | Redis + BullMQ | Agent job queues, parallel execution, retry logic, caching LLM outputs |
| Auth | Google SSO (Passport.js) | Role-aware: AM / DM / Sales Head / Reviewer |
| AI — Tier 1 | OpenAI GPT-5 Mini | Easy tasks: intake parsing, summaries, email gen, reminders |
| AI — Tier 2 | OpenAI GPT-5.1 | Medium tasks: research synthesis, section drafts, critic model |
| AI — Tier 3 | Anthropic Claude Sonnet 4.6 | Complex tasks: Narrative Agent, Technical Solution Agent, coherence pass |
| AI — Scoring | Multi-LLM (Claude + Gemini + GPT) | Compliance scoring only; run in parallel, compare outputs |
| Document Output | PptxGenJS (PPTX), docxtemplater (DOCX), exceljs (XLSX) | Final packaging only — all intermediate outputs are structured JSON |
| Storage | S3-compatible (MinIO self-hosted or Linode Object Storage) | Final deliverable files, uploaded RFPs, templates |
| Email | Nodemailer + SMTP / SendGrid | Reviewer notifications, approval requests, reminders |
| Hosting | Linode VPS (likely) | PM2 process management; Nginx reverse proxy |
| CI/CD | GitHub Actions → SSH deploy | Standard Webknot pattern |

---

## Architecture Philosophy (Non-Negotiable)

### 1. Orchestrator is the ONLY entry point
- AM/DM talks only to the Presales Orchestrator
- No agent-to-agent direct calls. Ever.
- All inter-agent communication: AM → Orchestrator → Agent → Orchestrator → next Agent
- This is not just a design preference — it enables version control, audit trails, cascade detection, and gate enforcement

### 2. Everything is JSON until the last mile
- All agent outputs are structured JSON internally
- Human-readable formats (PPTX, DOCX, XLSX) are generated ONLY by the Packaging Agent at the end
- This allows any section to be regenerated independently without touching others

### 3. Adapter pattern for all external integrations
- MeetMinds++ — no API yet. `MeetMindsAdapter` interface defined, stub implementation today, real one later
- Estimation & Pricing Tool — LLM-based, input/output shapes TBD. `PricingAdapter` interface defined, adaptable
- Webknot Knowledge Base — doesn't exist yet. `KnowledgeBaseAdapter` interface with in-memory/file stub today, pgvector later
- Every external dependency lives behind an adapter interface. Swap the implementation, not the contract.

### 4. Engagements are the unit of state
- Every presales engagement is a tracked entity with: stage, status, version history, audit log, approved gates
- Context carry-forward is automatic — Stage 1 outputs are available to Stage 2 without re-entry
- The engagement ID is the thread connecting everything

### 5. Jobs, not synchronous calls
- Long-running agent work (research, proposal generation) runs as BullMQ jobs
- Frontend polls job status or receives WebSocket updates
- No request timeouts killing LLM jobs mid-run

---

## Agent Roster & Responsibilities

| Agent | Role | LLM Tier | Status |
|-------|------|-----------|--------|
| Presales Orchestrator | Controller, router, state machine, gate enforcer | GPT-5 Mini (routing) + escalates | To Build |
| Secondary Research Agent | External web research on prospect + industry | GPT-5.1 | To Build |
| Webknot Context Manager | Internal brand/capability/project knowledge retrieval | GPT-5.1 | To Build |
| MeetMinds++ | Call transcript + signal extraction | — (integration) | Built (adapter needed) |
| Estimation & Pricing Tool | BOM + cost + timeline output | — (LLM, adapter) | Built (adapter needed) |
| Case Study Maker | Tailored case study generation from project history | GPT-5.1 | To Build |
| SOW Maker | Precision SOW generation, section-by-section | Sonnet 4.6 | To Build |
| Proposal Maker (Parent) | Orchestrates Narrative + Technical + Packaging sub-agents | — (coordinator) | To Build |
| └ Narrative/Storyline Agent | Voice of proposal, positioning, coherence pass | Sonnet 4.6 | To Build |
| └ Technical Solution Agent | Architecture, tech stack, feature decomposition | Sonnet 4.6 | To Build |
| └ Packaging Agent | Format, layout, brand, final file assembly | GPT-5 Mini + templates | To Build |

---

## Stage → Agent Invocation Map

```
Stage 1: First Meeting Deck
  → Secondary Research Agent (light)
  → Webknot Context Manager
  → Packaging Agent (PPTX, 5–7 slides)

Stage 2: Post-Discovery Deck
  → MeetMinds++ Adapter (transcript retrieval)
  → Secondary Research Agent (medium, targeted)
  → Webknot Context Manager
  → Case Study Maker (surface relevant case studies)
  → Packaging Agent (PPTX)

Stage 3: Proposal
  → MeetMinds++ Adapter
  → Secondary Research Agent (deep)
  → Webknot Context Manager
  → Proposal Maker [
      → Narrative Agent (storyline + structure) → Gate 1
      → Technical Solution Agent (parallel with Case Study Maker) → Gate 2
      → Case Study Maker (parallel with Technical Solution Agent)
      → Estimation & Pricing Adapter (called by Technical Solution Agent output)
      → Pricing output → Gate 3
      → Narrative Agent (coherence pass over all sections)
    ]
  → Packaging Agent (DOCX)
  → Multi-LLM Compliance Scoring (before each gate)

Stage 4: Defense Deck
  → Approved Stage 3 proposal (context carry-forward)
  → Webknot Context Manager
  → Packaging Agent (PPTX, 30 min deck)
  → Defense Gate (Sales Head approval)

Stage 5: SOW
  → Approved Stage 3 proposal (input)
  → SOW Maker (section-by-section walkthrough with AM + DM)
  → Dual approval (AM + DM)
  → Packaging Agent (DOCX)
```

---

## Proposal Stage Gates (Stage 3 Detail)

```
Gate 1 — Storyline/Structure
  Trigger: Narrative Agent delivers positioning + section plan
  Sent to: AM + Reviewer(s) simultaneously
  Includes: Draft + Compliance Matrix + Improvement Suggestions
  Required: Minimum 1 reviewer approval (configurable)
  AM action: Approve / Approve with feedback / Reject → routes back to Narrative Agent

Gate 2 — Technical Solution
  Trigger: Technical Solution Agent delivers architecture + feature breakdown
  Sent to: AM + Reviewer(s)
  Includes: Solution doc + Compliance Matrix + Multi-LLM validation
  Cascade check: if solution changes impact Gate 1 narrative → flag to AM
  Required: Configurable reviewer count

Gate 3 — Pricing & Estimates
  Trigger: Estimation & Pricing Adapter returns BOM
  Sent to: AM + Reviewer(s)
  Includes: Pricing summary + BOM XLSX + Multi-LLM validation
  Cascade rule: if budget exceeded → descope solution, NOT ignore pricing
  AM can override and proceed without full re-cycle if time-critical
```

---

## Data Models (Core)

### Engagement
```typescript
{
  id: uuid,
  clientName: string,
  domain: string,
  stage: 1 | 2 | 3 | 4 | 5,
  status: 'initiated' | 'research_complete' | 'proposal_in_progress' | 'under_review' | 'approved' | 'delivered',
  currentBlocker: string | null,
  createdBy: userId,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### EngagementVersion
```typescript
{
  id: uuid,
  engagementId: uuid,
  version: number,
  triggeredBy: userId,
  changeReason: string,          // what feedback drove this version
  diffSummary: string,           // LLM-generated plain language diff
  artifacts: JSON,               // section-wise JSON outputs at this version
  createdAt: timestamp
}
```

### GateApproval
```typescript
{
  id: uuid,
  engagementId: uuid,
  gateNumber: 1 | 2 | 3 | 'defense',
  reviewerId: userId,
  status: 'pending' | 'approved' | 'approved_with_feedback' | 'rejected',
  feedback: string | null,
  approvedAt: timestamp | null
}
```

### AgentJob
```typescript
{
  id: uuid,
  engagementId: uuid,
  agentName: string,
  status: 'queued' | 'running' | 'completed' | 'failed',
  input: JSON,
  output: JSON | null,
  error: string | null,
  startedAt: timestamp,
  completedAt: timestamp | null,
  retryCount: number
}
```

---

## Adapter Interfaces (Stub-ready, swap-ready)

### MeetMindsAdapter
```typescript
interface MeetMindsAdapter {
  getTranscript(meetingId: string): Promise<MeetMindsOutput>
  listMeetings(clientName: string, dateRange?: DateRange): Promise<MeetingMeta[]>
  onNewTranscript(handler: (output: MeetMindsOutput) => void): void  // webhook handler
}

interface MeetMindsOutput {
  transcript: string
  metadata: { date: Date, participants: string[], duration: number, meetingType: string }
  requirements: string[]
  painPoints: string[]
  budgetSignals: string[]
  timelineMentions: string[]
  decisionMakers: { name: string, role: string, authority: 'decision' | 'influence' }[]
  actionItems: string[]
  competitiveMentions: string[]
}
```

### PricingAdapter
```typescript
interface PricingAdapter {
  estimate(input: PricingInput): Promise<PricingOutput>
}

interface PricingInput {
  featureBreakdown: { module: string, features: string[], tasks: string[] }[]
  deliveryModel: 'fixed' | 'tm' | 'hybrid'
  timeline: { durationWeeks: number, phases: string[] }
  rateConstraints?: { maxBudget?: number, preferredRatePerDay?: number }
}

interface PricingOutput {
  bom: { role: string, effortDays: number, costINR: number }[]
  totalCostINR: number
  margin: number
  timeline: { phase: string, weeks: number }[]
  paymentMilestones: { milestone: string, percentageOfTotal: number }[]
  rawLLMOutput: string   // preserve original for audit
}
```

### KnowledgeBaseAdapter
```typescript
interface KnowledgeBaseAdapter {
  searchProjects(query: string, filters?: { domain?: string, techStack?: string[] }): Promise<ProjectRecord[]>
  searchCapabilities(query: string): Promise<CapabilityRecord[]>
  searchCaseStudies(query: string, filters?: { domain?: string }): Promise<CaseStudyRecord[]>
  getPositioning(context: ProspectContext): Promise<PositioningOutput>
}
// Today: file-based or in-memory stub
// Tomorrow: pgvector semantic search over structured Webknot KB
```

---

## Key Decisions Made

- **Adapter pattern for all integrations** — MeetMinds++, Pricing Tool, Knowledge Base all behind interfaces. Swap implementation without touching orchestration logic. Decided 2026-04-07.
- **JSON-first internal communication** — No PPTX/DOCX until Packaging Agent runs. Enables modular section regeneration. Decided 2026-04-07.
- **BullMQ for job orchestration** — LLM calls can take 30–120 seconds. Synchronous HTTP is the wrong primitive. Jobs give us retry, parallelism, and status tracking. Decided 2026-04-07.
- **pgvector over a separate vector DB** — Keeps the stack simple (one DB), sufficient for the knowledge base scale Webknot needs. Upgrade path to Pinecone/Qdrant exists if needed. Decided 2026-04-07.
- **Cascade direction: pricing constrains solution** — If budget is exceeded, descope the solution. Never inflate the price to match the solution. AM can override. Decided 2026-04-07.
- **DM authority is SOW-only** — All other stages: AM is the operator. DM only enters at Stage 5 dual approval. Decided 2026-04-07.
- **Multi-LLM scoring is parallel, not sequential** — Claude + Gemini + GPT score independently. High variance areas flagged for human judgment, not averaged. Decided 2026-04-07.
- **Linode VPS (likely)** — Self-hosted Redis, Postgres, MinIO. PM2 + Nginx. No managed services assumption for now. Decided 2026-04-07.
- **Gemini included in multi-LLM scoring** — Claude + Gemini + GPT all used in parallel for compliance scoring. High-variance areas flagged for human judgment. Decided 2026-04-07.
- **Email sender is configurable** — SMTP config and sender address via environment variables. No hardcoded email addresses anywhere in the codebase. Decided 2026-04-07.
- **Sales Head is a role, not a person** — RBAC role assignable to multiple users. Configurable via admin panel. Decided 2026-04-07.
- **Async-first UX** — No synchronous waits. Every LLM job is submitted → AM gets status updates via WebSocket/polling. Generation time optimized iteratively. Decided 2026-04-07.
- **SOW default template is Webknot's** — Client template override supported. SOW Maker loads template from file store, not hardcoded. Decided 2026-04-07.

---

## Folder Structure (Proposed)

```
presales-orchestrator/
  backend/
    src/
      agents/
        orchestrator/         — Presales Orchestrator (main controller)
        research/             — Secondary Research Agent
        context-manager/      — Webknot Context Manager
        case-study/           — Case Study Maker
        sow-maker/            — SOW Maker
        proposal/
          index.ts            — Proposal Maker (parent coordinator)
          narrative/          — Narrative/Storyline Agent
          technical/          — Technical Solution Agent
          packaging/          — Packaging Agent
      adapters/
        meetminds/            — MeetMindsAdapter (stub → real)
        pricing/              — PricingAdapter (stub → real)
        knowledge-base/       — KnowledgeBaseAdapter (stub → real)
      jobs/                   — BullMQ job definitions
      models/                 — DB schemas (Engagement, Version, Gate, Job)
      routes/                 — Express routes (intake, status, approvals)
      services/
        llm/                  — LLM router (picks tier based on task)
        email/                — Nodemailer service
        storage/              — S3/MinIO file operations
        scoring/              — Multi-LLM compliance scoring
      middleware/             — Auth, RBAC, error handling
    prisma/                   — Schema + migrations
  frontend/
    src/
      pages/
        Dashboard/            — Engagement list + status
        Intake/               — Conversational intake UI
        Review/               — Artifact review + iteration
        Approvals/            — Gate approval workflow
        History/              — Version history + diff view
      components/
      hooks/
      services/               — API client
```

---

## Gotchas & Landmines
- **MeetMinds++ output format unknown** — Do not hardcode parsing logic. Everything behind the adapter interface.
- **Pricing Tool is an LLM** — Its outputs may be unstructured. Build a normalizer layer inside PricingAdapter that coerces to PricingOutput schema. Log rawLLMOutput always.
- **Knowledge Base doesn't exist** — Webknot Context Manager and Case Study Maker must work with stub data on Day 1. Design for graceful degradation: if KB returns nothing, surface the gap to AM rather than hallucinating.
- **Parallel agent execution** — Research Agent and Context Manager run in parallel (Stage 1). BullMQ handles this via separate queues. Don't conflate with sequential gate dependencies.
- **Gate reminders** — If a reviewer doesn't respond, the system sends reminders. AM is responsible for chasing reviewers, not the system. System only nudges.
- **No silent failures** — Every agent failure must surface to AM with actionable options (retry / proceed with available / manual input). Never swallow errors.

---

## Open Questions
- [ ] Sales Head role — multiple people may hold this role; exact user management TBD. Build as a configurable role (not hardcoded). — raised 2026-04-07
- [ ] Email sending domain — not decided yet. Email sender address must be configurable via env var/config, not hardcoded. — raised 2026-04-07
- [ ] AM wait-time SLA — unknown. Design async-first UX (job submission → polling/WebSocket updates). Optimize generation speed iteratively. — raised 2026-04-07

## Resolved Questions
- [x] Gemini API — YES, Gemini will be used for multi-LLM compliance scoring alongside Claude + GPT. — resolved 2026-04-07
- [x] SOW template — Webknot HAS a standard SOW template. Build SOW Maker to use it as default; client template override still supported. — resolved 2026-04-07
- [x] Sales Head — configurable role in the system, not a fixed named user. — resolved 2026-04-07

---

## Sprint Gate Status
- Last Warden pass: N/A — pre-sprint
- Last Sentinel pass: N/A — pre-sprint
- Next sprint authorized: NO — HLD + LLD written (2026-04-07), awaiting human review and sign-off before Kira sprint planning

## Documents
- `CONTEXT.md` — this file, project brain
- `HLD.md` — high-level architecture, data flows, component map, gate flows
- `LLD.md` — Prisma schema, routes, queues, agent logic, adapters, env vars, folder structure
