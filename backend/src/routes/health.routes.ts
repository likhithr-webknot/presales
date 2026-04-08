import { Router, Request, Response } from 'express'
import { pingDb } from '../lib/prisma'
import { pingRedis } from '../config/redis'
import { pingStorage } from '../config/storage'

export const healthRouter = Router()

healthRouter.get('/', async (_req: Request, res: Response) => {
  const [db, redis, storage] = await Promise.all([pingDb(), pingRedis(), pingStorage()])

  const allHealthy = db && redis && storage
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: { db, redis, storage },
  })
})
