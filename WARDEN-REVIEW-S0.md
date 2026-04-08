# Warden Review — Sprint 0
*Reviewer: Warden 🛡 | Date: 2026-04-07*
*Project: Presales Orchestrator | Sprint: 0 — Skeleton & Infrastructure*

---

## VERDICT: REVIEW_PASS ✅

Sprint 0 is solid foundation work. The architecture constraints from CONTEXT.md are respected throughout. No blocking issues. Four important findings that must be fixed in Sprint 1, and several minor observations. All blockers are self-corrections Forge disclosed in PRE-REVIEW.md — good transparency.

---

## Findings by Severity

### 🔴 BLOCKING — None

No blocking issues. Sprint 1 is authorized to proceed.

---

### 🟡 IMPORTANT — Must fix in Sprint 1 (before any Sprint 1 code ships)

**[I-01] JWT_EXPIRY env var is validated but never used**
- File: `src/routes/auth.routes.ts:80`, `src/config/env.ts`
- The env schema validates `JWT_EXPIRY` (defaults to `'7d'`), but `jwtSign` hardcodes `{ expiresIn: '7d' }` in `SignOptions`. If someone sets `JWT_EXPIRY=1h` in env, it has no effect.
- Risk: Silent misconfiguration. Operator sets a shorter expiry for security, system ignores it.
- Fix: Create `src/lib/jwt.ts` utility that wraps `jwtSign` and casts `env.JWT_EXPIRY` through a type assertion to `SignOptions['expiresIn']`. One function, called from auth route and any future token signing.

**[I-02] Cookie `maxAge` is also hardcoded and doesn't respect JWT_EXPIRY**
- File: `src/routes/auth.routes.ts:82-87`
- `maxAge: 7 * 24 * 60 * 60 * 1000` is hardcoded independently of `JWT_EXPIRY`. These two can drift out of sync — cookie outlives or underlives the JWT.
- Fix: Parse `JWT_EXPIRY` into milliseconds in the jwt utility and use a single source of truth for both values.

**[I-03] Unused import in stub-worker.factory.ts**
- File: `src/jobs/workers/stub-worker.factory.ts:2`
- `QueueEvents` is imported but never used.
- Fix: Remove the import. It compiles only because `skipLibCheck` is not the cause — this is a dead import that will flag if `noUnusedLocals` is enabled (it should be).
- Note: `tsconfig.json` does not have `noUnusedLocals: true`. Add it.

**[I-04] Adapter singletons are uninitialized before `initAdapters()` is called**
- File: `src/adapters/factory.ts:48-55`
- `_meetminds`, `_pricing`, `_kb` are declared as the adapter types but are `undefined` until `initAdapters()` runs. TypeScript accepts this because they're typed as the interface (not `undefined`). If any code calls `adapters.meetminds` before `initAdapters()` at startup, it will throw a runtime error with no helpful message.
- Risk: Silent `undefined` access if startup order ever changes.
- Fix: Either initialize with stubs by default (not factory), or add a guard in the getter: `if (!_meetminds) throw new Error('[Adapters] Not initialized — call initAdapters() first')`.

---

### 🔵 MINOR — Address when convenient, not sprint-blocking

**[M-01] `initBuckets()` swallows all MinIO errors as bucket-creation attempts**
- File: `src/config/storage.ts:20-27`
- The `catch` block on `HeadBucketCommand` catches any error — including auth failures, network errors, and permission errors — and attempts `CreateBucketCommand`. If the real problem is wrong credentials, this will fail with a confusing error.
- Suggestion: Check if the error is specifically a `NoSuchBucket` / 404 before attempting creation. Log other errors explicitly.

**[M-02] WebSocket `join:engagement` room join has no access validation**
- File: `src/services/websocket/server.ts:35-39`
- Any authenticated user can join any `engagement:${id}` room by sending the room ID. The socket auth validates JWT (good), but doesn't check if the user is a participant in that specific engagement.
- Risk: Low in Sprint 0 (no sensitive data being emitted yet), but will matter in Sprint 2+ when real agent outputs are streamed. Should be addressed before Sprint 2 ships.
- Suggestion: On `join:engagement`, do a DB lookup to verify the user is a participant before calling `socket.join()`.

**[M-03] `QueueEvents` import is unused in stub-worker.factory.ts**
- Duplicate of I-03 — already flagged. Just noting it twice because it's a clean signal.

**[M-04] `env.ts` marks LLM API keys as REQUIRED at startup**
- File: `src/config/env.ts:28-30`
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` are all required and will cause startup failure if absent. This is correct for production, but means a developer can't run the app locally without all three API keys — even in Sprint 0 where no LLM calls are made yet.
- Suggestion: For developer ergonomics, consider allowing these to be optional in `development` env (with a console warning), required in `production`. Not urgent but worth raising.

**[M-05] Seed script uses a fake `googleId`**
- File: `backend/prisma/seed.ts:16`
- `googleId: 'seed-admin-google-id'` will conflict if the real admin logs in via Google (different googleId). The upsert is on `email`, so the admin user will be found — but the googleId won't match and Google login will create a duplicate or fail.
- Suggestion: Add a comment explaining this is a placeholder. When the real admin first logs in via Google, update the seed or handle the conflict in the upsert logic.

**[M-06] Frontend `window.location.search` check in Login page**
- File: `frontend/src/pages/Login/index.tsx:58-62`
- `window.location.search.includes('error=auth_failed')` works but is fragile — it matches on substring, not exact query param. Not a security issue but worth using `URLSearchParams` for correctness.

**[M-07] No `.env` in `.gitignore` at workspace root level**
- File: `projects/presales-orchestrator/.gitignore`
- The `.gitignore` is in the project subfolder. If the workspace root git repo tracks `projects/presales-orchestrator/`, a `.env` file in the backend folder would be ignored by the local `.gitignore` only. Confirm the root workspace `.gitignore` also excludes `*.env` and `.env` patterns.

---

## Architecture Compliance Check

| Constraint | Status | Notes |
|---|---|---|
| Orchestrator is only entry point | ✅ | Routing stubs in place; no agent-to-agent paths exist |
| JSON-first, no PPTX/DOCX internally | ✅ | No document generation code exists in Sprint 0 (correct) |
| All external integrations behind adapters | ✅ | Factory pattern correctly implemented for all 3 |
| BullMQ for all LLM work | ✅ | Queues defined; workers are stubs (appropriate for S0) |
| Email sender configurable | ✅ | `EMAIL_FROM` fully env-driven, no hardcoded addresses |
| Sales Head is a RBAC role | ✅ | `SALES_HEAD` in `RoleType` enum |
| No stack traces to client | ✅ | `error.middleware.ts` strips correctly |
| No silent failures | ✅ | Stub workers log failures; adapter factory validates real env deps |
| Adapter stubs throw NotImplementedError (real) | ✅ | All three real adapters throw with clear messages |
| pgvector via raw SQL migration | ✅ | `0001_initial.sql` handles this correctly |

---

## What's Done Well

- **Adapter factory is excellent.** The pattern is clean, the real-vs-stub toggle via env is exactly right, and the validation that real adapter env vars exist before constructing is the correct defensive move.
- **Zod env validation** is comprehensive and fail-fast. The error messages are clear and point to `.env.example`. This will save every developer who joins the project.
- **WebSocket typed events** in `events.ts` are thorough. Having all event shapes defined in one place before any real usage means Sprint 7 frontend work will have a clear contract to code against.
- **Stub workers update AgentJob DB** — this is not obvious but the right call. Real workers follow the same pattern. Good foundation.
- **Error middleware** correctly separates dev (with stack) from production (without) and logs 5xx server-side.
- **Health check uses real probes** — not just `{ status: 'ok' }` but actual `SELECT 1`, `PING`, `HeadBucket`. Ops-ready from Day 1.

---

## Required Before Sprint 1 Ships

1. Fix I-01 + I-02: Create `src/lib/jwt.ts` utility, wire `JWT_EXPIRY` properly
2. Fix I-03: Remove unused `QueueEvents` import; add `noUnusedLocals: true` to tsconfig
3. Fix I-04: Add guard in adapter getters for uninitialized state

M-02 (WebSocket room access check) must be addressed before Sprint 2 ships, not Sprint 1.

---

*Warden out. Sprint 1 is clear to go once I-01 through I-04 are fixed.* 🛡
