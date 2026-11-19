import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { CollateralType, LessonStatus, RoleType } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { authMiddleware, AuthUser } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import { lintLesson, proposeLessons } from '../services/ai-client'

/**
 * Admin review of what the AI proposes to learn. Nothing reaches a prompt until a lesson is APPROVED.
 */
export const learningRouter = Router()
learningRouter.use(authMiddleware, requireRole(RoleType.ADMIN))

async function clientNames(): Promise<string[]> {
  const rows = await prisma.engagement.findMany({ distinct: ['clientName'], select: { clientName: true } })
  return rows.map((r) => r.clientName)
}

// GET /api/learning/lessons?status=CANDIDATE
learningRouter.get('/lessons', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = z.nativeEnum(LessonStatus).optional().parse(req.query.status)
    res.json(await prisma.lesson.findMany({ where: status ? { status } : {}, orderBy: { createdAt: 'desc' }, take: 200 }))
  } catch (err) { next(err) }
})

// POST /api/learning/analyze — turn recent mistakes into candidate lessons
learningRouter.post('/analyze', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const events = await prisma.feedbackEvent.findMany({ where: { processed: false }, orderBy: { createdAt: 'desc' }, take: 300 })
    const existing = await prisma.lesson.findMany({ where: { status: { in: ['APPROVED', 'CANDIDATE'] } }, select: { text: true } })

    const result = await proposeLessons(
      events.map((e) => ({ id: e.id, type: e.type, collateral_type: e.collateralType, payload: e.payload })),
      existing.map((l) => l.text),
      await clientNames()
    )

    const byId = new Map(events.map((e) => [e.id, e]))
    const used = new Set<string>()
    for (const c of result.candidates) {
      const types = [...new Set(c.source_event_ids.map((id) => byId.get(id)?.collateralType).filter((t): t is CollateralType => !!t))]
      await prisma.lesson.create({
        data: { text: c.text, category: c.category, collateralTypes: types, sourceEventIds: c.source_event_ids, status: 'CANDIDATE' },
      })
      c.source_event_ids.forEach((id) => used.add(id))
    }
    // Events that produced no lesson stay unprocessed so a pattern can still emerge in a later batch.
    if (used.size) await prisma.feedbackEvent.updateMany({ where: { id: { in: [...used] } }, data: { processed: true } })

    res.json({ eventsReviewed: events.length, candidatesCreated: result.candidates.length, dropped: result.dropped })
  } catch (err) { next(err) }
})

const createSchema = z.object({
  text: z.string().min(3).max(240),
  category: z.string(),
  collateralTypes: z.array(z.nativeEnum(CollateralType)).default([]),
})

// POST /api/learning/lessons — an admin writes a house rule directly
learningRouter.post('/lessons', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as AuthUser
    const body = createSchema.parse(req.body)
    const lint = await lintLesson(body.text, body.category, await clientNames())
    if (!lint.ok) { res.status(422).json({ error: 'Unprocessable Entity', message: 'Lesson rejected', reasons: lint.reasons }); return }
    const lesson = await prisma.lesson.create({
      data: { ...body, status: 'APPROVED', createdById: user.id, reviewedById: user.id, reviewedAt: new Date() },
    })
    res.status(201).json(lesson)
  } catch (err) { next(err) }
})

const decisionSchema = z.object({ status: z.enum(['APPROVED', 'REJECTED']) })

// PATCH /api/learning/lessons/:id — approve or reject (rejecting also retires an approved lesson)
learningRouter.patch('/lessons/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as AuthUser
    const { status } = decisionSchema.parse(req.body)
    const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: req.params.id } })
    if (status === 'APPROVED') {
      const lint = await lintLesson(lesson.text, lesson.category, await clientNames())
      if (!lint.ok) { res.status(422).json({ error: 'Unprocessable Entity', message: 'Lesson fails the safety lint', reasons: lint.reasons }); return }
    }
    res.json(await prisma.lesson.update({ where: { id: lesson.id }, data: { status, reviewedById: user.id, reviewedAt: new Date() } }))
  } catch (err) { next(err) }
})
