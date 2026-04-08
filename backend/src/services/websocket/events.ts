import { getIO } from './server'

function emit(engagementId: string, event: string, data: unknown): void {
  getIO().to(`engagement:${engagementId}`).emit(event, data)
}

export const wsEvents = {
  jobStarted: (engagementId: string, d: { agentName: string; jobId: string; jobDbId: string }) =>
    emit(engagementId, 'job_started', { ...d, timestamp: new Date().toISOString() }),

  jobProgress: (engagementId: string, d: { agentName: string; jobId: string; message: string; percentComplete?: number }) =>
    emit(engagementId, 'job_progress', d),

  jobCompleted: (engagementId: string, d: { agentName: string; jobId: string; outputSummary: string }) =>
    emit(engagementId, 'job_completed', { ...d, timestamp: new Date().toISOString() }),

  jobFailed: (
    engagementId: string,
    d: {
      agentName: string
      jobId: string
      errorMessage: string
      options: { id: string; label: string; description: string }[]
    }
  ) => emit(engagementId, 'job_failed', d),

  gateReady: (
    engagementId: string,
    d: { gateNumber: string; complianceMatrix: unknown; reviewerEmails: string[] }
  ) => emit(engagementId, 'gate_ready', { ...d, timestamp: new Date().toISOString() }),

  gateApproved: (
    engagementId: string,
    d: { gateNumber: string; reviewerName: string; feedback?: string; allApproved: boolean }
  ) => emit(engagementId, 'gate_approved', { ...d, timestamp: new Date().toISOString() }),

  gateRejected: (
    engagementId: string,
    d: { gateNumber: string; reviewerName: string; feedback: string }
  ) => emit(engagementId, 'gate_rejected', { ...d, timestamp: new Date().toISOString() }),

  gateReminder: (
    engagementId: string,
    d: { gateNumber: string; pendingReviewers: string[]; hoursWaiting: number }
  ) => emit(engagementId, 'gate_reminder', d),

  artifactReady: (
    engagementId: string,
    d: { collateralType: string; format: string; downloadUrl: string; version: number }
  ) => emit(engagementId, 'artifact_ready', { ...d, timestamp: new Date().toISOString() }),

  cascadeDetected: (
    engagementId: string,
    d: {
      changedFields: string[]
      invalidatedAgents: string[]
      cancelledJobIds: string[]
      staleJobIds: string[]
      staleVersionIds: string[]
      requiresManualRestart: boolean
      message: string
    }
  ) => emit(engagementId, 'cascade_detected', { ...d, timestamp: new Date().toISOString() }),

  sowSectionReady: (
    engagementId: string,
    d: { section: string; content: string; sectionIndex: number; totalSections: number }
  ) => emit(engagementId, 'sow_section_ready', { ...d, requiresConfirmation: true }),
}
