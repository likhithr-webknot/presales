import { Router, Request, Response, NextFunction } from 'express'
import { timingSafeEqual } from 'crypto'
import { z } from 'zod'
import { JobStatus } from '@prisma/client'
import { env } from '../config/env'
import { applyJobUpdate } from '../agents/orchestrator/pipeline'

/** Service-to-service endpoints. Not for browsers: authenticated by the shared secret only. */
export const internalRouter = Router()

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

internalRouter.use((req: Request, res: Response, next: NextFunction) => {
  const secret = req.header('x-ai-internal-secret') ?? ''
  if (!safeEqual(secret, env.AI_INTERNAL_SECRET)) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
})

const updateSchema = z.object({
  job_id: z.string().uuid(),
  status: z.nativeEnum(JobStatus),
  output: z.record(z.unknown()).nullable().optional(),
  error: z.string().max(4000).nullable().optional(),
  agent_name: z.string().nullable().optional(),
})

// POST /api/internal/job-update — called by the ai-service when a job starts, finishes or fails
internalRouter.post('/job-update', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = updateSchema.parse(req.body)
    await applyJobUpdate(body.job_id, { status: body.status, output: body.output, error: body.error })
    res.status(204).end()
  } catch (err) { next(err) }
})
