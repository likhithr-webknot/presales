/**
 * Engagement Status Routes
 *
 * GET /api/engagements/:id/status  — unified status surface for the frontend
 *
 * Returns everything the frontend needs in one request:
 *   - Current stage + status + blocker
 *   - Active agent jobs (running/queued)
 *   - Gate states (all gates for this engagement)
 *   - Latest version + artifact URLs
 *   - SOW dual-approval state
 *   - Pipeline progress (current step + next expected step)
 *   - Recent audit events (last 10)
 */
import { Router, Request, Response, NextFunction } from 'express'
import { GateNumber, GateStatus, JobStatus } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { authMiddleware } from '../middleware/auth.middleware'
import { requireEngagementAccess } from '../middleware/engagement-access'
import { getPipeline } from '../agents/orchestrator/routing'
import { presignedUrl } from '../services/storage/service'

export const statusRouter = Router({ mergeParams: true })

statusRouter.use(authMiddleware)
statusRouter.use(requireEngagementAccess)

// ── GET /api/engagements/:id/status ──────────────────────────────────────────

statusRouter.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const engagementId = req.params.id

    // Fetch everything in parallel
    const [engagement, agentJobs, gateApprovals, versions, auditLogs] = await Promise.all([
      prisma.engagement.findUnique({
        where: { id: engagementId },
        select: {
          id: true,
          clientName: true,
          domain: true,
          collateralType: true,
          stage: true,
          status: true,
          currentBlocker: true,
          opportunityContext: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.agentJob.findMany({
        where: { engagementId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          agentName: true,
          status: true,
          error: true,
          createdAt: true,
          startedAt: true,
          completedAt: true,
        },
      }),
      prisma.gateApproval.findMany({
        where: { engagementId },
        include: {
          reviewer: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.engagementVersion.findMany({
        where: { engagementId },
        orderBy: { version: 'desc' },
        take: 5,
        select: {
          id: true,
          version: true,
          isLatest: true,
          changeReason: true,
          diffSummary: true,
          artifacts: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.findMany({
        where: { engagementId },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ])

    if (!engagement) {
      res.status(404).json({ error: 'Engagement not found' })
      return
    }

    // ── Agent jobs grouped by status ─────────────────────────────────────────
    const activeJobs    = agentJobs.filter((j) => j.status === JobStatus.QUEUED || j.status === JobStatus.RUNNING)
    const completedJobs = agentJobs.filter((j) => j.status === JobStatus.COMPLETED)
    const failedJobs    = agentJobs.filter((j) => j.status === JobStatus.FAILED)

    // ── Gate states grouped by gate number ───────────────────────────────────
    const gatesByNumber: Record<string, {
      gateNumber: string
      overallStatus: GateStatus | 'NOT_STARTED'
      approvals: typeof gateApprovals
    }> = {}

    for (const gate of gateApprovals) {
      const key = gate.gateNumber
      if (!gatesByNumber[key]) {
        gatesByNumber[key] = { gateNumber: key, overallStatus: gate.status, approvals: [] }
      }
      gatesByNumber[key].approvals.push(gate)
    }

    // Compute overall gate status: APPROVED only if ALL approvals are APPROVED
    for (const key of Object.keys(gatesByNumber)) {
      const gate = gatesByNumber[key]
      const statuses = gate.approvals.map((a) => a.status)
      if (statuses.every((s) => s === GateStatus.APPROVED || s === GateStatus.APPROVED_WITH_FEEDBACK)) {
        gate.overallStatus = GateStatus.APPROVED
      } else if (statuses.some((s) => s === GateStatus.REJECTED)) {
        gate.overallStatus = GateStatus.REJECTED
      } else {
        gate.overallStatus = GateStatus.PENDING
      }
    }

    // ── SOW dual-approval state ───────────────────────────────────────────────
    const sowAmApproval = gateApprovals.find((g) => g.gateNumber === GateNumber.SOW_AM)
    const sowDmApproval = gateApprovals.find((g) => g.gateNumber === GateNumber.SOW_DM)
    const sowFullyApproved =
      sowAmApproval?.status === GateStatus.APPROVED &&
      sowDmApproval?.status === GateStatus.APPROVED

    // ── Pipeline progress ─────────────────────────────────────────────────────
    const pipeline = getPipeline(engagement.collateralType)
    const completedAgentNames = new Set(completedJobs.map((j) => j.agentName))
    const activeAgentNames    = new Set(activeJobs.map((j) => j.agentName))

    let currentStepIndex = -1
    let currentStepAgents: string[] = []
    let nextStepAgents: string[] = []

    for (let i = 0; i < pipeline.length; i++) {
      const step = pipeline[i]
      const stepAgents = step.agents
      const anyActive = stepAgents.some((a) => activeAgentNames.has(a as any))
      const allDone   = stepAgents.every((a) => completedAgentNames.has(a as any))

      if (anyActive) {
        currentStepIndex = i
        currentStepAgents = stepAgents
        nextStepAgents = pipeline[i + 1]?.agents ?? []
        break
      }

      if (!allDone) {
        // Step not started yet — this is the current expected step
        currentStepIndex = i
        currentStepAgents = stepAgents
        nextStepAgents = pipeline[i + 1]?.agents ?? []
        break
      }
    }

    // ── Latest artifact with presigned URL ───────────────────────────────────
    const latestVersion = versions.find((v) => v.isLatest) ?? versions[0] ?? null
    let latestArtifactUrl: string | null = null

    if (latestVersion) {
      const artifacts = latestVersion.artifacts as any
      const storageKey = artifacts?.storage_key ?? artifacts?.storageKey ?? null
      if (storageKey) {
        try {
          latestArtifactUrl = await presignedUrl('presales-artifacts', storageKey, 24)
        } catch {
          // Non-fatal — URL generation failure shouldn't break the status call
          latestArtifactUrl = null
        }
      }
    }

    // ── Overall health ────────────────────────────────────────────────────────
    const hasBlockedGate   = Object.values(gatesByNumber).some((g) => g.overallStatus === GateStatus.REJECTED)
    const hasCriticalError = failedJobs.length > 0 && activeJobs.length === 0

    res.json({
      engagement,

      pipeline: {
        totalSteps:        pipeline.length,
        currentStepIndex,
        currentStepAgents,
        nextStepAgents,
        completedSteps:    pipeline.filter((step) =>
          step.agents.every((a) => completedAgentNames.has(a as any))
        ).length,
      },

      jobs: {
        active:    activeJobs,
        failed:    failedJobs,
        completed: completedJobs.length, // count only — full list can be fetched via /jobs
      },

      gates: Object.values(gatesByNumber),

      sow: {
        amApproval:   sowAmApproval?.status ?? 'NOT_STARTED',
        dmApproval:   sowDmApproval?.status ?? 'NOT_STARTED',
        fullyApproved: sowFullyApproved,
      },

      latestVersion: latestVersion ? {
        ...latestVersion,
        downloadUrl: latestArtifactUrl,
      } : null,

      recentActivity: auditLogs,

      health: {
        hasBlockedGate,
        hasCriticalError,
        hasActiveWork:  activeJobs.length > 0,
        isComplete:     engagement.status === 'DELIVERED' || sowFullyApproved,
      },
    })
  } catch (err) { next(err) }
})
