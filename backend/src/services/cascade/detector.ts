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
  cancelledJobIds: string[]   // QUEUED/RUNNING jobs that were cancelled
  staleJobIds: string[]       // COMPLETED jobs whose output is now invalid
  staleVersionIds: string[]   // EngagementVersion records marked isLatest=false
  requiresManualRestart: boolean // true when research-level agents invalidated — AM must restart pipeline
}

// ── Which fields trigger cascade, and what they invalidate ───────────────────

type CascadeField = 'domain' | 'collateralType' | 'opportunityContext' | 'clientName'

/**
 * Maps a changed field to the AgentName stages that are now stale.
 *
 * Dependency rationale:
 * - domain: affects research scope, context positioning, technical architecture, case study matching
 * - collateralType: changes the entire output format/structure — everything is invalidated
 * - opportunityContext: affects research focus, narrative framing, technical scope
 * - clientName: affects narrative voice, case study selection, SOW parties
 *
 * Intentionally excluded from all cascade fields:
 * - ORCHESTRATOR: meta-agent, no produced artifacts
 * - MEETMINDS_ADAPTER: read-only reference data (meeting notes), does not produce downstream artifacts
 * - PROPOSAL_MAKER: not yet implemented (Sprint 8+)
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
      staleJobIds: [],
      staleVersionIds: [],
      requiresManualRestart: false,
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

  // Collect stale completed job IDs (output is now invalid but job record stays for history)
  const staleJobIds = jobsToCancel
    .filter((j) => j.status === JobStatus.COMPLETED)
    .map((j) => j.id)

  // Mark the latest EngagementVersion as non-latest if any packaging agent was invalidated
  let staleVersionIds: string[] = []
  if (invalidatedAgents.includes(AgentName.PACKAGING_AGENT)) {
    const latestVersions = await prisma.engagementVersion.findMany({
      where: { engagementId, isLatest: true },
      select: { id: true },
    })
    staleVersionIds = latestVersions.map((v) => v.id)
  }

  // B-01 fix: wrap all DB mutations in a transaction — partial failure would leave
  // jobs cancelled but versions still marked isLatest, corrupting engagement state.
  // writeAuditLog is intentionally outside — audit failure must never block cascade.
  await prisma.$transaction([
    ...(activeJobIds.length > 0
      ? [prisma.agentJob.updateMany({ where: { id: { in: activeJobIds } }, data: { status: JobStatus.CANCELLED } })]
      : []),
    ...(staleVersionIds.length > 0
      ? [prisma.engagementVersion.updateMany({ where: { id: { in: staleVersionIds } }, data: { isLatest: false } })]
      : []),
  ])

  // I-05 fix: renamed to requiresManualRestart — auto-restart is not wired yet (Sprint 8).
  // Frontend should show a "Restart Pipeline" button when this is true.
  const requiresManualRestart = invalidatedAgents.includes(AgentName.SECONDARY_RESEARCH)

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
      staleJobIds,
      staleVersionIds,
      requiresManualRestart,
    },
  })

  // Fire WebSocket event — frontend shows a banner with action button if requiresManualRestart
  wsEvents.cascadeDetected(engagementId, {
    changedFields,
    invalidatedAgents,
    cancelledJobIds: activeJobIds,
    staleJobIds,
    staleVersionIds,
    requiresManualRestart,
    message: buildCascadeMessage(changedFields, requiresManualRestart),
  })

  return {
    hasCascade: true,
    changedFields,
    invalidatedAgents,
    cancelledJobIds: activeJobIds,
    staleJobIds,
    staleVersionIds,
    requiresManualRestart,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getChangedFields(before: EngagementSnapshot, after: EngagementSnapshot): CascadeField[] {
  const fields: CascadeField[] = ['domain', 'collateralType', 'opportunityContext', 'clientName']
  return fields.filter((f) => before[f] !== after[f])
}

function buildCascadeMessage(fields: string[], requiresManualRestart: boolean): string {
  const label = fields.join(', ')
  if (requiresManualRestart) {
    return `${label} changed — affected agents cancelled. Click "Restart Pipeline" to re-run.`
  }
  return `${label} changed — downstream agents marked stale. Review required.`
}
