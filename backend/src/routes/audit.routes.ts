/**
 * Audit Trail Routes
 *
 * GET /api/engagements/:id/audit          — paginated audit log for an engagement
 * GET /api/engagements/:id/audit/summary  — activity summary (counts per action type)
 * GET /api/audit/global                   — admin: cross-engagement audit log
 */
import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { AuditAction, RoleType } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { authMiddleware } from '../middleware/auth.middleware'
import { requireEngagementAccess } from '../middleware/engagement-access'
import { requireRole } from '../middleware/rbac.middleware'

export const auditRouter = Router({ mergeParams: true })
export const globalAuditRouter = Router()

auditRouter.use(authMiddleware)
auditRouter.use(requireEngagementAccess)
globalAuditRouter.use(authMiddleware)

// ── GET /api/engagements/:id/audit ────────────────────────────────────────────

const auditQuerySchema = z.object({
  page:        z.coerce.number().int().min(1).default(1),
  limit:       z.coerce.number().int().min(1).max(100).default(50),
  action:      z.nativeEnum(AuditAction).optional(),
  userId:      z.string().uuid().optional(),
  fromDate:    z.string().datetime().optional(),
  toDate:      z.string().datetime().optional(),
})

auditRouter.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = auditQuerySchema.parse(req.query)
    const engagementId = req.params.id
    const skip = (query.page - 1) * query.limit

    const where = {
      engagementId,
      ...(query.action   ? { action: query.action }        : {}),
      ...(query.userId   ? { userId: query.userId }        : {}),
      ...(query.fromDate || query.toDate ? {
        createdAt: {
          ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
          ...(query.toDate   ? { lte: new Date(query.toDate)   } : {}),
        },
      } : {}),
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
      prisma.auditLog.count({ where }),
    ])

    res.json({
      data: logs,
      pagination: {
        page:       query.page,
        limit:      query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
        hasNext:    query.page * query.limit < total,
        hasPrev:    query.page > 1,
      },
    })
  } catch (err) { next(err) }
})

// ── GET /api/engagements/:id/audit/summary ────────────────────────────────────

auditRouter.get('/summary', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const engagementId = req.params.id

    const [actionCounts, recentActivity, userActivity] = await Promise.all([
      // Count per action type
      prisma.auditLog.groupBy({
        by: ['action'],
        where: { engagementId },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      // Last 5 events
      prisma.auditLog.findMany({
        where: { engagementId },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // Unique users who acted on this engagement
      prisma.auditLog.findMany({
        where: { engagementId, userId: { not: null } },
        select: { userId: true, user: { select: { name: true, email: true, avatarUrl: true } } },
        distinct: ['userId'],
      }),
    ])

    const agentActions = new Set<string>([AuditAction.AGENT_INVOKED, AuditAction.AGENT_COMPLETED, AuditAction.AGENT_FAILED])
    const gateActions  = new Set<string>([AuditAction.GATE_SENT_FOR_REVIEW, AuditAction.GATE_APPROVED, AuditAction.GATE_REJECTED, AuditAction.GATE_OVERRIDDEN])

    const agentInvocations = actionCounts
      .filter((r) => agentActions.has(r.action))
      .reduce((sum, r) => sum + r._count.id, 0)

    const gateEvents = actionCounts
      .filter((r) => gateActions.has(r.action))
      .reduce((sum, r) => sum + r._count.id, 0)

    res.json({
      totalEvents:       actionCounts.reduce((s, r) => s + r._count.id, 0),
      agentInvocations,
      gateEvents,
      revisions:         actionCounts.find((r) => (r.action as string) === AuditAction.REVISION_REQUESTED)?._count.id ?? 0,
      byAction:          Object.fromEntries(actionCounts.map((r) => [r.action as string, r._count.id])),
      recentActivity,
      contributors:      userActivity.map((r) => r.user).filter(Boolean),
    })
  } catch (err) { next(err) }
})

// ── GET /api/audit/global (ADMIN only) ────────────────────────────────────────

const globalQuerySchema = z.object({
  page:         z.coerce.number().int().min(1).default(1),
  limit:        z.coerce.number().int().min(1).max(100).default(50),
  engagementId: z.string().uuid().optional(),
  action:       z.nativeEnum(AuditAction).optional(),
  userId:       z.string().uuid().optional(),
  fromDate:     z.string().datetime().optional(),
  toDate:       z.string().datetime().optional(),
})

globalAuditRouter.get(
  '/global',
  requireRole(RoleType.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = globalQuerySchema.parse(req.query)
      const skip = (query.page - 1) * query.limit

      const where = {
        ...(query.engagementId ? { engagementId: query.engagementId }  : {}),
        ...(query.action       ? { action: query.action }              : {}),
        ...(query.userId       ? { userId: query.userId }              : {}),
        ...(query.fromDate || query.toDate ? {
          createdAt: {
            ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
            ...(query.toDate   ? { lte: new Date(query.toDate)   } : {}),
          },
        } : {}),
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          include: {
            user:       { select: { id: true, name: true, email: true } },
            engagement: { select: { id: true, clientName: true, domain: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: query.limit,
        }),
        prisma.auditLog.count({ where }),
      ])

      res.json({
        data: logs,
        pagination: {
          page:       query.page,
          limit:      query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
          hasNext:    query.page * query.limit < total,
          hasPrev:    query.page > 1,
        },
      })
    } catch (err) { next(err) }
  }
)
