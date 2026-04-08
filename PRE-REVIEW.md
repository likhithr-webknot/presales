# PRE-REVIEW.md — Sprint 0
*Self-correction checklist before Warden review*
*Written by: Forge | Date: 2026-04-07*

---

## Checklist

### ✅ All Sprint 0 tasks complete?
- [x] S0-B-01: Monorepo scaffold + docker-compose
- [x] S0-B-02: Prisma schema + migration + seed
- [x] S0-B-03: Config + env validation (Zod, fail-fast)
- [x] S0-B-04: Google SSO + JWT cookie auth
- [x] S0-B-05: RBAC middleware (requireRole + engagement access)
- [x] S0-B-06: BullMQ queues + stub workers
- [x] S0-B-07: Socket.io WebSocket server + typed events
- [x] S0-B-08: MinIO storage service + bucket init
- [x] S0-B-09: All 3 adapter interfaces + stubs + real (NotImplementedError)
- [x] S0-B-10: Error middleware + /health endpoint
- [x] S0-F-01: React + Vite scaffold + Router v6 + AuthGuard
- [x] S0-F-02: Login page with Google SSO button

### ✅ TypeScript compiles clean?
- [x] Backend: `npx tsc --noEmit` → 0 errors
- [x] Frontend: `npx tsc --noEmit` → 0 errors

### ✅ All env vars in .env.example?
- [x] All vars from LLD manifest present
- [x] Each var has a description comment
- [x] Required vs optional clearly marked
- [x] Adapter toggle vars documented with when to use 'real'

### ✅ Adapter stubs correctly typed?
- [x] All 3 interfaces defined with full TypeScript types
- [x] Stub implementations satisfy interfaces
- [x] Real implementations satisfy interfaces but throw NotImplementedError
- [x] Factory reads env vars and returns correct implementation
- [x] Factory validates real adapter env vars before constructing

### ✅ /health works correctly?
- [x] Real probes: Prisma `SELECT 1`, Redis `PING`, MinIO `HeadBucket`
- [x] Returns 200 when all healthy, 503 when any degraded
- [x] Response includes timestamp and per-service boolean

### ✅ No hardcoded secrets?
- [x] All credentials via env vars (no hardcoded keys, passwords, or URLs)
- [x] EMAIL_FROM is configurable — not hardcoded to any address
- [x] SMTP config fully from env vars

### ✅ No stack traces to client?
- [x] error.middleware.ts strips stack traces in production
- [x] Returns `stack` only when NODE_ENV === 'development'

---

## Known Shortcuts / Warden Should Know

1. **JWT_EXPIRY env var not wired into jwt.sign() options** — jsonwebtoken's `SignOptions.expiresIn` type doesn't accept arbitrary strings at compile time without casting. Currently hardcoded to `'7d'` in SignOptions. JWT_EXPIRY is validated by Zod but not yet used. Sprint 1 fix: wrap jwt.sign in a utility function that accepts the env value.

2. **Prisma global singleton** — uses `globalThis` pattern for dev hot-reload. Standard pattern, no issues expected in production.

3. **Stub workers update AgentJob only when job.data.jobId is present** — jobs without a DB ID (test jobs) are handled gracefully (no crash, just no DB update). Real workers in later sprints always set jobId.

4. **Frontend page stubs** — Dashboard, Engagement, Approvals, Admin pages are placeholder components. Full UI is Sprint 7. This is by design.

5. **No rate limiting yet** — planned for Sprint 10. Not a Sprint 0 concern.

6. **pgvector embedding column not in Prisma schema** — uses `Unsupported` type workaround. Added via raw SQL in `migrations/0001_initial.sql`. Must be run manually after `prisma migrate dev` creates the base tables. Documented in migration file and LLD.

---

## Ready for Warden Review: YES
