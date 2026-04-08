# PRE-REVIEW.md — Sprint 1
*Self-correction checklist before Warden review*
*Written by: Forge (Goku acting as Forge) | Date: 2026-04-07*

---

## Checklist

### ✅ All Sprint 1 tasks complete?
- [x] S1-B-01: Engagement CRUD — POST, GET (list + single), PATCH, DELETE (soft cancel)
- [x] S1-B-02: Document upload — multer, MinIO storage, PDF/DOCX parsing, DB record
- [x] S1-B-03: Intake parser — GPT-5 Mini extracts structured fields, merges with existing context, identifies missing fields
- [x] S1-B-04: Collateral type detector — rule-based fast path + LLM fallback
- [x] S1-B-05: State machine — valid transitions, InvalidTransitionError, AuditLog on every transition
- [x] S1-B-06: /message route — intake parse → gap check → follow-up question OR dispatch agents
- [x] S1-B-07: Routing map — all 8 collateral types mapped to agent pipelines with parallel/sequential annotations
- [x] S1-B-08: Context carry-forward — per-stage artifact filtering, uploads included
- [x] S1-B-09: Advance stage route — validates no pending jobs, loads carry-forward context, AuditLog
- [x] S1-B-10: Audit logger — thin wrapper, never crashes main flow, called from all key actions
- [x] LLM router — TaskType → LLMTier → provider + model; callLLM + callLLMJson helpers
- [x] TypeScript: 0 errors with noUnusedLocals + noUnusedParameters

### ✅ Routes wired?
- [x] /api/engagements (CRUD)
- [x] /api/engagements/:id/message
- [x] /api/engagements/:id/advance-stage
- [x] /api/engagements/:id/status
- [x] /api/engagements/:id/versions
- [x] /api/engagements/:id/versions/:v
- [x] /api/engagements/:id/audit
- [x] /api/engagements/:id/feedback (stub — full routing in Sprint 4)
- [x] /api/uploads (POST, GET, DELETE)
- [x] /api/jobs/:id (GET, retry, cancel)

### ✅ Architectural rules maintained?
- [x] Orchestrator is single dispatch point — agents invoked only via handleMessage()
- [x] No agent-to-agent direct calls
- [x] All LLM calls go through router.ts (task → tier → model)
- [x] Audit logger never throws — errors swallowed with console.error
- [x] No hardcoded secrets

---

## Known Shortcuts / Warden Should Know

1. **Feedback routing is a stub** — POST /api/engagements/:id/feedback records the feedback in AuditLog but does not yet route to specific agents. Full implementation in Sprint 4 (requires agents to exist first).

2. **/message dispatch fires only the first pipeline step** — subsequent steps (e.g., packaging after research completes) are not yet chained. Full pipeline chaining requires Sprint 2 real workers with completion callbacks. For now, all first-step agents are dispatched and run as stubs.

3. **MeetMinds adapter mapped to 'research' queue** — a pragmatic temporary mapping since MeetMinds has no dedicated queue. This will be corrected in Sprint 2 when the MeetMinds integration is wired properly.

4. **Document parser returns a placeholder string for XLSX** — real XLSX parsing (e.g. using exceljs) is deferred to Sprint 2 when it's actually needed for Q&A spreadsheets.

5. **Warden M-02 (WebSocket room access check)** — still deferred to before Sprint 2 ships, per Warden's note.

---

## Ready for Warden Review: YES
