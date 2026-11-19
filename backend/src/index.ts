import './config/env' // fail fast on bad env before anything else
import { createServer } from 'http'
import { createApp } from './app'
import { initBuckets } from './config/storage'
import { initWebSocket } from './services/websocket/server'
import { registerAiWorkers, startStaleJobReaper } from './jobs/workers/ai-worker.factory'
import { initAdapters } from './adapters/factory'
import { env } from './config/env'

async function main() {
  console.log(`\n🚀 Presales Orchestrator — starting (${env.NODE_ENV})\n`)

  // Initialise external connections
  await initBuckets()
  initAdapters()

  // Create Express app + HTTP server
  const app = createApp()
  const httpServer = createServer(app)

  // WebSocket on same server
  initWebSocket(httpServer)

  // BullMQ workers hand jobs to the ai-service; results return via /api/internal/job-update
  registerAiWorkers()
  startStaleJobReaper()

  httpServer.listen(env.PORT, () => {
    console.log(`\n✅ Server running on http://localhost:${env.PORT}`)
    console.log(`   Health: http://localhost:${env.PORT}/health`)
    console.log(`   Auth:   http://localhost:${env.PORT}/auth/google\n`)
  })

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received — shutting down gracefully')
    httpServer.close(() => process.exit(0))
  })
}

main().catch((err) => {
  console.error('❌ Fatal startup error:', err)
  process.exit(1)
})
