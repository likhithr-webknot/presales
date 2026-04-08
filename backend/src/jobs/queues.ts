import { Queue } from 'bullmq'
import { redisConnection } from '../config/redis'

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: { count: 100 },
  removeOnFail: false,
}

const makeQueue = (name: string) =>
  new Queue(name, { connection: redisConnection, defaultJobOptions: DEFAULT_JOB_OPTIONS })

export const queues = {
  research:  makeQueue('research'),
  context:   makeQueue('context'),
  casestudy: makeQueue('casestudy'),
  sow:       makeQueue('sow'),
  narrative: makeQueue('narrative'),
  technical: makeQueue('technical'),
  packaging: makeQueue('packaging'),
  pricing:   makeQueue('pricing'),
  scoring:   makeQueue('scoring'),
  email:     makeQueue('email'),
  diffgen:   makeQueue('diffgen'),
} as const

export type QueueName = keyof typeof queues

export const QUEUE_CONCURRENCY: Record<QueueName, number> = {
  research:  3,
  context:   3,
  casestudy: 3,
  sow:       2,
  narrative: 2,
  technical: 2,
  packaging: 5,
  pricing:   3,
  scoring:   5,
  email:     10,
  diffgen:   5,
}
