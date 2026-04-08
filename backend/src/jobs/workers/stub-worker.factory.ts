import { Worker } from 'bullmq'
import { redisConnection } from '../../config/redis'
import { prisma } from '../../lib/prisma'
import { JobStatus } from '@prisma/client'
import { QueueName, QUEUE_CONCURRENCY } from '../queues'

/**
 * Creates a stub worker for a queue.
 * Logs receipt, marks job complete, updates AgentJob DB record.
 * Replace with real implementation in later sprints.
 */
export function createStubWorker(queueName: QueueName): Worker {
  const worker = new Worker(
    queueName,
    async (job) => {
      console.log(`[Worker:${queueName}] STUB: job received — jobId=${job.id}, data=${JSON.stringify(job.data).slice(0, 100)}`)

      const dbJobId: string | undefined = job.data?.jobId as string | undefined
      if (dbJobId) {
        await prisma.agentJob.update({
          where: { id: dbJobId },
          data: { status: JobStatus.RUNNING, startedAt: new Date() },
        })
      }

      // Simulate minimal async work
      await new Promise((r) => setTimeout(r, 100))

      if (dbJobId) {
        await prisma.agentJob.update({
          where: { id: dbJobId },
          data: {
            status: JobStatus.COMPLETED,
            completedAt: new Date(),
            output: { stub: true, message: `Stub output from ${queueName} worker` },
          },
        })
      }

      return { stub: true, queueName }
    },
    {
      connection: redisConnection,
      concurrency: QUEUE_CONCURRENCY[queueName],
    }
  )

  worker.on('failed', async (job, err) => {
    console.error(`[Worker:${queueName}] Job failed — jobId=${job?.id}: ${err.message}`)
    const dbJobId: string | undefined = job?.data?.jobId as string | undefined
    if (dbJobId) {
      await prisma.agentJob.update({
        where: { id: dbJobId },
        data: { status: JobStatus.FAILED, error: err.message },
      }).catch(() => {}) // don't throw if DB update fails
    }
  })

  console.log(`[Worker:${queueName}] Stub worker registered (concurrency=${QUEUE_CONCURRENCY[queueName]})`)
  return worker
}

export function registerAllStubWorkers(): Worker[] {
  const queueNames: QueueName[] = [
    'research', 'context', 'casestudy', 'sow',
    'narrative', 'technical', 'packaging', 'pricing',
    'scoring', 'email', 'diffgen',
  ]
  return queueNames.map(createStubWorker)
}
