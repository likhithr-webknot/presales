import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_API_URL ?? 'http://localhost:3000', {
      withCredentials: true,
      transports: ['websocket'],
    })
  }
  return socket
}

export function joinEngagementRoom(engagementId: string) {
  getSocket().emit('join', { engagementId })
}

export function leaveEngagementRoom(engagementId: string) {
  getSocket().emit('leave', { engagementId })
}

// M-01 fix: call on logout so stale socket doesn't persist with expired auth
export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export type WsJobStarted = { agentName: string; jobId: string; jobDbId: string; timestamp: string }
export type WsJobProgress = { agentName: string; jobId: string; message: string; percentComplete?: number }
export type WsJobCompleted = { agentName: string; jobId: string; outputSummary: string; timestamp: string }
export type WsJobFailed = {
  agentName: string
  jobId: string
  errorMessage: string
  options: { id: string; label: string; description: string }[]
}
export type WsGateReady = { gateNumber: string; complianceMatrix: unknown; reviewerEmails: string[]; timestamp: string }
export type WsGateApproved = { gateNumber: string; reviewerName: string; feedback?: string; allApproved: boolean; timestamp: string }
export type WsGateRejected = { gateNumber: string; reviewerName: string; feedback: string; timestamp: string }
export type WsArtifactReady = { collateralType: string; format: string; downloadUrl: string; version: number; timestamp: string }
export type WsCascadeDetected = {
  changedFields: string[]
  invalidatedAgents: string[]
  cancelledJobIds: string[]
  staleJobIds: string[]
  staleVersionIds: string[]
  requiresManualRestart: boolean
  message: string
  timestamp: string
}
export type WsSowSectionReady = { section: string; content: string; sectionIndex: number; totalSections: number; requiresConfirmation: boolean }
