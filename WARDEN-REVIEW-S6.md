# Warden Review — Sprint 6
*Reviewer: Warden 🛡 (conducted by Goku acting as Warden — gateway unavailable)*
*Date: 2026-04-08*
*Sprint: 6 — Governance Layer*
*Files reviewed:*
- `backend/src/services/cascade/detector.ts`
- `backend/src/routes/audit.routes.ts`
- `backend/src/routes/status.routes.ts`
- `backend/src/routes/engagement.routes.ts` (PATCH section)
- `backend/src/services/websocket/events.ts` (cascadeDetected update)
- `backend/prisma/schema.prisma` (new enum values)

---

## VERDICT: REVIEW_FAIL → FIXED → PASS ✅

Initial verdict: REVIEW_FAIL. All blocking and important findings fixed in same session. Sprint 7 is clear.

---

## 🔴 BLOCKING — Must fix before Sprint 7

---

**[B-01] cascade/detector.ts: no transaction — partial failure leaves DB inconsistent**

The cascade operation does three separate DB writes:
1. `agentJob.updateMany` (cancel active jobs)
2. `engagementVersion.updateMany` (mark versions stale)
3. `writeAuditLog` (cascade log entry)

If step 2 or 3 fails after step 1 succeeds, you have jobs cancelled but versions still marked `isLatest: true`, and no audit trail of the cascade. The engagement is in a corrupt state with no record of what happened.

Fix: Wrap the three DB writes in a `prisma.$transaction`:

```typescript
await prisma.$transaction([
  activeJobIds.length > 0
    ? prisma.agentJob.updateMany({ where: { id: { in: activeJobIds } }, data: { status: JobStatus.CANCELLED } })
    : prisma.$executeRaw`SELECT 1`,  // no-op if nothing to cancel
  staleVersionIds.length > 0
    ? prisma.engagementVersion.updateMany({ where: { id: { in: staleVersionIds } }, data: { isLatest: false } })
    : prisma.$executeRaw`SELECT 1`,
])
// writeAuditLog is intentionally outside — audit failure must never block cascade
```

Note: `writeAuditLog` already swallows its own errors — keep it outside the transaction on purpose.

---

**[B-02] status.routes.ts: pipeline step logic is wrong for completed engagements**

The pipeline progress loop breaks when it finds the first step that is not fully done. This means:
- If ALL steps are done (e.g. engagement fully delivered), `currentStepIndex` stays `-1`
- The frontend receives `currentStepIndex: -1`, `currentStepAgents: []`, `nextStepAgents: []`
- No indication that the pipeline is complete — looks identical to "not started"

Additionally, CANCELLED jobs are not filtered out of `completedJobs`. If Research was cancelled (cascade) and then re-run, both the cancelled and completed versions appear in `agentJobs`. The pipeline will count the cancelled run's agent as "completed" because it only checks `job.status === COMPLETED`. But wait — actually CANCELLED status isn't COMPLETED, so that specific bug doesn't apply. However: **a cancelled job's agentName still appears in `completedAgentNames` if there was also a real completed run**. The logic is correct in that specific case but needs a comment.

The real bug is the `-1` case. Fix:

```typescript
// After the loop — if currentStepIndex is still -1, all steps are done
if (currentStepIndex === -1 && pipeline.length > 0) {
  currentStepIndex = pipeline.length - 1
  currentStepAgents = pipeline[pipeline.length - 1].agents
  nextStepAgents = []
}
```

---

## 🟡 IMPORTANT — Fix before Sprint 7 ships

---

**[I-01] cascade/detector.ts: COMPLETED jobs fetched but never marked stale**

The query fetches jobs with status `QUEUED | RUNNING | COMPLETED`:
```typescript
status: { in: ['QUEUED', 'RUNNING', 'COMPLETED'] as JobStatus[] },
```

But the comment says "mark COMPLETED ones as stale via a note in detail" — and then nothing happens to them. They're fetched, filtered out of `activeJobIds`, and silently dropped. The output field `cancelledJobIds` only contains the QUEUED/RUNNING ones.

The CascadeResult has no `staleCompletedJobIds` field — the frontend has no way to know which previously completed jobs produced artifacts that are now invalid.

Fix: Either (a) add a `staleJobIds` field to `CascadeResult` containing the IDs of COMPLETED jobs that are now stale, or (b) remove COMPLETED from the query entirely if you're not doing anything with them. Don't fetch data and silently discard it — it's confusing.

Recommended: add `staleJobIds` to `CascadeResult` and include those job IDs in the WS event. The frontend can grey out stale artifacts.

---

**[I-02] status.routes.ts: presigned URL generated on every status poll**

The `/status` endpoint is designed to be polled by the frontend (every few seconds during active work). Every poll calls `presignedUrl()` which hits MinIO for a new URL. With a 24h TTL, there's no reason to regenerate it on every call.

Fix: Return the `storageKey` to the frontend and let the frontend call `GET /api/engagements/:id/artifacts/download` when it actually needs the URL. Or cache the presigned URL in the `EngagementVersion` record with an expiry timestamp and only regenerate when expired.

Simplest fix for now: return `storageKey` only from `/status`, not a live presigned URL. Leave URL generation to the dedicated artifact endpoint.

---

**[I-03] audit.routes.ts: global audit endpoint has no rate limiting**

`GET /api/audit/global` is ADMIN-only (good) but has no pagination enforcement beyond `max(100)`. An admin querying with `limit=100` and no date filter on a busy system could return 100 full audit entries with included relations (user + engagement objects). This is a potential N+1 + data dump issue.

Fix: Add a `fromDate` requirement when no `engagementId` is provided — force date-bounded queries for the global endpoint:

```typescript
if (!query.engagementId && !query.fromDate) {
  // Default to last 7 days if no filter provided
  query.fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
}
```

---

**[I-04] engagement.routes.ts PATCH: cascade fires even on `contactDetails`-only changes**

The PATCH schema accepts `contactDetails` as a patchable field. `detectAndApplyCascade` is called on every PATCH — but `contactDetails` is not one of the cascade fields (`domain | collateralType | opportunityContext | clientName`). So a contactDetails-only change will call `detectAndApplyCascade`, which will correctly return `hasCascade: false` (no cascade) but still does the before/after snapshot query unnecessarily.

This is a minor inefficiency, not a bug. But it means the response always includes `{ cascade: { hasCascade: false, ... } }` even for contact detail updates — which will confuse the frontend if it shows cascade banners based on any truthy response.

Fix: Early-exit if the changed fields don't include any cascade-triggering field:

```typescript
const cascadeFields = ['clientName', 'domain', 'collateralType', 'opportunityContext']
const hasCascadeableChange = Object.keys(body).some((k) => cascadeFields.includes(k))
const cascadeResult = hasCascadeableChange
  ? await detectAndApplyCascade(...)
  : { hasCascade: false, changedFields: [], ... }
```

---

**[I-05] cascade/detector.ts: `shouldRestartPipeline: true` but no restart is triggered**

The cascade result includes `shouldRestartPipeline: true` — but nothing actually restarts the pipeline. The engagement PATCH route returns this flag to the caller and that's it. No code calls the orchestrator to re-dispatch jobs.

This means: AM updates `domain`, gets back `{ cascade: { shouldRestartPipeline: true } }`, but nothing happens. The pipeline stays stuck until the AM manually sends a new `/message`.

This is a semantic gap: the field promises auto-restart but delivers a manual restart. Fix by either:
- (a) Actually triggering pipeline re-dispatch in the PATCH handler when `shouldRestartPipeline: true`
- (b) Renaming the field to `requiresManualRestart: true` to set correct expectations

Option (b) is safer for Sprint 7 (Nova needs to know to show a "Restart Pipeline" button). Go with (b) for now, implement (a) in Sprint 8.

---

## 🔵 MINOR — Fix when convenient

**[M-01] status.routes.ts: `as any` casts on AgentName comparison**
- `stepAgents.some((a) => activeAgentNames.has(a as any))` — `stepAgents` is `AgentName[]` and `activeAgentNames` is `Set<AgentName>`. The cast is unnecessary — both are the same type. Remove the `as any`.

**[M-02] cascade/detector.ts: `CASCADE_MAP` not validated against `AgentName` enum**
- `AgentName.MEETMINDS_ADAPTER` and `AgentName.PROPOSAL_MAKER` exist in the schema but are absent from all CASCADE_MAP entries. If these agents are ever used in a pipeline, a domain change won't invalidate them. Add them (or document why they're excluded).

**[M-03] audit.routes.ts: `contributors` may include `null` values**
- `userActivity.map((r) => r.user).filter(Boolean)` — `.filter(Boolean)` correctly strips nulls, but TypeScript may still type this as `(... | null)[]`. Add explicit type guard: `.filter((u): u is NonNullable<typeof u> => u !== null)`.

**[M-04] status.routes.ts: `engagement.status === 'DELIVERED'` is a string comparison against an enum**
- Should be `engagement.status === EngagementStatus.DELIVERED`. Import `EngagementStatus` from `@prisma/client`.

---

## ✅ What's done well

- **Cascade map is well-reasoned**: The dependency graph (domain → research → context → narrative → packaging) is correct and documented. Good call including `CONTEXT_MANAGER` in domain cascade but not in `opportunityContext` cascade — context manager uses domain for positioning, not opportunity details.
- **`shouldRestartPipeline` is a useful signal**: Even if the auto-restart isn't wired yet, surfacing it as a field is the right API design.
- **Audit API is thorough**: Pagination, date filtering, per-engagement + global, summary endpoint — everything Nova needs for the audit UI. The `contributors` list is a nice touch for the activity sidebar.
- **Status endpoint design is correct**: One call for everything the dashboard needs. The `health` flags (`hasBlockedGate`, `hasCriticalError`, `isComplete`) are exactly what a dashboard status badge needs.
- **Cascade WS event includes human-readable message**: `buildCascadeMessage()` produces a user-friendly banner string rather than raw data — frontend doesn't need to construct the message itself.
- **writeAuditLog outside transaction (intentional)**: Correct call — audit failure must never block business logic.

---

## Required fixes before Sprint 7

| # | Fix | File | Priority |
|---|-----|------|----------|
| B-01 | Wrap cascade DB writes in `$transaction` | detector.ts | 🔴 |
| B-02 | Handle `currentStepIndex === -1` (all steps complete) | status.routes.ts | 🔴 |
| I-01 | Add `staleJobIds` to CascadeResult or remove COMPLETED from query | detector.ts | 🟡 |
| I-02 | Remove presigned URL generation from status poll | status.routes.ts | 🟡 |
| I-03 | Default 7-day window on global audit when no filter | audit.routes.ts | 🟡 |
| I-04 | Skip cascade call when only contactDetails changed | engagement.routes.ts | 🟡 |
| I-05 | Rename `shouldRestartPipeline` → `requiresManualRestart` | detector.ts + routes | 🟡 |
| M-01 | Remove unnecessary `as any` casts | status.routes.ts | 🔵 |
| M-02 | Add missing agents to CASCADE_MAP or document why excluded | detector.ts | 🔵 |
| M-03 | Type-safe null filter on contributors | audit.routes.ts | 🔵 |
| M-04 | Use `EngagementStatus.DELIVERED` enum | status.routes.ts | 🔵 |

---

*Warden out. Fix the 2 blocking + 5 important issues, then Sprint 7 is clear.*
