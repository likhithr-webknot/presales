/**
 * Gate Routes — Gate 1, 2, 3 and Defense Gate machinery.
 * POST /:id/gates/:gateNumber/submit       — trigger scoring + send review emails
 * POST /:id/gates/:gateNumber/approve      — reviewer approves/rejects
 * POST /:id/gates/:gateNumber/override     — AM override with justification
 * POST /:id/gates/:gateNumber/assign-reviewer — assign a reviewer to a gate
 */
import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import {
  AuditAction,
  GateNumber,
  GateStatus,
  JobStatus,
  Prisma,
  RoleType,
} from '@prisma/client'
import { prisma } from '../lib/prisma'
import { authMiddleware } from '../middleware/auth.middleware'
import { requireEngagementAccess } from '../middleware/engagement-access'
import { requireRole } from '../middleware/rbac.middleware'
// requireRole helper used below
import { wsEvents } from '../services/websocket/events'
import { writeAuditLog } from '../services/audit/logger'
import { dispatchJob } from '../services/ai-client'

export const gateRouter = Router({ mergeParams: true })

gateRouter.use(authMiddleware)
gateRouter.use(requireEngagementAccess)

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseGateNumber(raw: string): GateNumber | null {
  const valid = Object.values(GateNumber) as string[]
  return valid.includes(raw) ? (raw as GateNumber) : null
}

async function getSystemConfig(key: string, defaultValue: string): Promise<string> {
  const cfg = await prisma.systemConfig.findUnique({ where: { key } })
  return cfg?.value ?? defaultValue
}

// ── POST /:id/gates/:gateNumber/submit ────────────────────────────────────────

gateRouter.post('/:gateNumber/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const engagementId = req.params.id
    const gateNumber = parseGateNumber(req.params.gateNumber)
    if (!gateNumber) {
      res.status(400).json({ error: 'Invalid gate number' })
      return
    }

    const { content, rfpRequirements } = z.object({
      content:         z.record(z.unknown()),
      rfpRequirements: z.string().optional(),
    }).parse(req.body)

    const userId = req.user!.id

    // Get compliance variance threshold from SystemConfig
    const varianceThreshold = parseFloat(
      await getSystemConfig('compliance_variance_threshold', '1.0')
    )

    // Create scoring AgentJob
    const scoringJob = await prisma.agentJob.create({
      data: {
        engagementId,
        agentName: 'COMPLIANCE_SCORER' as any,
        status: JobStatus.QUEUED,
        input: { gateNumber, content, rfpRequirements } as Prisma.InputJsonValue,
      },
    })

    // Dispatch scoring to Python ai-service
    await dispatchJob(scoringJob.id, engagementId, 'scoring', {
      job_id:              scoringJob.id,
      engagement_id:       engagementId,
      gate_number:         gateNumber,
      content,
      rfp_requirements:    rfpRequirements ?? null,
      variance_threshold:  varianceThreshold,
    })

    // Load assigned reviewers for this engagement (all REVIEWER-role participants)
    // MVP: fetches all REVIEWER-role users in the system (intentional for small team).
    // Sprint 8 admin panel should support per-engagement reviewer assignment.
    // take:10 safety cap to prevent accidental mass approval creation.
    const reviewers = await prisma.user.findMany({
      where: { roles: { some: { role: RoleType.REVIEWER } } },
      select: { id: true, email: true, name: true },
      take: 10,
    })

    const minReviewerCount = parseInt(
      await getSystemConfig('min_reviewer_count', '1')
    )

    // Create GateApproval records for each reviewer (PENDING)
    const approvalCreates = reviewers.slice(0, Math.max(minReviewerCount, reviewers.length))
    await Promise.all(
      approvalCreates.map(async (reviewer) => {
        const existing = await prisma.gateApproval.findFirst({
          where: { engagementId, gateNumber, reviewerId: reviewer.id },
        })
        if (existing) {
          return prisma.gateApproval.update({
            where: { id: existing.id },
            data: { status: GateStatus.PENDING, feedback: null, approvedAt: null },
          })
        }
        return prisma.gateApproval.create({
          data: { engagementId, gateNumber, reviewerId: reviewer.id, status: GateStatus.PENDING },
        })
      })
    )

    // WebSocket: gate_ready fires after scoring completes (via pipeline-advance)
    // For now emit immediately with pending status so frontend knows gate was submitted
    wsEvents.gateReady(engagementId, {
      gateNumber,
      complianceMatrix: { status: 'scoring_in_progress', scoringJobId: scoringJob.id },
      reviewerEmails: reviewers.map((r) => r.email),
    })

    await writeAuditLog({
      engagementId,
      userId,
      action: AuditAction.GATE_SENT_FOR_REVIEW,
      detail: { gateNumber, reviewerCount: approvalCreates.length, scoringJobId: scoringJob.id },
    })

    res.status(202).json({
      message:       `Gate ${gateNumber} submitted for review`,
      scoringJobId:  scoringJob.id,
      reviewerCount: approvalCreates.length,
    })
  } catch (err) {
    next(err)
  }
})

// ── POST /:id/gates/:gateNumber/approve ───────────────────────────────────────

gateRouter.post('/:gateNumber/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const engagementId = req.params.id
    const gateNumber = parseGateNumber(req.params.gateNumber)
    if (!gateNumber) { res.status(400).json({ error: 'Invalid gate number' }); return }

    const { status, feedback } = z.object({
      status:   z.enum(['APPROVED', 'APPROVED_WITH_FEEDBACK', 'REJECTED']),
      feedback: z.string().optional(),
    }).parse(req.body)

    const userId = req.user!.id

    // Find the approval record for this reviewer
    const approval = await prisma.gateApproval.findFirst({
      where: { engagementId, gateNumber, reviewerId: userId },
    })
    if (!approval) {
      res.status(404).json({ error: 'No pending gate approval found for this reviewer' })
      return
    }

    await prisma.gateApproval.update({
      where: { id: approval.id },
      data: {
        status:     status as GateStatus,
        feedback:   feedback ?? null,
        approvedAt: ['APPROVED', 'APPROVED_WITH_FEEDBACK'].includes(status) ? new Date() : null,
      },
    })

    // Check if minimum approvals reached
    const minReviewerCount = parseInt(await getSystemConfig('min_reviewer_count', '1'))
    const approvedCount = await prisma.gateApproval.count({
      where: {
        engagementId,
        gateNumber,
        status: { in: [GateStatus.APPROVED, GateStatus.APPROVED_WITH_FEEDBACK] },
      },
    })
    const allApproved = approvedCount >= minReviewerCount

    const reviewer = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })

    if (['APPROVED', 'APPROVED_WITH_FEEDBACK'].includes(status)) {
      wsEvents.gateApproved(engagementId, {
        gateNumber,
        reviewerName: reviewer?.name ?? userId,
        feedback:     feedback,
        allApproved,
      })
    } else {
      wsEvents.gateRejected(engagementId, {
        gateNumber,
        reviewerName: reviewer?.name ?? userId,
        feedback:     feedback ?? 'No feedback provided',
      })
    }

    await writeAuditLog({
      engagementId,
      userId,
      action: AuditAction.GATE_APPROVED,
      detail: { gateNumber, status, allApproved, feedback },
    })

    res.json({ message: `Gate ${gateNumber} ${status.toLowerCase()}`, allApproved })
  } catch (err) {
    next(err)
  }
})

// ── POST /:id/gates/:gateNumber/override ──────────────────────────────────────

gateRouter.post(
  '/:gateNumber/override',
  requireRole(RoleType.AM),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const engagementId = req.params.id
      const gateNumber = parseGateNumber(req.params.gateNumber)
      if (!gateNumber) { res.status(400).json({ error: 'Invalid gate number' }); return }

      const { justification, skipReapproval } = z.object({
        justification:  z.string().min(10, 'Justification must be at least 10 characters'),
        skipReapproval: z.boolean().default(false),
      }).parse(req.body)

      const userId = req.user!.id

      // Mark all pending approvals as APPROVED (override)
      await prisma.gateApproval.updateMany({
        where: { engagementId, gateNumber, status: GateStatus.PENDING },
        data: { status: GateStatus.APPROVED, approvedAt: new Date(), feedback: `OVERRIDE: ${justification}` },
      })

      await writeAuditLog({
        engagementId,
        userId,
        action: AuditAction.GATE_APPROVED,
        detail: { gateNumber, override: true, justification, skipReapproval },
      })

      wsEvents.gateApproved(engagementId, {
        gateNumber,
        reviewerName: 'AM (override)',
        feedback:     justification,
        allApproved:  true,
      })

      res.json({
        message:        `Gate ${gateNumber} overridden by AM`,
        justification,
        skipReapproval,
      })
    } catch (err) {
      next(err)
    }
  }
)

// ── POST /:id/gates/:gateNumber/assign-reviewer ───────────────────────────────

gateRouter.post('/:gateNumber/assign-reviewer', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const engagementId = req.params.id
    const gateNumber = parseGateNumber(req.params.gateNumber)
    if (!gateNumber) { res.status(400).json({ error: 'Invalid gate number' }); return }

    const { reviewerId, isAlternate } = z.object({
      reviewerId:  z.string().min(1),
      isAlternate: z.boolean().default(false),
    }).parse(req.body)

    const userId = req.user!.id

    const reviewer = await prisma.user.findUnique({
      where: { id: reviewerId },
      select: { id: true, email: true, name: true },
    })
    if (!reviewer) {
      res.status(404).json({ error: 'Reviewer not found' })
      return
    }

    const existing = await prisma.gateApproval.findFirst({
      where: { engagementId, gateNumber, reviewerId },
    })
    if (!existing) {
      await prisma.gateApproval.create({
        data: { engagementId, gateNumber, reviewerId, status: GateStatus.PENDING },
      })
    }

    await writeAuditLog({
      engagementId,
      userId,
      action: AuditAction.GATE_SENT_FOR_REVIEW,
      detail: { gateNumber, reviewerId, reviewerEmail: reviewer.email, isAlternate },
    })

    res.status(201).json({
      message:     `Reviewer assigned to ${gateNumber}`,
      reviewerId,
      reviewerName: reviewer.name,
      isAlternate,
    })
  } catch (err) {
    next(err)
  }
})
