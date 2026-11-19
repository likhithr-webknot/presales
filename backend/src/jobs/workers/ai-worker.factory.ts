import { Worker } from 'bullmq'
import { AgentName, JobStatus } from '@prisma/client'
import { redisConnection } from '../../config/redis'
import { env } from '../../config/env'
import { prisma } from '../../lib/prisma'
import { adapters } from '../../adapters/factory'
import { QueueName, QUEUE_CONCURRENCY } from '../queues'
import { buildAiPayload, AiSource } from '../../agents/orchestrator/ai-payload'
import { applyJobUpdate } from '../../agents/orchestrator/pipeline'
import { dispatchJob } from '../../services/ai-client'

const ALL_QUEUES: QueueName[] = [
  'research', 'context', 'casestudy', 'sow', 'narrative', 'technical', 'packaging', 'pricing', 'scoring', 'email', 'diffgen',
]

/**
 * MeetMinds is a Node-side adapter, not an LLM job. Real transcripts become evidence;
 * stub-adapter fixtures never do.
 */
async function runMeetMinds(clientName: string): Promise<Record<string, unknown>> {
  if (env.MEETMINDS_ADAPTER === 'stub') {
    return { status: 'skipped', sources: [], note: 'MeetMinds adapter is a stub; no meeting evidence was used.' }
  }
  const meetings = await adapters.meetminds.listMeetings({ clientName })
  const sources: AiSource[] = []
  for (const m of meetings.slice(0, 5)) {
    const t = await adapters.meetminds.getTranscript(m.meetingId)
    sources.push({ kind: 'upload', title: `Meeting ${m.meetingType} ${m.date.toISOString().slice(0, 10)}`, text: t.transcript, uri: `meetminds:${m.meetingId}` })
  }
  return { status: 'ready', sources }
}

/**
 * Real BullMQ workers. A worker hands the job to the ai-service and returns; completion
 * arrives asynchronously through POST /api/internal/job-update.
 */
export function registerAiWorkers(): Worker[] {
  return ALL_QUEUES.map((queueName) => {
    const worker = new Worker(
      queueName,
      async (job) => {
        const jobId = job.data?.jobId as string | undefined
        if (!jobId) throw new Error('Queue message is missing jobId')
        const dbJob = await prisma.agentJob.findUniqueOrThrow({ where: { id: jobId } })
        if (dbJob.status === JobStatus.CANCELLED || dbJob.status === JobStatus.COMPLETED) return

        await applyJobUpdate(jobId, { status: JobStatus.RUNNING })

        if (dbJob.agentName === AgentName.MEETMINDS_ADAPTER) {
          const input = dbJob.input as { clientName?: string }
          await applyJobUpdate(jobId, { status: JobStatus.COMPLETED, output: await runMeetMinds(input.clientName ?? '') })
          return
        }
        await dispatchJob(jobId, dbJob.engagementId, queueName, await buildAiPayload(dbJob))
      },
      { connection: redisConnection, concurrency: QUEUE_CONCURRENCY[queueName] }
    )

    // Runs after BullMQ exhausts its retries (dispatch failed repeatedly).
    worker.on('failed', async (job, err) => {
      const jobId = job?.data?.jobId as string | undefined
      const exhausted = job && job.attemptsMade >= (job.opts.attempts ?? 1)
      console.error(`[Worker:${queueName}] attempt failed for ${jobId}: ${err.message}`)
      if (jobId && exhausted) {
        await applyJobUpdate(jobId, { status: JobStatus.FAILED, error: err.message }).catch((e) =>
          console.error('[Worker] could not record failure:', e)
        )
      }
    })
    console.log(`[Worker:${queueName}] registered (concurrency=${QUEUE_CONCURRENCY[queueName]})`)
    return worker
  })
}

const STALE_AFTER_MS = 15 * 60 * 1000

/** Fails jobs the ai-service accepted but never reported back on (crash, lost callback). */
export function startStaleJobReaper(): NodeJS.Timeout {
  const timer = setInterval(async () => {
    try {
      const stale = await prisma.agentJob.findMany({
        where: { status: JobStatus.RUNNING, startedAt: { lt: new Date(Date.now() - STALE_AFTER_MS) } },
        select: { id: true },
      })
      for (const { id } of stale) {
        await applyJobUpdate(id, { status: JobStatus.FAILED, error: 'Timed out waiting for the AI service' })
      }
    } catch (err) {
      console.error('[Reaper] sweep failed:', err)
    }
  }, 60_000)
  timer.unref()
  return timer
}
