# Warden Review — Sprint 7
*Reviewer: Warden 🛡 (conducted by Goku acting as Warden — gateway unavailable)*
*Date: 2026-04-08*
*Sprint: 7 — Full Frontend*
*Files reviewed:*
- `frontend/src/services/api.ts`
- `frontend/src/services/socket.ts`
- `frontend/src/hooks/useAuth.ts`
- `frontend/src/hooks/useEngagementStatus.ts`
- `frontend/src/components/AgentFeed.tsx`
- `frontend/src/components/GatePanel.tsx`
- `frontend/src/components/CascadeBanner.tsx`
- `frontend/src/components/PipelineProgress.tsx`
- `frontend/src/components/AuditTimeline.tsx`
- `frontend/src/components/StatusBadge.tsx`
- `frontend/src/pages/Engagement/index.tsx`
- `frontend/src/pages/Dashboard/index.tsx`
- `frontend/src/pages/Approvals/index.tsx`
- `frontend/src/pages/Admin/index.tsx`
- `frontend/src/pages/Login/index.tsx`
- `frontend/src/main.tsx`

---

## VERDICT: REVIEW_FAIL → FIXED → PASS ✅

Initial verdict: REVIEW_FAIL. All blocking and important findings fixed in same session. Sprint 8 is authorized.

---

## 🔴 BLOCKING — Must fix before Sprint 8

---

**[B-01] Approvals page hits a non-existent backend route**

`ApprovalsPage` calls `POST /api/approvals/:token`. This route does **not exist** in the backend. The backend's gate approval flow is `POST /api/engagements/:id/gates/:gateNumber/approve` — it requires the reviewer to be authenticated (JWT middleware) and identified by their `req.user.id`.

The email token approval flow was never built on the backend. The Approvals page is a dead page that will always 404.

Fix options:
- **(a) Quick fix:** Redirect `/approvals/:token` to the dashboard with an explanatory message ("Please log in and approve via the Gates tab"), since external reviewers aren't supported yet.
- **(b) Correct fix (Sprint 8):** Build `POST /api/approvals/token/:token` on the backend — validates token, extracts engagementId + gateNumber + reviewerId, calls approve logic. This is Sprint 8 work.

For now: implement option (a) so the page doesn't silently fail.

---

**[B-02] `useEngagementStatus` WS listeners not scoped to the current engagement room**

The `invalidate` callback in `useEngagementStatus` runs on **any** WebSocket event from the socket — not just events for the current engagement. The socket is a module-level singleton (`getSocket()`). If two engagement pages were open simultaneously (or if there's a race on navigation), a `job_completed` for engagement A would invalidate the query for engagement B.

More critically: the socket listener is attached inside `useEffect`, but the `invalidate` function closes over `key` which is derived from `engagementId`. If the user navigates quickly (A → B → back to A), there's a brief window where stale listeners from the previous mount could fire against the wrong key.

Fix: Add a per-event guard to check the `engagementId` from the WS payload matches before invalidating:

```typescript
const handler = (data: { engagementId?: string }) => {
  if (data.engagementId && data.engagementId !== engagementId) return
  queryClient.invalidateQueries({ queryKey: key })
}
```

This requires WS event payloads to include `engagementId` — confirm the backend emits it (it does, via `emit(engagementId, event, data)` which uses rooms, but the client listener fires regardless of room if both are joined).

---

**[B-03] `EngagementPage` uses `id!` non-null assertion without a guard**

`const { id } = useParams<{ id: string }>()` — `id` can be `undefined` if the route is misconfigured. Multiple places use `id!` without checking first (e.g., `engagementsApi.message(id!, msg)`, `useEngagementStatus(id!)`).

In React Router v6, `useParams` returns `string | undefined` for optional segments. If someone navigates to `/engagements/` (no id), the page crashes at `useEngagementStatus(undefined!)`.

Fix: Add an early return guard at the top of `EngagementPage`:

```typescript
if (!id) return <Navigate to="/dashboard" replace />
```

Then all `id!` usages are safe.

---

## 🟡 IMPORTANT — Fix before Sprint 8 ships

---

**[I-01] `GatePanel` approval action has no error feedback to the user**

`handleApprove` sets `loading` state but has no `catch` block. If the approve API call fails (network error, 403, stale token), the loading spinner just stops and nothing happens. The user has no idea whether their approval was recorded.

Fix: Add error handling:

```typescript
const [error, setError] = useState<string | null>(null)

const handleApprove = async (gateNumber: string, approved: boolean) => {
  setLoading(p => ({ ...p, [gateNumber]: true }))
  setError(null)
  try {
    await gatesApi.approve(engagementId, gateNumber, { approved, feedback: feedback[gateNumber] })
    onAction?.()
  } catch (e: any) {
    setError(e?.response?.data?.message ?? 'Approval failed. Please try again.')
  } finally {
    setLoading(p => ({ ...p, [gateNumber]: false }))
  }
}
```

---

**[I-02] Dashboard logout uses raw `fetch` instead of `authApi.logout`**

```tsx
fetch('/auth/logout', { method: 'POST', credentials: 'include' }).then(() => navigate('/login'))
```

This bypasses the `api` axios instance (which has `withCredentials` and the correct baseURL set). On production where the API is on a different domain, this raw `fetch` to `/auth/logout` will hit the Vite dev server, not the backend.

Fix: Use `authApi.logout()` and clear the react-query cache:

```tsx
authApi.logout().then(() => {
  queryClient.clear()
  navigate('/login')
})
```

---

**[I-03] `AgentFeed` WS listener never cleaned up when component re-renders with new props**

The `useEffect` in `AgentFeed` has an empty dependency array `[]`. The `job_failed` handler is registered once and never changes. This is correct for the singleton socket — but the issue is `liveFailures` state can accumulate indefinitely across the component lifecycle. If the user stays on the engagement page for a long time, `liveFailures` will grow unbounded as jobs fail and retry.

Fix: Add a cap to `liveFailures` (keep last 10), or clear it when the parent `failed` prop is empty (meaning backend confirmed no failures):

```typescript
useEffect(() => {
  if (failed.length === 0) setLiveFailures([])
}, [failed.length])
```

---

**[I-04] `VersionCard` uses `version: any` instead of the typed `EngagementVersion`**

```tsx
function VersionCard({ version, engagementId }: { version: any; engagementId: string }) {
```

`EngagementVersion` is already exported from `api.ts`. Using `any` bypasses all type safety and means a shape mismatch between backend and frontend won't be caught at compile time.

Fix: `{ version: EngagementVersion; engagementId: string }` — import and use the proper type.

---

**[I-05] `CascadeBanner` `engagementId` prop is declared but never used**

```tsx
interface Props {
  engagementId: string  // ← accepted but never used
  onRestart?: () => void
}
```

The `useEffect` attaches the socket listener without any per-engagement scoping (same issue as B-02 above). The `engagementId` prop was presumably intended for this purpose but the implementation never uses it.

Fix: Use `engagementId` to scope the listener, same fix as B-02:

```typescript
const handler = (data: WsCascadeDetected & { engagementId?: string }) => {
  if (data.engagementId && data.engagementId !== engagementId) return
  setEvent(data)
}
```

---

**[I-06] `useEngagementStatus` `key` array defined inside the hook but used in `useEffect` without being in the dependency array**

```typescript
const key = ['engagement-status', engagementId]
// ...
useEffect(() => {
  // uses `key` inside via `queryClient.invalidateQueries({ queryKey: key })`
}, [engagementId])  // `key` is missing from deps
```

`key` is recreated on every render, so React's linter would flag this. While `key` is derived deterministically from `engagementId` (so functionally correct), it's non-idiomatic and will cause eslint-plugin-react-hooks warnings.

Fix: Either use `useCallback` for `invalidate`, or inline the key in the effect:

```typescript
const invalidate = useCallback(
  () => queryClient.invalidateQueries({ queryKey: ['engagement-status', engagementId] }),
  [queryClient, engagementId]
)
```

---

## 🔵 MINOR — Fix when convenient

**[M-01] `socket.ts` — module-level singleton socket is never disconnected**

`getSocket()` creates one socket for the entire app lifetime and never calls `.disconnect()`. On SPA navigation this is fine, but if the user's session expires (JWT expired), the socket stays connected with stale auth. Add a `disconnectSocket()` export that the logout handler calls.

**[M-02] `api.ts` — no global 401 interceptor**

If the JWT expires mid-session, API calls will return 401 but the user won't be redirected to login — react-query will just show an error state. Add an axios response interceptor in `api.ts`:

```typescript
api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) window.location.href = '/login'
    return Promise.reject(err)
  }
)
```

**[M-03] `Dashboard` — `timeSince` returns "Today" for any same-calendar-day update, even if it was 23h ago**

`Math.floor(diff / 86400000) === 0` is true for anything less than 24 hours. An engagement updated at 1am that you view at 11pm reads "Today" — which is accurate — but one updated at midnight yesterday also reads "Yesterday" rather than "23h ago". Minor UX nit, not a bug.

**[M-04] `Admin` page — no loading state on the engagements query**

The admin table renders nothing while `isLoading` is true (default `[]` from `useQuery`). Should show a loading indicator.

**[M-05] `PipelineProgress` — step labels are just "Step 1", "Step 2" etc.**

No agent names shown in the progress bar — just step numbers. This means the AM has no idea what "Step 3" means. Suggestion for Sprint 8: show the primary agent name per step (e.g. "Research", "Packaging").

---

## ✅ What's done well

- **Adaptive polling in `useEngagementStatus`**: 5s when active, 30s when idle. Correct and efficient.
- **Dual invalidation strategy (poll + WS)**: WS events invalidate react-query cache for immediate UI updates, polling provides resilience if WS drops. Best of both worlds.
- **Chat auto-switches intake/feedback mode**: Detecting `completedSteps > 0 && !hasActiveWork` is the right heuristic. Avoids requiring AM to manually switch modes.
- **`AgentFeed` merges WS failures with DB-sourced failures**: Deduplication by jobId is correct. WS failures appear immediately, then are replaced by the stable DB version on next poll.
- **Gate filter in `GatePanel`**: Correctly hides SOW_AM/SOW_DM from the gate panel (those have their own SOW flow). Clean separation.
- **`CascadeBanner` is dismissable**: User can clear it after reading. Good UX.
- **`AuditTimeline` time-ago formatting**: Clean and readable.
- **Login page avoids hardcoding**: Uses `VITE_API_URL` env var for the SSO redirect link.
- **TypeScript strict mode passes**: 0 errors on `tsc --noEmit`. Solid baseline.

---

## Required fixes before Sprint 8

| # | Fix | File | Priority |
|---|-----|------|----------|
| B-01 | Approvals page — fix dead `/api/approvals/:token` route | Approvals/index.tsx | 🔴 |
| B-02 | WS listeners not scoped to engagement — any event invalidates any query | useEngagementStatus.ts | 🔴 |
| B-03 | `id!` non-null assertion without guard in EngagementPage | Engagement/index.tsx | 🔴 |
| I-01 | GatePanel has no error feedback on failed approval | GatePanel.tsx | 🟡 |
| I-02 | Dashboard logout bypasses api client | Dashboard/index.tsx | 🟡 |
| I-03 | AgentFeed liveFailures grows unbounded | AgentFeed.tsx | 🟡 |
| I-04 | VersionCard uses `any` instead of `EngagementVersion` | Engagement/index.tsx | 🟡 |
| I-05 | CascadeBanner ignores `engagementId` prop — WS not scoped | CascadeBanner.tsx | 🟡 |
| I-06 | `key` missing from useEffect deps in useEngagementStatus | useEngagementStatus.ts | 🟡 |
| M-01 | Socket singleton never disconnected on logout | socket.ts | 🔵 |
| M-02 | No 401 interceptor — expired sessions stay silently broken | api.ts | 🔵 |
| M-03 | timeSince accuracy edge case | Dashboard/index.tsx | 🔵 |
| M-04 | Admin page missing loading state | Admin/index.tsx | 🔵 |
| M-05 | PipelineProgress shows "Step N" not agent names | PipelineProgress.tsx | 🔵 |

---

*Warden out. Fix the 3 blocking + 6 important issues before Sprint 8 is authorized.*
