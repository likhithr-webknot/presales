import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { AuditAction } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { authMiddleware, AuthUser } from '../middleware/auth.middleware'
import { requireEngagementAccess } from '../middleware/engagement-access'
import { writeAuditLog } from '../services/audit/logger'
import { createVersion, VersionConflict } from '../agents/orchestrator/pipeline'
import { diffTexts, stampHumanEdits } from '../agents/orchestrator/provenance'
import { recordFeedback } from '../services/feedback/capture'
import { renderDocument } from '../services/ai-client'

/** Mounted at /api/engagements/:id/artifacts — what the in-app editors read and write. */
export const artifactRouter = Router({ mergeParams: true })
artifactRouter.use(authMiddleware, requireEngagementAccess)

const KIND_FORMAT = { deck: 'pptx', doc: 'docx', workbook: 'xlsx' } as const
type Kind = keyof typeof KIND_FORMAT

interface Artifacts {
  kind?: Kind
  document?: unknown
  [k: string]: unknown
}

async function latest(engagementId: string) {
  return prisma.engagementVersion.findFirst({ where: { engagementId, isLatest: true } })
}

// GET /latest
artifactRouter.get('/latest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const v = await latest(req.params.id)
    if (!v) { res.status(404).json({ error: 'Not Found', message: 'No document has been generated yet' }); return }
    res.json({ version: v.version, createdAt: v.createdAt, changeReason: v.changeReason, ...(v.artifacts as object) })
  } catch (err) { next(err) }
})

const saveSchema = z.object({
  baseVersion: z.number().int().min(1),
  document: z.object({ title: z.string().min(1).max(300) }).passthrough(),
})

// PUT /latest — save an edit from the in-app editor as a new version (optimistic concurrency)
artifactRouter.put('/latest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as AuthUser
    const body = saveSchema.parse(req.body)
    const current = await latest(req.params.id)
    if (!current) { res.status(404).json({ error: 'Not Found', message: 'No document to edit' }); return }

    const prev = current.artifacts as Artifacts
    const stamped = stampHumanEdits(prev.document, body.document)
    try {
      const version = await createVersion(req.params.id, { ...prev, document: stamped }, {
        changeReason: 'Manual edit', userId: user.id, baseVersion: body.baseVersion,
      })
      const change = diffTexts(prev.document, stamped)
      if (change.removed.length || change.added.length) {
        const eng = await prisma.engagement.findUniqueOrThrow({ where: { id: req.params.id }, select: { collateralType: true } })
        await recordFeedback({ engagementId: req.params.id, userId: user.id, type: 'HUMAN_EDIT', collateralType: eng.collateralType, payload: change })
      }
      res.json({ version })
    } catch (err) {
      if (err instanceof VersionConflict) {
        res.status(409).json({ error: 'Conflict', message: err.message, latestVersion: err.latest })
        return
      }
      throw err
    }
  } catch (err) { next(err) }
})

// GET /latest/export/:fmt — download as .pptx / .docx / .xlsx
artifactRouter.get('/latest/export/:fmt', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as AuthUser
    const v = await latest(req.params.id)
    const a = (v?.artifacts ?? {}) as Artifacts
    if (!v || !a.kind || !a.document) { res.status(404).json({ error: 'Not Found', message: 'No document has been generated yet' }); return }

    const fmt = KIND_FORMAT[a.kind]
    if (req.params.fmt !== fmt) {
      res.status(400).json({ error: 'Bad Request', message: `A ${a.kind} exports as .${fmt}` })
      return
    }
    const file = await renderDocument(fmt, a.document)
    await writeAuditLog({ engagementId: req.params.id, userId: user.id, action: AuditAction.ARTIFACT_DOWNLOADED, detail: { version: v.version, format: fmt } })
    res.setHeader('Content-Disposition', `attachment; filename="presales-v${v.version}.${fmt}"`)
    res.type(fmt).send(file)
  } catch (err) { next(err) }
})

const commentSchema = z.object({ comment: z.string().min(3).max(1000), about: z.string().max(300).optional() })

// POST /feedback — "this is wrong / do it this way" from the reviewer
artifactRouter.post('/feedback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as AuthUser
    const body = commentSchema.parse(req.body)
    const eng = await prisma.engagement.findUniqueOrThrow({ where: { id: req.params.id }, select: { collateralType: true } })
    await recordFeedback({ engagementId: req.params.id, userId: user.id, type: 'USER_COMMENT', collateralType: eng.collateralType, payload: body })
    res.status(202).json({ recorded: true })
  } catch (err) { next(err) }
})
