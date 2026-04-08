import { Router, Request, Response, NextFunction } from 'express'
import { JobStatus } from '@prisma/client'
import { authMiddleware } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'
import { queues } from '../jobs/queues'

export const jobRouter = Router()
jobRouter.use(authMiddleware)

// GET /api/jobs/:jobId
jobRouter.get('/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await prisma.agentJob.findUniqueOrThrow({ where: { id: req.params.jobId } })
    res.json(job)
  } catch (err) { next(err) }
})

// POST /api/jobs/:jobId/retry
jobRouter.post('/:jobId/retry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await prisma.agentJob.findUniqueOrThrow({ where: { id: req.params.jobId } })

    if (job.status !== JobStatus.FAILED) {
      res.status(400).json({ error: 'Bad Request', message: 'Only failed jobs can be retried' })
      return
    }

    // Re-queue with same input
    const queueName = getQueueForAgent(job.agentName)
    if (!queueName) {
      res.status(400).json({ error: 'Bad Request', message: `No queue found for agent: ${job.agentName}` })
      return
    }

    const input = job.input as Record<string, unknown>
    const bullJob = await queues[queueName].add(job.agentName, { ...input, jobId: job.id })

    await prisma.agentJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.QUEUED,
        bullmqJobId: bullJob.id ?? null,
        error: null,
        retryCount: { increment: 1 },
      },
    })

    res.json({ message: 'Job re-queued', bullmqJobId: bullJob.id })
  } catch (err) { next(err) }
})

// POST /api/jobs/:jobId/cancel
jobRouter.post('/:jobId/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await prisma.agentJob.findUniqueOrThrow({ where: { id: req.params.jobId } })

    if (job.bullmqJobId) {
      const queueName = getQueueForAgent(job.agentName)
      if (queueName) {
        const bullJob = await queues[queueName].getJob(job.bullmqJobId)
        await bullJob?.remove()
      }
    }

    await prisma.agentJob.update({
      where: { id: job.id },
      data: { status: JobStatus.CANCELLED },
    })

    res.json({ message: 'Job cancelled' })
  } catch (err) { next(err) }
})

type QueueKey = keyof typeof queues

function getQueueForAgent(agentName: string): QueueKey | null {
  const map: Record<string, QueueKey> = {
    SECONDARY_RESEARCH: 'research',
    CONTEXT_MANAGER:    'context',
    CASE_STUDY_MAKER:   'casestudy',
    SOW_MAKER:          'sow',
    NARRATIVE_AGENT:    'narrative',
    TECHNICAL_SOLUTION: 'technical',
    PACKAGING_AGENT:    'packaging',
    PRICING_ADAPTER:    'pricing',
    COMPLIANCE_SCORER:  'scoring',
    MEETMINDS_ADAPTER:  'research',
  }
  return map[agentName] ?? null
}
