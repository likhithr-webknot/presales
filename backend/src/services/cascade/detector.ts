/**
 * Cascade Detector
 *
 * When an engagement's key fields change (domain, collateralType, opportunityContext,
 * clientName), previously-generated artifacts and completed agent jobs may be stale.
 *
 * This service:
 *  1. Detects which fields changed
 *  2. Determines which downstream pipeline stages are invalidated
 *  3. Marks affected AgentJob records as CANCELLED
 *  4. Marks affected EngagementVersion as stale (isLatest = false if artifacts moot)
 *  5. Writes audit log + fires cascade_detected WS event
 *  6. Returns a CascadeResult so the caller can decide whether to auto-restart
 */
import { AgentName, AuditAction, CollateralType, JobStatus } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { wsEvents } from '../websocket/events'
import { writeAuditLog } from '../audit/logger'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EngagementSnapshot {
  clientName: string
  domain: string
  collateralType: CollateralType
  opportunityContext?: string | null
}

export interface CascadeResult {
  hasCascade: boolean
  changedFields: string[]
  invalidatedAgents: AgentName[]
  cancelledJobIds: string[]
  staleVersionIds: string[]
  shouldRestartPipeline: boolean
}

// ── Which fields trigger cascade, and what they invalidate ───────────────────

type CascadeField = 'domain' | 'collateralType' | 'opportunityContext' | 'clientName'

/**
 * Maps a changed field → the AgentName stages that are now stale.
 * Research depends on domain + opportunity.
 * Context depends on domain.
 * Packaging/Narrative/Technical depend on everything.
 * Case study depends on domain.
 * If collateralType changes, the whole pipeline is invalid.
 */
const CASCADE_MAP: Record<CascadeField, AgentName[]> = {
  domain: [
    AgentName.SECONDARY_RESEARCH,
    AgentName.CONTEXT_MANAGER,
    AgentName.NARRATIVE_AGENT,
    AgentName.TECHNICAL_SOLUTION,
    AgentName.PACKAGING_AGENT,
    AgentName.CASE_STUDY_MAKER,
    AgentName.COMPLIANCE_SCORER,
  ],
  collateralType: [
    AgentName.SECONDARY_RESEARCH,
    AgentName.CONTEXT_MANAGER,
    AgentName.NARRATIVE_AGENT,
    AgentName.TECHNICAL_SOLUTION,
    AgentName.PACKAGING_AGENT,
    AgentName.CASE_STUDY_MAKER,
    AgentName.COMPLIANCE_SCORER,
    AgentName.SOW_MAKER,
    AgentName.PRICING_ADAPTER,
  ],
  opportunityContext: [
    AgentName.SECONDARY_RESEARCH,
    AgentName.NARRATIVE_AGENT,
    AgentName.TECHNICAL_SOLUTION,
    AgentName.PACKAGING_AGENT,
    AgentName.COMPLIANCE_SCORER,
  ],
  clientName: [
    AgentName.NARRATIVE_AGENT,
    AgentName.PACKAGING_AGENT,
    AgentName.CASE_STUDY_MAKER,
    AgentName.SOW_MAKER,
  ],
}

// ── Core logic ────────────────────────────────────────────────────────────────

export async function detectAndApplyCascade(
  engagementId: string,
  before: EngagementSnapshot,
  after: EngagementSnapshot,
  triggeredByUserId: string,
): Promise<CascadeResult> {
  const changedFields = getChangedFields(before, after)

  if (changedFields.length === 0) {
    return {
      hasCascade: false,
      changedFields: [],
      invalidatedAgents: [],
      cancelledJobIds: [],
      staleVersionIds: [],
      shouldRestartPipeline: false,
    }
  }

  // Union of all invalidated agents across all changed fields
  const invalidatedSet = new Set<AgentName>()
  for (const field of changedFields) {
    for (const agent of CASCADE_MAP[field as CascadeField] ?? []) {
      invalidatedSet.add(agent)
    }
  }
  const invalidatedAgents = [...invalidatedSet]

  // Cancel all QUEUED or RUNNING jobs for the invalidated agents
  const jobsToCancel = await prisma.agentJob.findMany({
    where: {
      engagementId,
      agentName: { in: invalidatedAgents },
      status: { in: ['QUEUED', 'RUNNING', 'COMPLETED'] as JobStatus[] },
    },
    select: { id: true, agentName: true, status: true },
  })

  // Only actually cancel QUEUED/RUNNING — mark COMPLETED ones as stale via a note in detail
  const activeJobIds = jobsToCancel
    .filter((j) => j.status === JobStatus.QUEUED || j.status === JobStatus.RUNNING)
    .map((j) => j.id)

  if (activeJobIds.length > 0) {
    await prisma.agentJob.updateMany({
      where: { id: { in: activeJobIds } },
      data: { status: JobStatus.CANCELLED },
    })
  }

  // Mark the latest EngagementVersion as non-latest if any packaging agent was invalidated
  let staleVersionIds: string[] = []
  if (invalidatedAgents.includes(AgentName.PACKAGING_AGENT)) {
    const latestVersions = await prisma.engagementVersion.findMany({
      where: { engagementId, isLatest: true },
      select: { id: true },
    })
    staleVersionIds = latestVersions.map((v) => v.id)

    if (staleVersionIds.length > 0) {
      await prisma.engagementVersion.updateMany({
        where: { id: { in: staleVersionIds } },
        data: { isLatest: false },
      })
    }
  }

  // Determine if the pipeline should be auto-restarted
  // Auto-restart only if research-level agents were invalidated (not just packaging)
  const shouldRestartPipeline = invalidatedAgents.includes(AgentName.SECONDARY_RESEARCH)

  // Write audit log
  await writeAuditLog({
    engagementId,
    userId: triggeredByUserId,
    action: AuditAction.CASCADE_DETECTED,
    detail: {
      event: 'cascade_detected',
      changedFields,
      invalidatedAgents,
      cancelledJobIds: activeJobIds,
      staleVersionIds,
      shouldRestartPipeline,
    },
  })

  // Fire WebSocket event — frontend shows a banner: "Engagement updated — pipeline restarting"
  wsEvents.cascadeDetected(engagementId, {
    changedFields,
    invalidatedAgents,
    cancelledJobIds: activeJobIds,
    staleVersionIds,
    shouldRestartPipeline,
    message: buildCascadeMessage(changedFields, shouldRestartPipeline),
  })

  return {
    hasCascade: true,
    changedFields,
    invalidatedAgents,
    cancelledJobIds: activeJobIds,
    staleVersionIds,
    shouldRestartPipeline,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getChangedFields(before: EngagementSnapshot, after: EngagementSnapshot): CascadeField[] {
  const fields: CascadeField[] = ['domain', 'collateralType', 'opportunityContext', 'clientName']
  return fields.filter((f) => before[f] !== after[f])
}

function buildCascadeMessage(fields: string[], restart: boolean): string {
  const label = fields.join(', ')
  if (restart) {
    return `${label} changed — affected agents cancelled and pipeline will restart.`
  }
  return `${label} changed — downstream agents marked stale. Review required.`
}
