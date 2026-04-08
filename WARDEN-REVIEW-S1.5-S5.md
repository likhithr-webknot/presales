# Warden Review — Sprints 1.5 through 5
*Reviewer: Warden 🛡 (conducted by Goku acting as Warden — gateway unavailable)*
*Date: 2026-04-08*
*Project: Presales Orchestrator*
*Sprints reviewed: 1.5, 2, 3, 4, 5*

---

## VERDICT: REVIEW_FAIL ❌

Significant findings across multiple sprints. Several blocking issues that must be fixed before Sprint 6 starts. The architecture is sound and the right patterns are used in most places — but there are concrete bugs and security gaps that cannot proceed.

---

## 🔴 BLOCKING — Must fix before Sprint 6

---

**[B-01] dispatcher.py: stale stub comment block left above real imports**
- File: `ai-service/workers/dispatcher.py` lines ~32–37
- The old commented stub code (`# from workers.research import run as research_run`) still sits above the real imports. The real imports are present and correct, but the dead comment block is confusing and creates risk of a future developer re-instating stub behaviour.
- Fix: Delete the dead comment block. Keep only the real imports.

---

**[B-02] pipeline-advance.ts: race condition on parallel job completion**
- File: `backend/src/agents/orchestrator/pipeline-advance.ts` lines 45–57
- **The bug:** `tryAdvancePipeline` is called fire-and-forget for every COMPLETED job. If Research and Context complete within milliseconds of each other (normal for fast responses), two concurrent calls to `tryAdvancePipeline` can both find `allComplete = true` and both dispatch the next step (Packaging). This creates **duplicate Packaging jobs** for the same engagement.
- Risk: AM receives two PPTX artifacts; DB has two packaging AgentJob records; MinIO gets two uploads.
- Fix: Wrap the check + dispatch in a DB transaction or use an advisory lock. Simplest fix: add a DB check before dispatching the next step — query whether a job for the next step's agent already exists for this engagement in QUEUED/RUNNING status, and skip if so.

```typescript
// Add before dispatchNextStep():
const alreadyDispatched = await prisma.agentJob.findFirst({
  where: {
    engagementId: engagement.id,
    agentName: { in: nextStep.agents as AgentName[] },
    status: { in: [JobStatus.QUEUED, JobStatus.RUNNING] },
  },
})
if (alreadyDispatched) return // already in flight — skip
```

---

**[B-03] gate.routes.ts: compliance matrix never written back to GateApproval**
- File: `backend/src/routes/gate.routes.ts` — submit endpoint
- The scoring job is dispatched and GateApproval records are created, but when scoring completes (Python calls `/api/internal/job-update`), the ComplianceMatrix output is **never stored on the GateApproval records**. The `complianceMatrix` column on GateApproval exists in the Prisma schema but is never written.
- Impact: Gate review UI will have no compliance data to show. This is a functional gap that blocks Sprint 7 (frontend gate review panel).
- Fix: In `internal.routes.ts` job-update handler, detect when a scoring job completes and update the related GateApproval records with the compliance matrix:

```typescript
// After COMPLETED handling, check if it's a scoring job
if (status === 'COMPLETED' && output && job.agentName === 'COMPLIANCE_SCORER') {
  const gateNumber = (job.input as any)?.gateNumber
  if (gateNumber) {
    await prisma.gateApproval.updateMany({
      where: { engagementId, gateNumber },
      data: { complianceMatrix: output as Prisma.InputJsonValue },
    })
  }
}
```

---

**[B-04] sow.routes.ts: role check is unreliable**
- File: `backend/src/routes/sow.routes.ts` lines ~200–205
- `const userRoles = req.user!.roles as string[]` — the `req.user` object comes from the JWT middleware. Looking at `auth.middleware.ts`, `req.user` is shaped as `{ id, email, name, roles }` but `roles` is the UserRole relation objects from Prisma (`{ id, userId, role, user }[]`), not a plain string array.
- The check `userRoles.includes('DM')` will always be false because roles are objects not strings.
- Impact: DM will never be correctly identified — their SOW approval will always be stored as SOW_AM, breaking the dual approval requirement.
- Fix: Check `req.user!.roles.some((r: any) => r.role === 'DM')` or fix the type properly using the actual AuthUser type from auth.middleware.

---

**[B-05] ai-client.ts: `dispatchJob` timeout is 10s but scoring takes 60–120s**
- File: `backend/src/services/ai-client.ts` line ~128
- `dispatchJob` uses a 10-second timeout. The dispatch call is async (Python returns 202 immediately), so this is fine for the dispatch itself. However, `parseIntake` and `detectCollateral` use the **default 30-second timeout**. Multi-LLM scoring with three providers in parallel can take 30–90 seconds on cold starts. If the Python service is slow to start up the first time, the sync intake parse will timeout.
- Fix: Increase `parseIntake` and `detectCollateral` timeouts to 60s. Add a comment explaining why.

---

## 🟡 IMPORTANT — Fix before Sprint 6 ships

---

**[I-01] dispatcher.py: imports inside `_run_worker` — executed on every job call**
- File: `ai-service/workers/dispatcher.py` — `_run_worker` function
- All worker imports (`from workers.research import run as research_run`, etc.) are inside the function body, meaning they execute on every single job dispatch. Python will cache these after first import, but it's non-idiomatic, harder to read, and creates confusing import behaviour on startup errors.
- Fix: Move all worker imports to module level (top of file). This also means startup fails fast if a worker has a syntax error — catching it on import rather than first job run.

---

**[I-02] packaging.py: `asyncio.get_event_loop()` is deprecated in Python 3.10+**
- File: `ai-service/workers/packaging.py` — `_upload_to_minio`
- `asyncio.get_event_loop().run_in_executor(...)` is deprecated and may raise `DeprecationWarning` in Python 3.10+ and will be removed in a future version.
- Fix: Use `asyncio.get_running_loop()` instead:

```python
loop = asyncio.get_running_loop()
return await loop.run_in_executor(None, _upload_to_minio_sync, file_bytes, key, content_type)
```

---

**[I-03] scorer.py: `asyncio.get_event_loop()` same issue as I-02**
- File: `ai-service/workers/scorer.py` — `_score_with_gemini`
- Same deprecation issue. Fix: use `asyncio.get_running_loop()`.

---

**[I-04] internal.routes.ts: `action: 'AGENT_INVOKED' as any` used for job completion**
- File: `backend/src/routes/internal.routes.ts`
- The audit log action for job completions is `AGENT_INVOKED` cast with `as any`. The Prisma schema has `AGENT_COMPLETED` and `AGENT_FAILED` as proper enum values. Using the wrong action makes audit logs misleading — you can't filter "what jobs completed" vs "what jobs were invoked."
- Fix: Use `AuditAction.AGENT_COMPLETED` for COMPLETED status and `AuditAction.AGENT_FAILED` for FAILED status. Import `AuditAction` from `@prisma/client`.

---

**[I-05] gate.routes.ts: reviewer query fetches ALL REVIEWER-role users globally**
- File: `backend/src/routes/gate.routes.ts` — submit endpoint lines ~86–90
- `prisma.user.findMany({ where: { roles: { some: { role: RoleType.REVIEWER } } } })` fetches every reviewer in the system. For a multi-tenant or large deployment this creates approval records for all reviewers, not just those assigned to this engagement.
- This is likely by design for the MVP (Webknot is small), but it will break when there are 20+ users. Flag for Sprint 8 admin panel work.
- Fix for now: Add a comment documenting this as intentional MVP behaviour, and add a `take: 10` safety limit.

---

**[I-06] version.routes.ts: `createNewVersion` has a TOCTOU race on version numbers**
- File: `backend/src/routes/version.routes.ts` — `createNewVersion()`
- The pattern: `findFirst({ orderBy: { version: 'desc' } })` → `nextVersion = latest.version + 1` → `create(...)` is a classic Time-of-Check-Time-of-Use race. Two simultaneous feedback submissions could both read version=3, both try to create version=4, and one fails with a unique constraint violation.
- Fix: Use a Prisma transaction, or better — use `@@unique([engagementId, version])` (already in schema) and catch the unique constraint error with a retry loop.

---

**[I-07] feedback-router.ts: `engagement.agentJobs` not scoped to latest pipeline run**
- File: `backend/src/agents/orchestrator/feedback-router.ts` lines ~58–62
- `agentJobs: { where: { status: JobStatus.COMPLETED }, orderBy: { completedAt: 'desc' } }` — fetches all completed jobs for the engagement, not just the current pipeline run. If an engagement has gone through multiple revision cycles, `jobOutputs` will contain outputs from old runs mixed with current ones. The most recent output per agent is actually what you want.
- Fix: After collecting `jobOutputs`, deduplicate by agent name keeping only the most recently completed job per agent. The current `orderBy: { completedAt: 'desc' }` helps but the map population `jobOutputs[job.agentName] = job.output` will be overwritten correctly only if the array is ordered latest-first. Verify this is the case and add a comment.

---

## 🔵 MINOR — Address when convenient

**[M-01] dispatcher.py: trailing whitespace on `"sow": sow_run,` line**
- File: `ai-service/workers/dispatcher.py`
- `"sow":       sow_run,          # Sprint 5 ✅` has extra trailing spaces. Cosmetic, but run `ruff format` to clean up.

**[M-02] sow_maker.py: unused `import asyncio` at bottom of `run()`**
- File: `ai-service/workers/sow_maker.py` — full mode block
- `import asyncio` is inside the function but `asyncio.gather` is never actually called (the loop uses `await` sequentially). Remove the import.

**[M-03] gate-reminder.scheduler.ts: no max reminder cap**
- A gate open for 7 days will send a reminder every hour — 168 reminders. Add a `max_reminders` system config or cap at 3 reminders per gate before going quiet.

**[M-04] internal.routes.ts: `action: 'AGENT_INVOKED' as any` — use proper enum**
- Same as I-04 above, also applies to the `tryAdvancePipeline` call in pipeline-advance.ts which uses `'AGENT_INVOKED' as any`.

**[M-05] packaging.py: PPTX slide layout hardcoded to index 6**
- `prs.slide_layouts[6]` — blank layout — is fragile. If the template changes, index 6 may not be blank. Use layout by name or add a comment that this assumes a standard PPTX template.

**[M-06] ai-client.ts: no retry on 5xx from ai-service**
- A transient 500 from the Python service causes immediate failure. A simple 1-retry with 500ms delay for 5xx would improve resilience significantly.

---

## ✅ What's done well

- **Architecture boundary is clean**: Node has zero LLM calls. Every AI operation goes through `ai-client.ts` → Python. The line is enforced at the env.ts level (LLM API keys not even available to Node). Excellent.
- **Parallel scoring with `return_exceptions=True`**: The scorer correctly handles provider failures without crashing the whole scoring run. One bad provider → degraded result, not a failed job.
- **Language validator in SOW**: Auto-revises banned vague words before surfacing to AM. Max 2 revision cycles prevents infinite loops. Clean pattern.
- **Dispatcher exception handling**: Worker exceptions are caught, logged, and FAILED callback is sent to Node. Node always knows what happened.
- **Internal secret on all Python routes**: Every router has the `_verify_internal_secret` dependency. None are accidentally unprotected.
- **Fire-and-forget pipeline advancement**: `tryAdvancePipeline` failing doesn't fail the job-update callback. Python gets its 204 regardless. The right failure isolation.
- **`findFirst` + create pattern for GateApprovals**: Correctly avoids upsert issues from missing unique index on ungenerated Prisma client. Pragmatic.
- **Feedback router fallback**: When no keyword matches, routes to PACKAGING_AGENT as safe default rather than failing.
- **Diff summary written back to EngagementVersion**: Diffgen job output correctly wired back to update `diffSummary` on the version record.

---

## Required fixes before Sprint 6 starts

| # | Fix | File | Priority |
|---|-----|------|----------|
| B-01 | Delete dead stub comment block | dispatcher.py | 🔴 |
| B-02 | Race condition guard on pipeline-advance | pipeline-advance.ts | 🔴 |
| B-03 | Write complianceMatrix to GateApproval on scoring complete | internal.routes.ts | 🔴 |
| B-04 | Fix SOW role check (roles are objects, not strings) | sow.routes.ts | 🔴 |
| B-05 | Increase sync HTTP timeouts on ai-client.ts | ai-client.ts | 🔴 |
| I-01 | Move worker imports to module level | dispatcher.py | 🟡 |
| I-02 | Replace deprecated get_event_loop() in packaging.py | packaging.py | 🟡 |
| I-03 | Replace deprecated get_event_loop() in scorer.py | scorer.py | 🟡 |
| I-04 | Use correct AuditAction enum values | internal.routes.ts | 🟡 |
| I-05 | Add take:10 safety limit on reviewer query + comment | gate.routes.ts | 🟡 |
| I-06 | Add race protection on version number assignment | version.routes.ts | 🟡 |
| I-07 | Clarify/verify latest-first ordering in feedback-router | feedback-router.ts | 🟡 |

---

*Warden out. Fix the 5 blocking issues and 7 important ones before Sprint 6 begins.*
