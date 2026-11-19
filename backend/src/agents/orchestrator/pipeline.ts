import { randomUUID } from 'crypto'
import { AgentName, AuditAction, CollateralType, EngagementStage, EngagementStatus, JobStatus, Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { queues, QueueName } from '../../jobs/queues'
import { wsEvents } from '../../services/websocket/events'
import { writeAuditLog } from '../../services/audit/logger'
import { getPipeline, planNextStep, queueForAgent, RESEARCH_DEPTH_BY_STAGE } from './routing'
import { transitionStatus } from './state-machine'
import { recordFeedback } from '../../services/feedback/capture'

export interface RunContext {
  clientName?: string
  domain?: string
  opportunityContext?: string
}

/** Create AgentJob rows (atomically) and enqueue them. Returns the DB job ids. */
export async function dispatchStep(
  engagementId: string,
  collateralType: CollateralType,
  stage: EngagementStage,
  userId: string | undefined,
  ctx: RunContext,
  step: number,
  runId: string
): Promise<string[]> {
  const pipeline = getPipeline(collateralType)
  const agents = pipeline[step]?.agents ?? []

  const rows = await prisma.$transaction(
    agents.map((agentName) =>
      prisma.agentJob.create({
        data: {
          engagementId,
          agentName,
          status: JobStatus.QUEUED,
          input: {
            engagementId,
            clientName: ctx.clientName,
            domain: ctx.domain,
            opportunityContext: ctx.opportunityContext,
            ...(agentName === AgentName.SECONDARY_RESEARCH ? { depth: RESEARCH_DEPTH_BY_STAGE[stage] } : {}),
            _runId: runId,
            _step: step,
          } as Prisma.InputJsonValue,
        },
      })
    )
  )

  for (const row of rows) {
    const queueName = queueForAgent(row.agentName)
    if (!queueName) continue
    const bull = await queues[queueName as QueueName].add(row.agentName, { jobId: row.id })
    await prisma.agentJob.update({ where: { id: row.id }, data: { bullmqJobId: bull.id ?? null } })
    wsEvents.jobStarted(engagementId, { agentName: row.agentName, jobId: bull.id ?? row.id, jobDbId: row.id })
    await writeAuditLog({ engagementId, userId, action: AuditAction.AGENT_INVOKED, detail: { agentName: row.agentName, jobDbId: row.id, step } })
  }
  return rows.map((r) => r.id)
}

export function newRunId(): string {
  return randomUUID()
}

interface JobUpdate {
  status: JobStatus
  output?: Record<string, unknown> | null
  error?: string | null
}

const TERMINAL: JobStatus[] = [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]

/**
 * Applies a status change reported by a worker (idempotent), then advances the pipeline.
 * Late or duplicate callbacks for finished jobs are ignored.
 */
export async function applyJobUpdate(jobId: string, update: JobUpdate): Promise<void> {
  const job = await prisma.agentJob.findUnique({ where: { id: jobId } })
  if (!job) throw new Error(`Unknown job ${jobId}`)
  if (TERMINAL.includes(job.status)) return

  await prisma.agentJob.update({
    where: { id: jobId },
    data: {
      status: update.status,
      ...(update.status === JobStatus.RUNNING ? { startedAt: job.startedAt ?? new Date() } : {}),
      ...(TERMINAL.includes(update.status) ? { completedAt: new Date() } : {}),
      ...(update.output !== undefined ? { output: (update.output ?? Prisma.JsonNull) as Prisma.InputJsonValue } : {}),
      ...(update.error !== undefined ? { error: update.error } : {}),
    },
  })

  if (update.status === JobStatus.COMPLETED) {
    wsEvents.jobCompleted(job.engagementId, { agentName: job.agentName, jobId: job.bullmqJobId ?? job.id, outputSummary: summarise(update.output) })
    await writeAuditLog({ engagementId: job.engagementId, action: AuditAction.AGENT_COMPLETED, detail: { agentName: job.agentName, jobDbId: job.id } })
  } else if (update.status === JobStatus.FAILED) {
    wsEvents.jobFailed(job.engagementId, {
      agentName: job.agentName, jobId: job.bullmqJobId ?? job.id, errorMessage: update.error ?? 'Agent failed',
      options: [{ id: 'retry', label: 'Retry', description: 'Run this step again with the same input' }],
    })
    await writeAuditLog({ engagementId: job.engagementId, action: AuditAction.AGENT_FAILED, detail: { agentName: job.agentName, jobDbId: job.id, error: update.error } })
  }

  if (TERMINAL.includes(update.status)) await advance(job.engagementId, (job.input as { _runId?: string })._runId)
}

function summarise(output: Record<string, unknown> | null | undefined): string {
  if (!output) return 'Completed'
  if (output.status === 'needs_input') return `Needs input: ${String(output.message ?? '')}`
  const items = Array.isArray(output.open_items) ? output.open_items.length : 0
  return items ? `Draft ready · ${items} open item(s)` : 'Completed'
}

/** Decide what follows a settled job. Serialised per run with an advisory lock so duplicate callbacks cannot double-dispatch. */
async function advance(engagementId: string, runId: string | undefined): Promise<void> {
  if (!runId) return // legacy/manual jobs are not part of a pipeline run

  const engagement = await prisma.engagement.findUniqueOrThrow({ where: { id: engagementId } })
  const pipeline = getPipeline(engagement.collateralType)

  const decision = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${runId}))`
    const jobs = await tx.agentJob.findMany({ where: { engagementId, input: { path: ['_runId'], equals: runId } } })
    const d = planNextStep(
      pipeline.length,
      jobs.map((j) => ({ step: (j.input as { _step?: number })._step ?? 0, status: j.status, error: j.error }))
    )
    if (d.action === 'next' && jobs.some((j) => ((j.input as { _step?: number })._step ?? 0) === d.step)) return { action: 'wait' as const }
    return d
  })

  if (decision.action === 'failed') {
    await block(engagementId, decision.error)
  } else if (decision.action === 'next') {
    await markProgress(engagementId, decision.step)
    await dispatchStep(
      engagementId, engagement.collateralType, engagement.stage, undefined,
      { clientName: engagement.clientName, domain: engagement.domain, opportunityContext: engagement.opportunityContext ?? undefined },
      decision.step, runId
    )
  } else if (decision.action === 'done') {
    await finalise(engagementId, runId)
  }
}

async function block(engagementId: string, reason: string): Promise<void> {
  await prisma.engagement.update({ where: { id: engagementId }, data: { currentBlocker: reason.slice(0, 500) } })
  await transitionStatus(engagementId, EngagementStatus.BLOCKED, undefined, { reason }).catch(() => undefined)
}

async function markProgress(engagementId: string, nextStep: number): Promise<void> {
  if (nextStep >= 1) await transitionStatus(engagementId, EngagementStatus.RESEARCH_COMPLETE).catch(() => undefined)
}

/** Last step finished: store its document as a new engagement version, or block if it needs input. */
async function finalise(engagementId: string, runId: string): Promise<void> {
  const jobs = await prisma.agentJob.findMany({
    where: { engagementId, status: JobStatus.COMPLETED, input: { path: ['_runId'], equals: runId } },
    orderBy: { createdAt: 'desc' },
  })
  const last = jobs.find((j) => (j.output as { document?: unknown } | null)?.document || (j.output as { status?: string } | null)?.status === 'needs_input')
  const output = (last?.output ?? null) as Record<string, unknown> | null

  if (!output || output.status === 'needs_input' || !output.document) {
    await block(engagementId, String(output?.message ?? 'The final step produced no document. More source material is needed.'))
    return
  }

  const engagement = await prisma.engagement.findUniqueOrThrow({ where: { id: engagementId } })
  const artifacts = {
    kind: output.kind,
    document: output.document,
    openItems: output.open_items ?? [],
    rejectedClaims: output.rejected_claims ?? 0,
    failedUrls: output.failed_urls ?? [],
    collateralType: engagement.collateralType,
    runId,
  }
  const version = await createVersion(engagementId, artifacts, { changeReason: 'AI draft' })

  // Everything the verifier stopped is a mistake worth learning from.
  const rejected = Array.isArray(output.rejected_details) ? output.rejected_details : []
  if (rejected.length > 0) {
    await recordFeedback({ engagementId, type: 'VERIFIER_REJECTION', collateralType: engagement.collateralType, payload: { rejected } })
  }

  await prisma.engagement.update({ where: { id: engagementId }, data: { currentBlocker: null } })
  await transitionStatus(engagementId, EngagementStatus.PROPOSAL_IN_PROGRESS).catch(() => undefined)
  await transitionStatus(engagementId, EngagementStatus.UNDER_REVIEW).catch(() => undefined)
  wsEvents.artifactReady(engagementId, {
    collateralType: engagement.collateralType, format: String(output.kind), downloadUrl: `/api/engagements/${engagementId}/artifacts/latest`, version,
  })
}

/** Append a new immutable version and mark it latest. Serialised per engagement. */
export async function createVersion(
  engagementId: string,
  artifacts: Record<string, unknown>,
  meta: { changeReason: string; userId?: string; baseVersion?: number }
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${engagementId}))`
    const latest = await tx.engagementVersion.findFirst({ where: { engagementId }, orderBy: { version: 'desc' } })
    if (meta.baseVersion !== undefined && (latest?.version ?? 0) !== meta.baseVersion) throw new VersionConflict(latest?.version ?? 0)
    const version = (latest?.version ?? 0) + 1
    await tx.engagementVersion.updateMany({ where: { engagementId, isLatest: true }, data: { isLatest: false } })
    await tx.engagementVersion.create({
      data: {
        engagementId, version, artifacts: artifacts as Prisma.InputJsonValue, isLatest: true,
        changeReason: meta.changeReason, triggeredByUserId: meta.userId ?? null,
      },
    })
    await writeAuditLog({ engagementId, userId: meta.userId, action: AuditAction.VERSION_CREATED, detail: { version, changeReason: meta.changeReason } })
    return version
  })
}

export class VersionConflict extends Error {
  constructor(public latest: number) {
    super(`Document changed since version ${latest}; reload before saving`)
    this.name = 'VersionConflict'
  }
}
