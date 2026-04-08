import { Server as HttpServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import { env } from '../../config/env'
import { AuthUser } from '../../middleware/auth.middleware'
import { verifyToken } from '../../lib/jwt'
import { prisma } from '../../lib/prisma'
import { RoleType } from '@prisma/client'

let io: SocketServer | null = null

export function initWebSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
    },
  })

  // Auth handshake: validate JWT from cookie
  io.use((socket, next) => {
    const cookie = socket.handshake.headers.cookie
    const token = cookie
      ?.split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('token='))
      ?.split('=')[1]

    if (!token) {
      next(new Error('Unauthorized: no session token'))
      return
    }
    try {
      const user = verifyToken<AuthUser>(token)
      socket.data.user = user
      next()
    } catch {
      next(new Error('Unauthorized: invalid token'))
    }
  })

  io.on('connection', (socket) => {
    const user = socket.data.user as AuthUser
    console.log(`[WS] Connected: ${user.email} (${socket.id})`)

    // Client joins engagement-scoped room — with participant access check (Warden S0-M-02)
    socket.on('join:engagement', async (engagementId: string) => {
      try {
        // ADMIN can join any room
        if (user.roles.includes(RoleType.ADMIN)) {
          socket.join(`engagement:${engagementId}`)
          return
        }
        const engagement = await prisma.engagement.findUnique({
          where: { id: engagementId },
          include: { reviewers: true },
        })
        if (!engagement) {
          socket.emit('error', { message: 'Engagement not found' })
          return
        }
        const isParticipant =
          engagement.createdById === user.id ||
          engagement.reviewers.some((r) => r.reviewerId === user.id) ||
          user.roles.includes(RoleType.SALES_HEAD) ||
          user.roles.includes(RoleType.DM)
        if (!isParticipant) {
          socket.emit('error', { message: 'Access denied to this engagement' })
          return
        }
        socket.join(`engagement:${engagementId}`)
        console.log(`[WS] ${user.email} joined room: engagement:${engagementId}`)
      } catch {
        socket.emit('error', { message: 'Failed to join engagement room' })
      }
    })

    socket.on('leave:engagement', (engagementId: string) => {
      socket.leave(`engagement:${engagementId}`)
    })

    socket.on('disconnect', () => {
      console.log(`[WS] Disconnected: ${user.email}`)
    })
  })

  console.log('[WS] Socket.io server initialized')
  return io
}

export function getIO(): SocketServer {
  if (!io) throw new Error('[WS] Socket.io not initialized — call initWebSocket first')
  return io
}
