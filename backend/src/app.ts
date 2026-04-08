import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import passport from 'passport'
import { env } from './config/env'
import { authRouter } from './routes/auth.routes'
import { healthRouter } from './routes/health.routes'
import { engagementRouter } from './routes/engagement.routes'
import { uploadRouter } from './routes/upload.routes'
import { jobRouter } from './routes/job.routes'
import { internalRouter } from './routes/internal.routes'
import { errorMiddleware } from './middleware/error.middleware'

export function createApp() {
  const app = express()

  // Security headers
  app.use(helmet())

  // CORS — only allow frontend origin
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }))

  // Body parsing
  app.use(express.json({ limit: `${env.MAX_UPLOAD_SIZE_MB}mb` }))
  app.use(express.urlencoded({ extended: true }))
  app.use(cookieParser())

  // Passport (no sessions — JWT only)
  app.use(passport.initialize())

  // Routes
  app.use('/auth', authRouter)
  app.use('/health', healthRouter)
  app.use('/api/engagements', engagementRouter)
  app.use('/api/uploads', uploadRouter)
  app.use('/api/jobs', jobRouter)
  // Internal routes — AI service callbacks (protected by x-ai-internal-secret)
  app.use('/api/internal', internalRouter)

  // Global error handler — must be last
  app.use(errorMiddleware)

  return app
}
