/**
 * Artifact Routes
 * GET /:id/artifacts/download  — returns presigned MinIO URL for an artifact
 * Records download in AuditLog.
 */
import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { AuditAction } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { authMiddleware } from '../middleware/auth.middleware'
import { requireEngagementAccess } from '../middleware/engagement-access'
import { presignedUrl } from '../services/storage/service'
import { writeAuditLog } from '../services/audit/logger'

export const artifactRouter = Router({ mergeParams: true })
artifactRouter.use(authMiddleware)
artifactRouter.use(requireEngagementAccess)

artifactRouter.get('/download', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { format } = z.object({
      version: z.coerce.number().optional(),
      format:  z.enum(['pptx', 'docx', 'pdf']).optional().default('pptx'),
    }).parse(req.query)

    const engagementId = req.params.id

    // Find the packaging job output for this engagement + version
    const query: any = {
      engagementId,
      agentName: 'PACKAGING_AGENT',
      status: 'COMPLETED',
    }

    const packagingJob = await prisma.agentJob.findFirst({
      where: query,
      orderBy: { completedAt: 'desc' },
    })

    if (!packagingJob?.output) {
      res.status(404).json({
        error: 'No artifact found',
        message: 'The packaging agent has not completed for this engagement yet',
      })
      return
    }

    const output = packagingJob.output as Record<string, unknown>
    const fileKey = output.file_key as string | undefined

    if (!fileKey) {
      // Return presigned_url directly if already set
      let url = output.presigned_url as string
      if (url) {
        // Fix docker internal hostname for local development
        url = url.replace('http://minio:9000', 'http://localhost:9000')
        await _auditDownload(engagementId, req.user!.id, fileKey ?? 'unknown', format)
        res.json({ downloadUrl: url, format, cached: true })
        return
      }
      res.status(404).json({ error: 'Artifact file key not found in job output' })
      return
    }

    // Generate fresh presigned URL (24h TTL)
    const downloadUrl = await presignedUrl('presales-artifacts', fileKey, 24)

    await _auditDownload(engagementId, req.user!.id, fileKey, format)

    res.json({ downloadUrl, format, fileKey })
  } catch (err) { next(err) }
})

async function _auditDownload(engagementId: string, userId: string, fileKey: string, format: string) {
  await writeAuditLog({
    engagementId,
    userId,
    action: AuditAction.ARTIFACT_DOWNLOADED,
    detail: { fileKey, format, downloadedAt: new Date().toISOString() },
  }).catch(() => {}) // never fail a download because of audit log
}
