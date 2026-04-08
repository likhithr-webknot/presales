# INTERFACE.md — Presales Orchestrator API Contract
*Written by Forge after Sprint 6. Nova reads this before writing any API calls.*
*Last updated: 2026-04-08*

---

## Base URL
- Dev: `http://localhost:3000`
- All routes require `Authorization: Bearer <jwt>` (set via cookie — `withCredentials: true`)
- All POST/PATCH bodies: `Content-Type: application/json`

## Auth
| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/google` | Initiate Google SSO redirect |
| GET | `/auth/google/callback` | OAuth callback — sets JWT cookie, redirects to `/dashboard` |
| GET | `/auth/me` | Returns `AuthUser` — use to check session |
| POST | `/auth/logout` | Clears JWT cookie |

**AuthUser shape:**
```ts
{ id: string; email: string; name: string; roles: RoleType[] }
// RoleType: 'AM' | 'DM' | 'SALES_HEAD' | 'REVIEWER' | 'ADMIN'
```

---

## Engagements

### CRUD
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/engagements` | Any | List engagements (AM sees own; ADMIN sees all) |
| POST | `/api/engagements` | Any | Create engagement |
| GET | `/api/engagements/:id` | Access | Get single engagement |
| PATCH | `/api/engagements/:id` | Access | Update fields — triggers cascade detection |
| DELETE | `/api/engagements/:id` | ADMIN | Soft-delete (sets status=CANCELLED) |

**List response:**
```ts
Engagement[] // ordered by updatedAt desc
```

**Create body:**
```ts
{
  clientName: string        // required
  domain: string            // required
  collateralType: CollateralType  // required
  opportunityContext?: string
  contactDetails?: Record<string, unknown>
}
```

**PATCH body** (all optional):
```ts
{
  clientName?: string
  domain?: string
  opportunityContext?: string
  collateralType?: CollateralType
  contactDetails?: Record<string, unknown>
}
```

**PATCH response:**
```ts
{
  engagement: Engagement,
  cascade: CascadeResult  // hasCascade, changedFields, cancelledJobIds, requiresManualRestart
}
```

### Message (Intake / Orchestrator)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/engagements/:id/message` | Send AM message — Orchestrator parses + dispatches agents |

**Body:** `{ message: string }`

**Response:**
```ts
{
  parsed: ParsedFields          // extracted fields so far
  collateralDetected: string    // detected collateral type
  allFieldsCollected: boolean
  missingFields: string[]       // list missing fields if not all collected
  dispatched: boolean           // true = agents were dispatched
}
```

### Feedback
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/engagements/:id/feedback` | Route AM feedback to correct agent |

**Body:** `{ feedback: string; targetSection?: string }`
**Response:** `{ routedTo: AgentName; jobId: string; message: string }`

### Stage Advance
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/engagements/:id/advance-stage` | Advance to next stage |

---

## Status (Unified — use this for dashboard polling)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/engagements/:id/status` | Full engagement state in one call |

**Response:**
```ts
{
  engagement: { id, clientName, domain, collateralType, stage, status, currentBlocker, opportunityContext, createdAt, updatedAt }
  pipeline: {
    totalSteps: number
    currentStepIndex: number     // -1 = not started
    currentStepAgents: AgentName[]
    nextStepAgents: AgentName[]
    completedSteps: number
  }
  jobs: {
    active: AgentJob[]           // QUEUED or RUNNING
    failed: AgentJob[]           // FAILED
    completed: number            // count only
  }
  gates: GateSummary[]           // per gate number with overallStatus + approvals[]
  sow: { amApproval, dmApproval, fullyApproved }
  latestVersion: { ...version, storageKey: string | null }  // use /artifacts/download for URL
  recentActivity: AuditLog[]     // last 10 events
  health: { hasBlockedGate, hasCriticalError, hasActiveWork, isComplete }
}
```

---

## Gates
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/engagements/:id/gates/:gateNumber/submit` | Submit for gate review (triggers scoring) |
| POST | `/api/engagements/:id/gates/:gateNumber/approve` | Reviewer approves/rejects |
| POST | `/api/engagements/:id/gates/:gateNumber/override` | AM override with justification |
| POST | `/api/engagements/:id/gates/:gateNumber/assign-reviewer` | Assign reviewer |

**gateNumber values:** `GATE_1` | `GATE_2` | `GATE_3` | `DEFENSE_GATE`

**Submit body:** `{ content: Record<string, unknown>; rfpRequirements?: string }`

**Approve body:** `{ approved: boolean; feedback?: string }`

**Override body:** `{ justification: string }`

---

## SOW
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/engagements/:id/sow/start` | Start SOW generation |
| POST | `/api/engagements/:id/sow/sections/:section/confirm` | AM confirms a section |
| POST | `/api/engagements/:id/sow/sections/:section/revise` | AM requests revision |
| POST | `/api/engagements/:id/sow/approve` | AM or DM approves SOW |
| GET | `/api/engagements/:id/sow/status` | SOW status + dual approval state |

**Start body:** `{ mode?: 'full' | 'section'; section?: string }`

**Approve body:** `{ feedback?: string }`

**SOW status response:**
```ts
{
  sowJobStatus: JobStatus | 'NOT_STARTED'
  amApproval: GateStatus | 'PENDING'
  dmApproval: GateStatus | 'PENDING'
  finalApproved: boolean
}
```

---

## Versions & Artifacts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/engagements/:id/versions` | List all versions |
| POST | `/api/engagements/:id/versions` | Create new version manually |
| GET | `/api/engagements/:id/artifacts/download` | Get presigned MinIO URL for latest artifact |

**Artifact download query params:** `?version=<number>&format=pptx|docx|pdf`

**Artifact download response:** `{ downloadUrl: string; format: string; fileKey?: string }`

---

## Audit Trail
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/engagements/:id/audit` | Paginated audit log |
| GET | `/api/engagements/:id/audit/summary` | Summary counts + recent activity |
| GET | `/api/audit/global` | ADMIN: cross-engagement log |

**Audit query params:** `?page=1&limit=50&action=<AuditAction>&userId=<uuid>&fromDate=<ISO>&toDate=<ISO>`

---

## MeetMinds Reference
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/engagements/:id/meetminds-reference` | Attach MeetMinds session reference |

**Body:** `{ meetmindsSessionId: string; summary?: string }`

---

## WebSocket Events
Connect to: `ws://localhost:3000` with `{ withCredentials: true }`
Join room after connect: `socket.emit('join', { engagementId })`

| Event | Direction | Payload |
|-------|-----------|---------|
| `job_started` | Server→Client | `{ agentName, jobId, jobDbId, timestamp }` |
| `job_progress` | Server→Client | `{ agentName, jobId, message, percentComplete? }` |
| `job_completed` | Server→Client | `{ agentName, jobId, outputSummary, timestamp }` |
| `job_failed` | Server→Client | `{ agentName, jobId, errorMessage, options: [{id, label, description}] }` |
| `gate_ready` | Server→Client | `{ gateNumber, complianceMatrix, reviewerEmails, timestamp }` |
| `gate_approved` | Server→Client | `{ gateNumber, reviewerName, feedback?, allApproved, timestamp }` |
| `gate_rejected` | Server→Client | `{ gateNumber, reviewerName, feedback, timestamp }` |
| `gate_reminder` | Server→Client | `{ gateNumber, pendingReviewers, hoursWaiting }` |
| `artifact_ready` | Server→Client | `{ collateralType, format, downloadUrl, version, timestamp }` |
| `cascade_detected` | Server→Client | `{ changedFields, invalidatedAgents, cancelledJobIds, staleJobIds, staleVersionIds, requiresManualRestart, message, timestamp }` |
| `sow_section_ready` | Server→Client | `{ section, content, sectionIndex, totalSections, requiresConfirmation }` |

---

## Enums (reference)

```ts
CollateralType = 'FIRST_MEETING_DECK' | 'POST_DISCOVERY_DECK' | 'TECHNICAL_PROPOSAL' |
  'PROPOSAL_DEFENSE_DECK' | 'STATEMENT_OF_WORK' | 'COMMERCIAL_ESTIMATION' |
  'CASE_STUDY_DOCUMENT' | 'MARKETING_CONTENT'

EngagementStage = 'STAGE_1' | 'STAGE_2' | 'STAGE_3' | 'STAGE_4' | 'STAGE_5'

EngagementStatus = 'INITIATED' | 'RESEARCH_COMPLETE' | 'PROPOSAL_IN_PROGRESS' |
  'UNDER_REVIEW' | 'APPROVED' | 'DELIVERED' | 'BLOCKED' | 'CANCELLED'

GateNumber = 'GATE_1' | 'GATE_2' | 'GATE_3' | 'DEFENSE_GATE' | 'SOW_AM' | 'SOW_DM'

GateStatus = 'PENDING' | 'APPROVED' | 'APPROVED_WITH_FEEDBACK' | 'REJECTED'

JobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
```
