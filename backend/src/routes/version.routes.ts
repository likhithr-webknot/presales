/**
 * Version Control Routes
 * GET  /:id/versions          — list all versions with metadata
 * GET  /:id/versions/:v       — full artifact JSON at that version
 * GET  /:id/versions/:v/diff  — plain-language diff from previous version
 * POST /:id/versions          — create a new version (called internally + by feedback route)
 */
import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { JobStatus, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { authMiddleware } from '../middleware/auth.middleware'
import { requireEngagementAccess } from '../middleware/engagement-access'
import { dispatchJob } from '../services/ai-client'
import { writeAuditLog } from '../services/audit/logger'

export const versionRouter = Router({ mergeParams: true })
versionRouter.use(authMiddleware)
versionRouter.use(requireEngagementAccess)

// ── GET /:id/versions ─────────────────────────────────────────────────────────

versionRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const versions = await prisma.engagementVersion.findMany({
      where: { engagementId: req.params.id },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        triggeredByUserId: true,
        changeReason: true,
        diffSummary: true,
        isLatest: true,
        createdAt: true,
      },
    })
    res.json({ versions })
  } catch (err) { next(err) }
})

// ── GET /:id/versions/:v ──────────────────────────────────────────────────────

versionRouter.get('/:v', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vNum = parseInt(req.params.v)
    if (isNaN(vNum)) { res.status(400).json({ error: 'Version must be a number' }); return }

    const version = await prisma.engagementVersion.findUnique({
      where: { engagementId_version: { engagementId: req.params.id, version: vNum } },
    })
    if (!version) { res.status(404).json({ error: 'Version not found' }); return }

    res.json({ version })
  } catch (err) { next(err) }
})

// ── GET /:id/versions/:v/diff ─────────────────────────────────────────────────

versionRouter.get('/:v/diff', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const engagementId = req.params.id
    const vNum = parseInt(req.params.v)
    if (isNaN(vNum)) { res.status(400).json({ error: 'Version must be a number' }); return }

    const [current, previous] = await Promise.all([
      prisma.engagementVersion.findUnique({
        where: { engagementId_version: { engagementId, version: vNum } },
      }),
      prisma.engagementVersion.findUnique({
        where: { engagementId_version: { engagementId, version: vNum - 1 } },
      }),
    ])

    if (!current) { res.status(404).json({ error: 'Version not found' }); return }

    res.json({
      version: vNum,
      previousVersion: vNum - 1,
      diffSummary: current.diffSummary ?? 'Diff not yet generated',
      hasComparison: !!previous,
    })
  } catch (err) { next(err) }
})

// ── POST /:id/versions ────────────────────────────────────────────────────────
// Creates a new version + enqueues diffgen job. Called by feedback route.

export async function createNewVersion(
  engagementId: string,
  userId: string,
  changeReason: string,
  artifacts: Record<string, unknown>
): Promise<{ versionId: string; versionNumber: number }> {
  // Mark previous latest as not-latest
  await prisma.engagementVersion.updateMany({
    where: { engagementId, isLatest: true },
    data: { isLatest: false },
  })

  // Get next version number
  const latest = await prisma.engagementVersion.findFirst({
    where: { engagementId },
    orderBy: { version: 'desc' },
  })
  const nextVersion = (latest?.version ?? 0) + 1

  // I-06 fix: wrap in try/catch to handle the @@unique([engagementId, version])
  // constraint violation if two requests race to create the same version number.
  let newVersion
  try {
    newVersion = await prisma.engagementVersion.create({
      data: {
        engagementId,
        version: nextVersion,
        triggeredByUserId: userId,
        changeReason,
        artifacts: artifacts as Prisma.InputJsonValue,
        isLatest: true,
      },
    })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      // Unique constraint violation — retry with incremented version
      const retryLatest = await prisma.engagementVersion.findFirst({
        where: { engagementId },
        orderBy: { version: 'desc' },
      })
      newVersion = await prisma.engagementVersion.create({
        data: {
          engagementId,
          version: (retryLatest?.version ?? 0) + 1,
          triggeredByUserId: userId,
          changeReason,
          artifacts: artifacts as Prisma.InputJsonValue,
          isLatest: true,
        },
      })
    } else {
      throw err
    }
  }

  // Enqueue diff generation if there's a previous version
  if (latest) {
    const diffJob = await prisma.agentJob.create({
      data: {
        engagementId,
        agentName: 'ORCHESTRATOR' as any,
        status: JobStatus.QUEUED,
        input: { type: 'diffgen', versionId: newVersion.id } as Prisma.InputJsonValue,
      },
    })

    await dispatchJob(diffJob.id, engagementId, 'diffgen', {
      job_id:               diffJob.id,
      engagement_id:        engagementId,
      previous_artifacts:   latest.artifacts,
      current_artifacts:    artifacts,
      change_reason:        changeReason,
      version_id:           newVersion.id,
    }).catch((err) => {
      // Non-blocking — diff failure must not fail version creation
      console.warn('[Versions] Diff job dispatch failed:', err)
    })
  }

  await writeAuditLog({
    engagementId,
    userId,
    action: 'STAGE_ADVANCED' as any,
    detail: { action: 'VERSION_CREATED', version: nextVersion, changeReason },
  })

  return { versionId: newVersion.id, versionNumber: nextVersion }
}

versionRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { changeReason, artifacts } = z.object({
      changeReason: z.string().min(1),
      artifacts:    z.record(z.unknown()),
    }).parse(req.body)

    const { versionId, versionNumber } = await createNewVersion(
      req.params.id, req.user!.id, changeReason, artifacts
    )

    res.status(201).json({ versionId, versionNumber })
  } catch (err) { next(err) }
})
