import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { engagementsApi, EngagementStatusResponse } from '../services/api'
import { getSocket, joinEngagementRoom, leaveEngagementRoom } from '../services/socket'

/**
 * Polls GET /api/engagements/:id/status every 5s when agents are active.
 * Also invalidates on relevant WebSocket events so UI stays in sync.
 */
export function useEngagementStatus(engagementId: string) {
  const queryClient = useQueryClient()
  const key = ['engagement-status', engagementId]

  const { data, isLoading, error } = useQuery<EngagementStatusResponse>({
    queryKey: key,
    queryFn: () => engagementsApi.status(engagementId),
    refetchInterval: (query) => {
      // Poll every 5s when work is active; slow down to 30s when idle
      const d = query.state.data as EngagementStatusResponse | undefined
      if (!d) return 5000
      return d.health.hasActiveWork ? 5000 : 30_000
    },
    staleTime: 3000,
  })

  // Join WS room and invalidate query on relevant events
  useEffect(() => {
    joinEngagementRoom(engagementId)
    const socket = getSocket()

    const invalidate = () => queryClient.invalidateQueries({ queryKey: key })

    socket.on('job_started',      invalidate)
    socket.on('job_completed',    invalidate)
    socket.on('job_failed',       invalidate)
    socket.on('gate_ready',       invalidate)
    socket.on('gate_approved',    invalidate)
    socket.on('gate_rejected',    invalidate)
    socket.on('artifact_ready',   invalidate)
    socket.on('cascade_detected', invalidate)
    socket.on('sow_section_ready', invalidate)

    return () => {
      leaveEngagementRoom(engagementId)
      socket.off('job_started',       invalidate)
      socket.off('job_completed',     invalidate)
      socket.off('job_failed',        invalidate)
      socket.off('gate_ready',        invalidate)
      socket.off('gate_approved',     invalidate)
      socket.off('gate_rejected',     invalidate)
      socket.off('artifact_ready',    invalidate)
      socket.off('cascade_detected',  invalidate)
      socket.off('sow_section_ready', invalidate)
    }
  }, [engagementId])

  return { status: data ?? null, isLoading, error }
}
