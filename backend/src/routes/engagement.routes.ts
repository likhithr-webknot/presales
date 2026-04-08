import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { AuditAction, CollateralType, EngagementStage, EngagementStatus, Prisma, RoleType } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { authMiddleware, AuthUser } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import { requireEngagementAccess } from '../middleware/engagement-access'
import { writeAuditLog } from '../services/audit/logger'
import { handleMessage } from '../agents/orchestrator/index'
import { advanceStage } from '../agents/orchestrator/state-machine'
import { buildCarryForwardContext } from '../agents/orchestrator/context-builder'
import { routeFeedback } from '../agents/orchestrator/feedback-router'
import { detectAndApplyCascade } from '../services/cascade/detector'

export const engagementRouter = Router()
engagementRouter.use(authMiddleware)

// ─── S1-B-01: Engagement CRUD ─────────────────────────────────────────────────

const createSchema = z.object({
  clientName:        z.string().min(1),
  domain:            z.string().min(1),
  opportunityContext:z.string().optional(),
  collateralType:    z.nativeEnum(CollateralType),
  stage:             z.nativeEnum(EngagementStage).default(EngagementStage.STAGE_1),
  contactDetails:    z.record(z.unknown()).optional(),
})

// POST /api/engagements
engagementRouter.post('/', requireRole(RoleType.AM, RoleType.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as AuthUser
    const body = createSchema.parse(req.body)

    const engagement = await prisma.engagement.create({
      data: {
        clientName:         body.clientName,
        domain:             body.domain,
        opportunityContext: body.opportunityContext,
        collateralType:     body.collateralType,
        stage:              body.stage,
        contactDetails:     body.contactDetails as Prisma.InputJsonValue | undefined,
        createdById:        user.id,
      },
    })

    await writeAuditLog({
      engagementId: engagement.id,
      userId: user.id,
      action: 'ENGAGEMENT_CREATED',
      detail: { clientName: body.clientName, collateralType: body.collateralType },
    })

    res.status(201).json(engagement)
  } catch (err) { next(err) }
})

// GET /api/engagements
engagementRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as AuthUser
    const page  = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20)
    const skip  = (page - 1) * limit

    // ADMIN sees all; AM sees own only
    const where = user.roles.includes(RoleType.ADMIN)
      ? {}
      : { createdById: user.id }

    const [engagements, total] = await Promise.all([
      prisma.engagement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          agentJobs: { where: { status: { in: ['QUEUED', 'RUNNING'] } }, select: { id: true, agentName: true, status: true } },
          versions:  { where: { isLatest: true }, select: { version: true } },
        },
      }),
      prisma.engagement.count({ where }),
    ])

    res.json({ data: engagements, total, page, limit })
  } catch (err) { next(err) }
})

// GET /api/engagements/:id
engagementRouter.get('/:id', requireEngagementAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const engagement = await prisma.engagement.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        agentJobs: { orderBy: { createdAt: 'desc' } },
        versions:  { where: { isLatest: true } },
        uploads:   true,
        gateApprovals: true,
      },
    })
    res.json(engagement)
  } catch (err) { next(err) }
})

// PATCH /api/engagements/:id
engagementRouter.patch('/:id', requireEngagementAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patchSchema = z.object({
      clientName:         z.string().optional(),
      domain:             z.string().optional(),
      opportunityContext: z.string().optional(),
      collateralType:     z.nativeEnum(CollateralType).optional(),
      contactDetails:     z.record(z.unknown()).optional(),
    })
    const body = patchSchema.parse(req.body)
    const userId = (req.user as AuthUser).id

    // Snapshot current state for cascade detection
    const before = await prisma.engagement.findUnique({
      where: { id: req.params.id },
      select: { clientName: true, domain: true, collateralType: true, opportunityContext: true },
    })
    if (!before) { res.status(404).json({ error: 'Engagement not found' }); return }

    const updated = await prisma.engagement.update({
      where: { id: req.params.id },
      data: {
        ...body,
        contactDetails: body.contactDetails as Prisma.InputJsonValue | undefined,
      },
    })

    // I-04 fix: only run cascade detection when cascade-triggering fields were changed
    // (contactDetails-only changes don't invalidate any pipeline agents)
    const cascadeFields = ['clientName', 'domain', 'collateralType', 'opportunityContext']
    const hasCascadeableChange = Object.keys(body).some((k) => cascadeFields.includes(k))

    const cascadeResult = hasCascadeableChange
      ? await detectAndApplyCascade(
          req.params.id,
          { clientName: before.clientName, domain: before.domain, collateralType: before.collateralType, opportunityContext: before.opportunityContext },
          { clientName: updated.clientName, domain: updated.domain, collateralType: updated.collateralType, opportunityContext: updated.opportunityContext },
          userId,
        )
      : { hasCascade: false, changedFields: [], invalidatedAgents: [], cancelledJobIds: [], staleJobIds: [], staleVersionIds: [], requiresManualRestart: false }

    // Audit the update
    await writeAuditLog({
      engagementId: req.params.id,
      userId,
      action: AuditAction.ENGAGEMENT_UPDATED,
      detail: { changedFields: Object.keys(body), cascade: cascadeResult.hasCascade },
    })

    res.json({ engagement: updated, cascade: cascadeResult })
  } catch (err) { next(err) }
})

// DELETE /api/engagements/:id (ADMIN only — soft delete)
engagementRouter.delete('/:id', requireRole(RoleType.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.engagement.update({
      where: { id: req.params.id },
      data: { status: EngagementStatus.CANCELLED },
    })
    res.json({ message: 'Engagement cancelled' })
  } catch (err) { next(err) }
})

// ─── S1-B-06: /message route ─────────────────────────────────────────────────

engagementRouter.post('/:id/message', requireEngagementAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as AuthUser
    const { message } = z.object({ message: z.string().min(1) }).parse(req.body)

    const result = await handleMessage(req.params.id, message, user.id)
    res.json(result)
  } catch (err) { next(err) }
})

// ─── S1-B-09: Advance stage route ────────────────────────────────────────────

engagementRouter.post('/:id/advance-stage', requireEngagementAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as AuthUser
    const { toStage } = z.object({ toStage: z.nativeEnum(EngagementStage) }).parse(req.body)

    await advanceStage(req.params.id, toStage, user.id)
    const context = await buildCarryForwardContext(req.params.id, toStage)

    res.json({ message: 'Stage advanced', toStage, carryForwardContext: context })
  } catch (err) { next(err) }
})

// ─── Engagement status ────────────────────────────────────────────────────────

engagementRouter.get('/:id/status', requireEngagementAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const engagement = await prisma.engagement.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        agentJobs: { where: { status: { in: ['QUEUED', 'RUNNING'] } } },
        gateApprovals: { where: { status: 'PENDING' } },
      },
    })

    res.json({
      stage:          engagement.stage,
      status:         engagement.status,
      currentBlocker: engagement.currentBlocker,
      activeJobs:     engagement.agentJobs,
      pendingGates:   engagement.gateApprovals.length,
      lastActivity:   engagement.updatedAt,
    })
  } catch (err) { next(err) }
})

// ─── Version history ──────────────────────────────────────────────────────────

engagementRouter.get('/:id/versions', requireEngagementAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const versions = await prisma.engagementVersion.findMany({
      where: { engagementId: req.params.id },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, changeReason: true, diffSummary: true, isLatest: true, createdAt: true, triggeredByUserId: true },
    })
    res.json(versions)
  } catch (err) { next(err) }
})

engagementRouter.get('/:id/versions/:version', requireEngagementAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const version = await prisma.engagementVersion.findFirstOrThrow({
      where: { engagementId: req.params.id, version: parseInt(req.params.version) },
    })
    res.json(version)
  } catch (err) { next(err) }
})

// ─── Audit log ────────────────────────────────────────────────────────────────

engagementRouter.get('/:id/audit', requireEngagementAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50)
    const logs  = await prisma.auditLog.findMany({
      where: { engagementId: req.params.id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { user: { select: { name: true, email: true } } },
    })
    res.json(logs)
  } catch (err) { next(err) }
})

// ─── Feedback ─────────────────────────────────────────────────────────────────

engagementRouter.post('/:id/feedback', requireEngagementAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as AuthUser
    const { feedback, targetSection } = z.object({
      feedback:      z.string().min(1),
      targetSection: z.string().optional(),
    }).parse(req.body)

    await writeAuditLog({
      engagementId: req.params.id,
      userId: user.id,
      action: 'REVISION_REQUESTED',
      detail: { feedback, targetSection },
    })

    const result = await routeFeedback(req.params.id, user.id, feedback, targetSection)
    res.json(result)
  } catch (err) { next(err) }
})
