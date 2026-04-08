import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { UploadType, RoleType } from '@prisma/client'
import { authMiddleware, AuthUser } from '../middleware/auth.middleware'
import { uploadMiddleware } from '../middleware/upload.middleware'
import { prisma } from '../lib/prisma'
import { putObject, deleteObject } from '../services/storage/service'
import { parseDocument } from '../services/storage/document-parser'
import { BUCKETS } from '../config/storage'

export const uploadRouter = Router()
uploadRouter.use(authMiddleware)

// POST /api/uploads
uploadRouter.post('/', uploadMiddleware.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as AuthUser
    const file = req.file
    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'No file provided' })
      return
    }

    const { engagementId, uploadType } = z.object({
      engagementId: z.string().uuid(),
      uploadType:   z.nativeEnum(UploadType).default(UploadType.OTHER),
    }).parse(req.body)

    // Verify engagement exists and user has access
    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, createdById: user.id },
    })
    if (!engagement && !user.roles.includes(RoleType.ADMIN)) {
      res.status(403).json({ error: 'Forbidden', message: 'No access to this engagement' })
      return
    }

    // Store in MinIO
    const storageKey = `${engagementId}/${Date.now()}-${file.originalname}`
    await putObject(BUCKETS.uploads, storageKey, file.buffer, file.mimetype)

    // Parse text content
    const parsedText = await parseDocument(file.buffer, file.mimetype)

    // Create DB record
    const upload = await prisma.engagementUpload.create({
      data: {
        engagementId,
        uploadType,
        fileName:     file.originalname,
        mimeType:     file.mimetype,
        storageKey,
        parsedContent: parsedText ? { text: parsedText } : undefined,
        uploadedById: user.id,
      },
    })

    res.status(201).json(upload)
  } catch (err) { next(err) }
})

// GET /api/uploads/:id
uploadRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const upload = await prisma.engagementUpload.findUniqueOrThrow({ where: { id: req.params.id } })
    res.json(upload)
  } catch (err) { next(err) }
})

// DELETE /api/uploads/:id
uploadRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as AuthUser
    const upload = await prisma.engagementUpload.findUniqueOrThrow({ where: { id: req.params.id } })

    if (upload.uploadedById !== user.id && !user.roles.includes(RoleType.ADMIN)) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    await deleteObject(BUCKETS.uploads, upload.storageKey)
    await prisma.engagementUpload.delete({ where: { id: req.params.id } })
    res.json({ message: 'Upload deleted' })
  } catch (err) { next(err) }
})


