# Warden Review — Sprint 1
*Reviewer: Warden 🛡 | Date: 2026-04-07*
*Project: Presales Orchestrator | Sprint: 1 — Orchestrator Core*

---

## VERDICT: REVIEW_PASS ✅

Sprint 1 delivers a solid Orchestrator brain. The dispatch logic, state machine, intake parser, and routing map are all correctly implemented and architecturally sound. No blocking issues. Three important findings, all straightforward to fix. Forge's PRE-REVIEW.md was accurate — no surprises.

---

## Findings by Severity

### 🔴 BLOCKING — None

---

### 🟡 IMPORTANT — Fix before Sprint 2 ships

**[I-01] State machine uses string literals instead of enum for job status filter**
- File: `src/agents/orchestrator/state-machine.ts:64`
- `status: { in: ['QUEUED', 'RUNNING'] }` uses raw strings. Should use `JobStatus.QUEUED`, `JobStatus.RUNNING` from `@prisma/client` to stay type-safe and refactor-proof.
- Risk: If Prisma enum values ever change, this silently breaks.
- Fix: `import { JobStatus } from '@prisma/client'` and use `{ in: [JobStatus.QUEUED, JobStatus.RUNNING] }`.

**[I-02] LLM router has no error handling or timeout**
- File: `src/services/llm/router.ts`
- `callLLM()` and `callLLMJson()` make raw API calls with no timeout, no retry, and no error wrapping. A provider outage or timeout will propagate a raw SDK error up to the BullMQ worker, which will mark the job failed — but the error message will be a raw SDK/network error, not a meaningful agent error.
- Risk: Unhelpful error messages surfaced to AM; no structured failure path.
- Fix: Wrap the provider calls in try/catch; throw a structured `LLMError` with `{ provider, model, task, originalError }`. Workers can then classify it as RETRIABLE.

**[I-03] `callLLMJson` has no schema validation on the parsed result**
- File: `src/services/llm/router.ts` — `callLLMJson()`
- Parses LLM output as JSON and returns it typed as `T` with no runtime validation. If the LLM returns a malformed or partial JSON object, `JSON.parse` may succeed but the caller receives a structurally incorrect object — TypeScript won't catch this at runtime.
- Risk: Subtle data corruption downstream. Intake parser could silently receive `{}` and extract no fields.
- Fix: Accept an optional Zod schema in `callLLMJson<T>` and validate the parsed result. If validation fails, throw a structured error. If no schema provided, return as-is (existing behaviour).

---

### 🔵 MINOR — Address when convenient

**[M-01] Orchestrator dispatches only the first pipeline step**
- File: `src/agents/orchestrator/index.ts` — well-documented in PRE-REVIEW
- Subsequent pipeline steps (e.g., packaging after research completes) are not yet chained. This is expected for Sprint 1, documented, and the comment is clear. Flagging for Sprint 2 implementation.

**[M-02] CANCELLED status used in soft-delete but not in EngagementStatus enum**
- File: `src/routes/engagement.routes.ts:131`, `backend/prisma/schema.prisma`
- `data: { status: 'CANCELLED' }` — `CANCELLED` is in the Prisma schema enum (`EngagementStatus`) but the string literal is used directly rather than `EngagementStatus.CANCELLED`. Minor but inconsistent with the rest of the codebase which uses enum values.
- Fix: `import { EngagementStatus } from '@prisma/client'` and use `EngagementStatus.CANCELLED`.

**[M-03] MeetMinds adapter mapped to 'research' queue**
- File: `src/agents/orchestrator/index.ts:152`
- Acknowledged in PRE-REVIEW. Low risk while stubs are running. Must be corrected in Sprint 2 before real MeetMinds wiring.

**[M-04] Advance-stage route doesn't validate the target stage is ≥ current stage**
- File: `src/routes/engagement.routes.ts`
- AM could advance stage backwards (e.g., STAGE_3 → STAGE_1) which would carry forward the wrong context. The state machine correctly validates status transitions, but stage advancement has no ordinal check.
- Suggestion: Add validation that `toStage` ordinal > current stage ordinal.

**[M-05] Warden S0-M-02 still open: WebSocket room join has no participant check**
- Required before Sprint 2 ships per Warden S0 review. Not yet implemented. Confirmed it must be done before Sprint 2.

---

## Architecture Compliance Check

| Constraint | Status | Notes |
|---|---|---|
| Orchestrator is only dispatch point | ✅ | `handleMessage()` is the single gate |
| No agent-to-agent direct calls | ✅ | All via BullMQ queues only |
| All LLM calls through router | ✅ | `callLLM()` is the only path to any provider |
| Audit log on every key action | ✅ | ENGAGEMENT_CREATED, STAGE_ADVANCED, AGENT_INVOKED all covered |
| No silent failures | ✅ | Audit logger logs errors but never throws; all routes have try/catch + next(err) |
| Route protection | ✅ | All `/api` routes use `authMiddleware`; role checks applied correctly |
| JSON-first (no doc generation yet) | ✅ | No PPTX/DOCX code exists — correct for Sprint 1 |

---

## What's Done Well

- **Intake parser context merging** is correct — existing fields are preserved and LLM only fills gaps. This is subtle and easy to get wrong (LLM overwriting existing data). Implemented properly.
- **Rule-based collateral detection fast path** before LLM fallback — exactly right. Saves tokens on obvious cases.
- **State machine is clean** — transition map is explicit, readable, and covers BLOCKED exits correctly.
- **Routing map covers all 8 collateral types** — complete, correct per HLD stage flows, parallel flags set correctly.
- **Audit logger never throws** — critical pattern. A logging failure must never crash the main flow.
- **LLM router model assignments** are clearly commented as placeholders (gpt-4o-mini for CHEAP, gpt-4o for MID) until GPT-5 models are GA. Clean and honest.

---

## Required Before Sprint 2 Ships

1. Fix I-01: Use `JobStatus` enum in state machine (5 min fix)
2. Fix I-02: Wrap LLM calls with structured error handling
3. Fix I-03: Add optional Zod validation in `callLLMJson`
4. Fix M-02: Use `EngagementStatus.CANCELLED` enum value
5. Fix S0-M-02: WebSocket room participant check (carried from Sprint 0)

---

*Warden out. Sprint 2 is clear to go once the above are fixed.* 🛡
