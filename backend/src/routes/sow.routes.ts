/**
 * SOW Routes — Section-by-section walkthrough + dual approval.
 *
 * POST /:id/sow/start                        — kick off SOW generation (full mode)
 * POST /:id/sow/sections/:section/confirm    — AM confirms a section, trigger next
 * POST /:id/sow/sections/:section/revise     — AM requests revision with feedback
 * POST /:id/sow/approve                      — AM or DM final approval
 * GET  /:id/sow/status                       — current SOW state
 */
import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { GateNumber, GateStatus, JobStatus, Prisma, RoleType } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { authMiddleware } from '../middleware/auth.middleware'
import { requireEngagementAccess } from '../middleware/engagement-access'
import { requireRole } from '../middleware/rbac.middleware'
import { dispatchJob } from '../services/ai-client'
import { wsEvents } from '../services/websocket/events'
import { writeAuditLog } from '../services/audit/logger'

export const sowRouter = Router({ mergeParams: true })
sowRouter.use(authMiddleware)
sowRouter.use(requireEngagementAccess)

const SOW_SECTIONS = [
  'project_overview', 'in_scope', 'out_of_scope', 'assumptions',
  'dependencies', 'deliverables', 'milestones', 'slas',
  'payment_milestones', 'change_management', 'legal_clauses',
]

// ── GET /:id/sow/status ───────────────────────────────────────────────────────

sowRouter.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const engagementId = req.params.id

    // Find the latest SOW job
    const sowJob = await prisma.agentJob.findFirst({
      where: { engagementId, agentName: 'SOW_MAKER' as any },
      orderBy: { createdAt: 'desc' },
    })

    // Find confirmed sections (stored in engagement metadata or separate tracking)
    const approvals = await prisma.gateApproval.findMany({
      where: { engagementId, gateNumber: { in: [GateNumber.SOW_AM, GateNumber.SOW_DM] } },
      select: { gateNumber: true, status: true, reviewerId: true },
    })

    const amApproval  = approvals.find((a) => a.gateNumber === GateNumber.SOW_AM)
    const dmApproval  = approvals.find((a) => a.gateNumber === GateNumber.SOW_DM)

    res.json({
      sowJobStatus:   sowJob?.status ?? 'NOT_STARTED',
      amApproval:     amApproval?.status ?? 'PENDING',
      dmApproval:     dmApproval?.status ?? 'PENDING',
      finalApproved:  amApproval?.status === GateStatus.APPROVED && dmApproval?.status === GateStatus.APPROVED,
    })
  } catch (err) { next(err) }
})

// ── POST /:id/sow/start ───────────────────────────────────────────────────────

sowRouter.post('/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const engagementId = req.params.id
    const userId = req.user!.id

    const engagement = await prisma.engagement.findUniqueOrThrow({
      where: { id: engagementId },
      include: { agentJobs: { where: { status: JobStatus.COMPLETED }, orderBy: { completedAt: 'desc' } } },
    })

    // Collect approved proposal outputs for context
    const jobOutputs: Record<string, unknown> = {}
    for (const job of engagement.agentJobs) {
      if (job.output) jobOutputs[job.agentName] = job.output
    }

    const approvedProposal = jobOutputs['NARRATIVE_AGENT'] ?? jobOutputs['PACKAGING_AGENT']

    const dbJob = await prisma.agentJob.create({
      data: {
        engagementId,
        agentName: 'SOW_MAKER' as any,
        status: JobStatus.QUEUED,
        input: { mode: 'full' } as Prisma.InputJsonValue,
      },
    })

    await dispatchJob(dbJob.id, engagementId, 'sow', {
      job_id:               dbJob.id,
      engagement_id:        engagementId,
      mode:                 'full',
      client_name:          engagement.clientName,
      domain:               engagement.domain,
      opportunity_context:  engagement.opportunityContext,
      approved_proposal:    approvedProposal,
    })

    wsEvents.jobStarted(engagementId, { agentName: 'SOW_MAKER', jobId: dbJob.id, jobDbId: dbJob.id })

    await writeAuditLog({
      engagementId, userId,
      action: 'AGENT_INVOKED' as any,
      detail: { agent: 'SOW_MAKER', mode: 'full' },
    })

    res.status(202).json({ message: 'SOW generation started', jobId: dbJob.id })
  } catch (err) { next(err) }
})

// ── POST /:id/sow/sections/:section/confirm ───────────────────────────────────

sowRouter.post('/sections/:section/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: engagementId, section } = req.params
    const userId = req.user!.id

    if (!SOW_SECTIONS.includes(section)) {
      res.status(400).json({ error: 'Invalid section name', valid: SOW_SECTIONS })
      return
    }

    await writeAuditLog({
      engagementId, userId,
      action: 'GATE_APPROVED' as any,
      detail: { action: 'SOW_SECTION_CONFIRMED', section },
    })

    const currentIndex = SOW_SECTIONS.indexOf(section)
    const nextSection  = SOW_SECTIONS[currentIndex + 1]

    // If there's a next section, generate it
    if (nextSection) {
      const engagement = await prisma.engagement.findUniqueOrThrow({ where: { id: engagementId } })

      const dbJob = await prisma.agentJob.create({
        data: {
          engagementId,
          agentName: 'SOW_MAKER' as any,
          status: JobStatus.QUEUED,
          input: { mode: 'section', section_key: nextSection } as Prisma.InputJsonValue,
        },
      })

      await dispatchJob(dbJob.id, engagementId, 'sow', {
        job_id:        dbJob.id,
        engagement_id: engagementId,
        mode:          'section',
        section_key:   nextSection,
        client_name:   engagement.clientName,
        domain:        engagement.domain,
      })
    } else {
      // Last section confirmed — trigger dual approval
      await _initiateDualApproval(engagementId, userId)
    }

    res.json({
      message:       `Section '${section}' confirmed`,
      nextSection:   nextSection ?? null,
      allConfirmed:  !nextSection,
    })
  } catch (err) { next(err) }
})

// ── POST /:id/sow/sections/:section/revise ────────────────────────────────────

sowRouter.post('/sections/:section/revise', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: engagementId, section } = req.params
    const userId = req.user!.id

    const { feedback } = z.object({ feedback: z.string().min(1) }).parse(req.body)

    if (!SOW_SECTIONS.includes(section)) {
      res.status(400).json({ error: 'Invalid section name' })
      return
    }

    const engagement = await prisma.engagement.findUniqueOrThrow({ where: { id: engagementId } })

    const dbJob = await prisma.agentJob.create({
      data: {
        engagementId,
        agentName: 'SOW_MAKER' as any,
        status: JobStatus.QUEUED,
        input: { mode: 'section', section_key: section, am_feedback: feedback } as Prisma.InputJsonValue,
      },
    })

    await dispatchJob(dbJob.id, engagementId, 'sow', {
      job_id:        dbJob.id,
      engagement_id: engagementId,
      mode:          'section',
      section_key:   section,
      am_feedback:   feedback,
      client_name:   engagement.clientName,
      domain:        engagement.domain,
    })

    wsEvents.jobStarted(engagementId, { agentName: 'SOW_MAKER', jobId: dbJob.id, jobDbId: dbJob.id })

    await writeAuditLog({
      engagementId, userId,
      action: 'AGENT_INVOKED' as any,
      detail: { action: 'SOW_SECTION_REVISION', section, feedback },
    })

    res.status(202).json({ message: `Revision requested for '${section}'`, jobId: dbJob.id })
  } catch (err) { next(err) }
})

// ── POST /:id/sow/approve ─────────────────────────────────────────────────────

sowRouter.post('/approve',
  requireRole(RoleType.AM, RoleType.DM),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const engagementId = req.params.id
      const userId       = req.user!.id
      const userRoles = req.user!.roles  // RoleType[] from AuthUser

      const { feedback } = z.object({ feedback: z.string().optional() }).parse(req.body)

      // Determine which approval this is based on the user's actual role
      const gateNumber: GateNumber = (userRoles as string[]).includes(RoleType.DM)
        ? GateNumber.SOW_DM
        : GateNumber.SOW_AM

      // Find or create the approval record
      const existing = await prisma.gateApproval.findFirst({
        where: { engagementId, gateNumber, reviewerId: userId },
      })
      if (existing) {
        await prisma.gateApproval.update({
          where: { id: existing.id },
          data: { status: GateStatus.APPROVED, feedback: feedback ?? null, approvedAt: new Date() },
        })
      } else {
        await prisma.gateApproval.create({
          data: { engagementId, gateNumber, reviewerId: userId, status: GateStatus.APPROVED, feedback: feedback ?? null, approvedAt: new Date() },
        })
      }

      // Check if both AM + DM have approved
      const approvals = await prisma.gateApproval.findMany({
        where: { engagementId, gateNumber: { in: [GateNumber.SOW_AM, GateNumber.SOW_DM] }, status: GateStatus.APPROVED },
      })
      const bothApproved = approvals.length >= 2

      await writeAuditLog({
        engagementId, userId,
        action: 'GATE_APPROVED' as any,
        detail: { gate: gateNumber, bothApproved },
      })

      wsEvents.gateApproved(engagementId, {
        gateNumber: gateNumber as string,
        reviewerName: userId,
        feedback,
        allApproved: bothApproved,
      })

      res.json({ message: `SOW ${gateNumber} approved`, bothApproved })
    } catch (err) { next(err) }
  }
)

// ── Internal helpers ──────────────────────────────────────────────────────────

async function _initiateDualApproval(engagementId: string, _triggeredBy: string) {
  // Create pending approval records for AM + DM
  const amUsers = await prisma.user.findMany({
    where: { roles: { some: { role: RoleType.AM } } },
    select: { id: true, email: true },
    take: 1,
  })
  const dmUsers = await prisma.user.findMany({
    where: { roles: { some: { role: RoleType.DM } } },
    select: { id: true, email: true },
    take: 1,
  })

  await Promise.all([
    ...amUsers.map((u) => prisma.gateApproval.create({
      data: { engagementId, gateNumber: GateNumber.SOW_AM, reviewerId: u.id, status: GateStatus.PENDING },
    }).catch(() => {})),
    ...dmUsers.map((u) => prisma.gateApproval.create({
      data: { engagementId, gateNumber: GateNumber.SOW_DM, reviewerId: u.id, status: GateStatus.PENDING },
    }).catch(() => {})),
  ])

  wsEvents.gateReady(engagementId, {
    gateNumber: 'SOW_DUAL_APPROVAL',
    complianceMatrix: null,
    reviewerEmails: [...amUsers.map((u) => u.email), ...dmUsers.map((u) => u.email)],
  })
}
