/**
 * Internal routes — called by the Python AI service only.
 * Not exposed to the public internet. Protected by AI_INTERNAL_SECRET header.
 */
import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuditAction, JobStatus, Prisma } from '@prisma/client'
import { wsEvents } from '../services/websocket/events'
import { writeAuditLog } from '../services/audit/logger'
import { env } from '../config/env'
import { tryAdvancePipeline } from '../agents/orchestrator/pipeline-advance'

export const internalRouter = Router()

// ── Internal secret middleware ────────────────────────────────────────────────

function requireInternalSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = req.headers['x-ai-internal-secret']
  if (secret !== env.AI_INTERNAL_SECRET) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid internal secret' })
    return
  }
  next()
}

internalRouter.use(requireInternalSecret)

// ── Job update callback ───────────────────────────────────────────────────────

const jobUpdateSchema = z.object({
  job_id:     z.string().min(1),
  status:     z.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED']),
  output:     z.record(z.unknown()).nullable().optional(),
  error:      z.string().nullable().optional(),
  agent_name: z.string().nullable().optional(),
})

/**
 * POST /api/internal/job-update
 * Python AI service calls this when a job completes or fails.
 * Updates AgentJob in DB and fires WebSocket events to the frontend.
 */
internalRouter.post('/job-update', async (req: Request, res: Response): Promise<void> => {
  const parsed = jobUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation error', details: parsed.error.errors })
    return
  }

  const { job_id, status, output, error, agent_name } = parsed.data

  try {
    // Fetch the job to get engagementId for WS events
    const job = await prisma.agentJob.findUnique({ where: { id: job_id } })
    if (!job) {
      res.status(404).json({ error: 'Job not found', job_id })
      return
    }

    // Map Python status → Prisma JobStatus enum
    const prismaStatus = status as JobStatus

    // Update the job record
    await prisma.agentJob.update({
      where: { id: job_id },
      data: {
        status:      prismaStatus,
        output:      output ? (output as Prisma.InputJsonValue) : undefined,
        error:       error ?? undefined,
        completedAt: ['COMPLETED', 'FAILED'].includes(status) ? new Date() : undefined,
      },
    })

    // Fire appropriate WebSocket events
    const engagementId = job.engagementId

    const agentLabel = agent_name ?? job.agentName

    if (status === 'RUNNING') {
      wsEvents.jobStarted(engagementId, {
        agentName: agentLabel,
        jobId: job_id,
        jobDbId: job_id,
      })
    } else if (status === 'COMPLETED') {
      wsEvents.jobCompleted(engagementId, {
        agentName: agentLabel,
        jobId: job_id,
        outputSummary: output ? JSON.stringify(output).slice(0, 200) : '',
      })

      // If output contains a presigned_url — fire artifact_ready event
      if (output && typeof output === 'object' && 'presigned_url' in output) {
        wsEvents.artifactReady(engagementId, {
          collateralType: job.agentName,
          format: 'pptx',
          downloadUrl: output.presigned_url as string,
          version: (output.version as number) ?? 1,
        })
      }
    } else if (status === 'FAILED') {
      wsEvents.jobFailed(engagementId, {
        agentName: agentLabel,
        jobId: job_id,
        errorMessage: error ?? 'Unknown error from AI service',
        options: [
          { id: 'retry',   label: 'Retry',              description: 'Re-run this agent' },
          { id: 'proceed', label: 'Proceed anyway',      description: 'Continue with available output' },
          { id: 'manual',  label: 'Provide manual input', description: 'Enter the output manually' },
        ],
      })
    }

    // Audit log — use correct action per status
    const auditAction = status === 'COMPLETED' ? AuditAction.AGENT_COMPLETED
      : status === 'FAILED' ? AuditAction.AGENT_FAILED
      : AuditAction.AGENT_INVOKED
    await writeAuditLog({
      engagementId,
      userId:   'ai-service',
      action:   auditAction,
      detail:   { jobId: job_id, status, agent: agent_name, error: error ?? undefined },
    })

    // Auto-advance pipeline when a job completes
    if (status === 'COMPLETED') {
      tryAdvancePipeline(job_id, engagementId).catch((err) => {
        console.error('[internal/job-update] Pipeline advance failed:', err)
      })

      // If output contains a presigned_url — create a new version
      if (output && typeof output === 'object' && 'presigned_url' in output) {
        import('./version.routes').then(({ createNewVersion }) => {
          // Use a real user ID or system user if available, fallback to engagement creator if needed
          prisma.engagement.findUnique({ where: { id: engagementId } }).then(engagement => {
            if (engagement) {
              createNewVersion(engagementId, engagement.createdById, 'Initial generation', output).catch((err) => {
                console.error('[internal/job-update] Version creation failed:', err)
              })
            }
          })
        }).catch(err => console.error('Failed to import version routes', err))
      }

      // B-03 fix: write compliance matrix back to GateApproval records when scoring completes
      if (output && job.agentName === 'COMPLIANCE_SCORER') {
        const gateNumber = (job.input as any)?.gateNumber as string | undefined
        if (gateNumber) {
          await prisma.gateApproval.updateMany({
            where: { engagementId, gateNumber: gateNumber as any },
            data: { complianceMatrix: output as Prisma.InputJsonValue },
          }).catch((e) => console.warn('[internal] complianceMatrix update failed:', e))

          // Also re-fire gate_ready WS event with the actual compliance matrix now available
          wsEvents.gateReady(engagementId, {
            gateNumber,
            complianceMatrix: output,
            reviewerEmails: [], // already sent when gate was submitted
          })
        }
      }

      // If this was a diffgen job, write the summary back to the EngagementVersion
      if (output && typeof output === 'object' && 'summary' in output) {
        const jobRecord = await prisma.agentJob.findUnique({
          where: { id: job_id },
          select: { input: true },
        })
        const versionId = (jobRecord?.input as any)?.version_id as string | undefined
        if (versionId) {
          await prisma.engagementVersion.update({
            where: { id: versionId },
            data: { diffSummary: String((output as any).summary ?? '') },
          }).catch((e) => console.warn('[internal] diffSummary update failed:', e))
        }
      }
    }

    res.status(204).send()
  } catch (err) {
    console.error('[internal/job-update] Error processing callback:', err)
    res.status(500).json({ error: 'Internal error', message: 'Failed to process job update' })
  }
})
