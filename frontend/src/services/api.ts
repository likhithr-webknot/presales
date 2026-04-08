import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  withCredentials: true,
})

// M-02 fix: redirect to login on 401 so expired sessions don't silently break the UI
api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Types ─────────────────────────────────────────────────────────────────────

export type RoleType = 'AM' | 'DM' | 'SALES_HEAD' | 'REVIEWER' | 'ADMIN'
export type CollateralType =
  | 'FIRST_MEETING_DECK' | 'POST_DISCOVERY_DECK' | 'TECHNICAL_PROPOSAL'
  | 'PROPOSAL_DEFENSE_DECK' | 'STATEMENT_OF_WORK' | 'COMMERCIAL_ESTIMATION'
  | 'CASE_STUDY_DOCUMENT' | 'MARKETING_CONTENT'
export type EngagementStage = 'STAGE_1' | 'STAGE_2' | 'STAGE_3' | 'STAGE_4' | 'STAGE_5'
export type EngagementStatus =
  | 'INITIATED' | 'RESEARCH_COMPLETE' | 'PROPOSAL_IN_PROGRESS'
  | 'UNDER_REVIEW' | 'APPROVED' | 'DELIVERED' | 'BLOCKED' | 'CANCELLED'
export type GateNumber = 'GATE_1' | 'GATE_2' | 'GATE_3' | 'DEFENSE_GATE' | 'SOW_AM' | 'SOW_DM'
export type GateStatus = 'PENDING' | 'APPROVED' | 'APPROVED_WITH_FEEDBACK' | 'REJECTED'
export type JobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export interface AuthUser {
  id: string
  email: string
  name: string
  avatarUrl?: string
  roles: RoleType[]
}

export interface Engagement {
  id: string
  clientName: string
  domain: string
  collateralType: CollateralType
  opportunityContext?: string
  stage: EngagementStage
  status: EngagementStatus
  currentBlocker?: string
  createdAt: string
  updatedAt: string
}

export interface AgentJob {
  id: string
  agentName: string
  status: JobStatus
  error?: string
  createdAt: string
  startedAt?: string
  completedAt?: string
}

export interface GateApproval {
  id: string
  gateNumber: GateNumber
  status: GateStatus
  feedback?: string
  approvedAt?: string
  reviewer: { id: string; name: string; email: string; avatarUrl?: string }
}

export interface GateSummary {
  gateNumber: string
  overallStatus: GateStatus | 'NOT_STARTED'
  approvals: GateApproval[]
}

export interface EngagementVersion {
  id: string
  version: number
  isLatest: boolean
  changeReason?: string
  diffSummary?: string
  artifacts: Record<string, unknown>
  storageKey?: string
  createdAt: string
}

export interface AuditLog {
  id: string
  action: string
  detail?: Record<string, unknown>
  createdAt: string
  user?: { id: string; name: string; avatarUrl?: string }
}

export interface EngagementStatusResponse {
  engagement: Engagement
  pipeline: {
    totalSteps: number
    currentStepIndex: number
    currentStepAgents: string[]
    nextStepAgents: string[]
    completedSteps: number
  }
  jobs: { active: AgentJob[]; failed: AgentJob[]; completed: number }
  gates: GateSummary[]
  sow: { amApproval: string; dmApproval: string; fullyApproved: boolean }
  latestVersion: EngagementVersion | null
  recentActivity: AuditLog[]
  health: {
    hasBlockedGate: boolean
    hasCriticalError: boolean
    hasActiveWork: boolean
    isComplete: boolean
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  me: () => api.get<AuthUser>('/auth/me').then(r => r.data),
  logout: () => api.post('/auth/logout'),
}

// ── Engagements ───────────────────────────────────────────────────────────────

export const engagementsApi = {
  list: () => api.get<Engagement[]>('/api/engagements').then(r => r.data),

  get: (id: string) => api.get<Engagement>(`/api/engagements/${id}`).then(r => r.data),

  create: (body: {
    clientName: string
    domain: string
    collateralType: CollateralType
    opportunityContext?: string
  }) => api.post<Engagement>('/api/engagements', body).then(r => r.data),

  patch: (id: string, body: Partial<Engagement>) =>
    api.patch<{ engagement: Engagement; cascade: unknown }>(`/api/engagements/${id}`, body).then(r => r.data),

  message: (id: string, message: string) =>
    api.post<{
      parsed: Record<string, unknown>
      collateralDetected: string
      allFieldsCollected: boolean
      missingFields: string[]
      dispatched: boolean
    }>(`/api/engagements/${id}/message`, { message }).then(r => r.data),

  feedback: (id: string, feedback: string, targetSection?: string) =>
    api.post<{ routedTo: string; jobId: string; message: string }>(
      `/api/engagements/${id}/feedback`,
      { feedback, targetSection }
    ).then(r => r.data),

  status: (id: string) =>
    api.get<EngagementStatusResponse>(`/api/engagements/${id}/status`).then(r => r.data),
}

// ── Gates ─────────────────────────────────────────────────────────────────────

export const gatesApi = {
  submit: (engagementId: string, gateNumber: string, body: { content: Record<string, unknown>; rfpRequirements?: string }) =>
    api.post(`/api/engagements/${engagementId}/gates/${gateNumber}/submit`, body).then(r => r.data),

  approve: (engagementId: string, gateNumber: string, body: { approved: boolean; feedback?: string }) =>
    api.post(`/api/engagements/${engagementId}/gates/${gateNumber}/approve`, body).then(r => r.data),

  override: (engagementId: string, gateNumber: string, justification: string) =>
    api.post(`/api/engagements/${engagementId}/gates/${gateNumber}/override`, { justification }).then(r => r.data),
}

// ── SOW ───────────────────────────────────────────────────────────────────────

export const sowApi = {
  start: (engagementId: string) =>
    api.post(`/api/engagements/${engagementId}/sow/start`, { mode: 'full' }).then(r => r.data),

  confirm: (engagementId: string, section: string) =>
    api.post(`/api/engagements/${engagementId}/sow/sections/${section}/confirm`).then(r => r.data),

  revise: (engagementId: string, section: string, feedback: string) =>
    api.post(`/api/engagements/${engagementId}/sow/sections/${section}/revise`, { feedback }).then(r => r.data),

  approve: (engagementId: string, feedback?: string) =>
    api.post(`/api/engagements/${engagementId}/sow/approve`, { feedback }).then(r => r.data),

  status: (engagementId: string) =>
    api.get<{ sowJobStatus: string; amApproval: string; dmApproval: string; finalApproved: boolean }>(
      `/api/engagements/${engagementId}/sow/status`
    ).then(r => r.data),
}

// ── Versions & Artifacts ──────────────────────────────────────────────────────

export const artifactsApi = {
  download: (engagementId: string, format = 'pptx') =>
    api.get<{ downloadUrl: string; format: string }>(
      `/api/engagements/${engagementId}/artifacts/download`,
      { params: { format } }
    ).then(r => r.data),

  versions: (engagementId: string) =>
    api.get<EngagementVersion[]>(`/api/engagements/${engagementId}/versions`).then(r => r.data),
}

// ── Audit ─────────────────────────────────────────────────────────────────────

export const auditApi = {
  list: (engagementId: string, params?: { page?: number; limit?: number; action?: string }) =>
    api.get<{ data: AuditLog[]; pagination: unknown }>(
      `/api/engagements/${engagementId}/audit`,
      { params }
    ).then(r => r.data),

  summary: (engagementId: string) =>
    api.get<{
      totalEvents: number
      agentInvocations: number
      gateEvents: number
      revisions: number
      byAction: Record<string, number>
      recentActivity: AuditLog[]
      contributors: unknown[]
    }>(`/api/engagements/${engagementId}/audit/summary`).then(r => r.data),
}
