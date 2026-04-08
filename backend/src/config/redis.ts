import { Redis } from 'ioredis'
import { env } from './env'

export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck: false,
})

redisConnection.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message)
})

redisConnection.on('connect', () => {
  console.log('[Redis] Connected')
})

export async function pingRedis(): Promise<boolean> {
  try {
    const result = await redisConnection.ping()
    return result === 'PONG'
  } catch {
    return false
  }
}
