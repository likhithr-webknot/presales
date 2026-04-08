import { EngagementStatus, EngagementStage, JobStatus } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { writeAuditLog } from '../../services/audit/logger'

export class InvalidTransitionError extends Error {
  constructor(from: EngagementStatus, to: EngagementStatus) {
    super(`Invalid status transition: ${from} → ${to}`)
    this.name = 'InvalidTransitionError'
  }
}

// Valid forward transitions
const VALID_TRANSITIONS: Partial<Record<EngagementStatus, EngagementStatus[]>> = {
  [EngagementStatus.INITIATED]:           [EngagementStatus.RESEARCH_COMPLETE, EngagementStatus.BLOCKED],
  [EngagementStatus.RESEARCH_COMPLETE]:   [EngagementStatus.PROPOSAL_IN_PROGRESS, EngagementStatus.BLOCKED],
  [EngagementStatus.PROPOSAL_IN_PROGRESS]:[EngagementStatus.UNDER_REVIEW, EngagementStatus.BLOCKED],
  [EngagementStatus.UNDER_REVIEW]:        [EngagementStatus.APPROVED, EngagementStatus.PROPOSAL_IN_PROGRESS, EngagementStatus.BLOCKED],
  [EngagementStatus.APPROVED]:            [EngagementStatus.DELIVERED, EngagementStatus.BLOCKED],
  [EngagementStatus.BLOCKED]:             [EngagementStatus.INITIATED, EngagementStatus.RESEARCH_COMPLETE,
                                           EngagementStatus.PROPOSAL_IN_PROGRESS, EngagementStatus.UNDER_REVIEW,
                                           EngagementStatus.APPROVED],
}

export async function transitionStatus(
  engagementId: string,
  toStatus: EngagementStatus,
  userId?: string,
  detail?: Record<string, unknown>
): Promise<void> {
  const engagement = await prisma.engagement.findUniqueOrThrow({ where: { id: engagementId } })
  const fromStatus = engagement.status

  if (fromStatus === toStatus) return // no-op

  const allowed = VALID_TRANSITIONS[fromStatus] ?? []
  if (!allowed.includes(toStatus)) {
    await writeAuditLog({
      engagementId,
      userId,
      action: 'STAGE_ADVANCED',
      detail: { from: fromStatus, to: toStatus, rejected: true, reason: 'InvalidTransition' },
    })
    throw new InvalidTransitionError(fromStatus, toStatus)
  }

  await prisma.engagement.update({
    where: { id: engagementId },
    data: { status: toStatus },
  })

  await writeAuditLog({
    engagementId,
    userId,
    action: 'STAGE_ADVANCED',
    detail: { from: fromStatus, to: toStatus, ...detail },
  })
}

export async function advanceStage(
  engagementId: string,
  toStage: EngagementStage,
  userId?: string
): Promise<void> {
  // Verify no pending jobs
  const pendingJobs = await prisma.agentJob.count({
    where: { engagementId, status: { in: [JobStatus.QUEUED, JobStatus.RUNNING] } },
  })
  if (pendingJobs > 0) {
    throw new Error(`Cannot advance stage: ${pendingJobs} job(s) still pending`)
  }

  await prisma.engagement.update({
    where: { id: engagementId },
    data: { stage: toStage },
  })

  await writeAuditLog({
    engagementId,
    userId,
    action: 'STAGE_ADVANCED',
    detail: { toStage },
  })
}
