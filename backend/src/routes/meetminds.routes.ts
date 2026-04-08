/**
 * MeetMinds Reference Routes
 * AM provides a meeting reference (meetingId OR manual transcript) for Stage 2.
 * Stores as an EngagementUpload with structured MeetMindsOutput in parsedContent.
 */
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { UploadType, AuditAction, Prisma } from '@prisma/client'
import { getMeetMindsAdapter } from '../adapters/factory'
import { authMiddleware } from '../middleware/auth.middleware'
import { requireEngagementAccess } from '../middleware/engagement-access'
import { writeAuditLog } from '../services/audit/logger'

export const meetmindsRouter = Router({ mergeParams: true })

meetmindsRouter.use(authMiddleware)
meetmindsRouter.use(requireEngagementAccess)

const meetmindsRefSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('meeting_id'),
    meetingId: z.string().min(1),
  }),
  z.object({
    type: z.literal('manual_transcript'),
    transcript: z.string().min(50, 'Transcript must be at least 50 characters'),
  }),
])

/**
 * POST /api/engagements/:id/meetminds-reference
 * AM provides either a MeetMinds meeting ID or a manually pasted transcript.
 * Result stored as EngagementUpload so it's available in Stage 2 context.
 */
meetmindsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = meetmindsRefSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation error', details: parsed.error.errors })
    return
  }

  const engagementId = req.params.id
  const userId = req.user!.id
  const meetminds = getMeetMindsAdapter()

  try {
    let meetmindsOutput: Record<string, unknown>

    if (parsed.data.type === 'meeting_id') {
      // Fetch transcript from MeetMinds adapter (stub returns mock data)
      const transcript = await meetminds.getTranscript(parsed.data.meetingId)
      meetmindsOutput = transcript as unknown as Record<string, unknown>
    } else {
      // Manual transcript — use intake parser to extract structured fields
      // (re-using the AI service's parsing capability with a transcript-specific prompt)
      const rawTranscript = parsed.data.transcript

      // Extract structured MeetMinds-like fields from the raw transcript
      // For now: store raw transcript + basic extraction
      // Sprint 3 will add proper transcript parsing via a dedicated Python worker
      meetmindsOutput = {
        transcript: rawTranscript,
        metadata: {
          source: 'manual',
          addedBy: userId,
          addedAt: new Date().toISOString(),
        },
        requirements: [],
        painPoints: [],
        budgetSignals: [],
        timelineMentions: [],
        decisionMakers: [],
        actionItems: [],
        competitiveMentions: [],
        _note: 'Manually provided transcript. Structured extraction will be added in Sprint 3.',
      }
    }

    // Store as EngagementUpload
    const upload = await prisma.engagementUpload.create({
      data: {
        engagementId,
        uploadedById: userId,
        fileName: parsed.data.type === 'meeting_id'
          ? `meetminds-${parsed.data.meetingId}.json`
          : `manual-transcript-${Date.now()}.json`,
        mimeType: 'application/json',
        storageKey: `meetminds/${engagementId}/${Date.now()}.json`,
        uploadType: UploadType.OTHER,
        parsedContent: meetmindsOutput as Prisma.InputJsonValue,
      },
    })

    await writeAuditLog({
      engagementId,
      userId,
      action: AuditAction.AGENT_INVOKED,
      detail: {
        action: 'MEETMINDS_REFERENCE_ADDED',
        source: parsed.data.type,
        uploadId: upload.id,
      },
    })

    res.status(201).json({
      uploadId: upload.id,
      type: parsed.data.type,
      message: 'MeetMinds reference stored. You can now proceed with Stage 2.',
    })
  } catch (err) {
    console.error('[meetminds] Error storing reference:', err)
    res.status(500).json({ error: 'Failed to store MeetMinds reference' })
  }
})
