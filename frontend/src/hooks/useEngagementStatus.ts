import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useCallback } from 'react'
import { engagementsApi, EngagementStatusResponse } from '../services/api'
import { getSocket, joinEngagementRoom, leaveEngagementRoom } from '../services/socket'

/**
 * Polls GET /api/engagements/:id/status every 5s when agents are active.
 * Also invalidates on relevant WebSocket events so UI stays in sync.
 *
 * B-02 fix: WS handlers check the engagementId in the payload before invalidating
 * so that events for other engagements don't pollute this query's cache.
 *
 * I-06 fix: `invalidate` wrapped in useCallback with stable deps so the
 * useEffect dependency array is complete and linter-clean.
 */
export function useEngagementStatus(engagementId: string) {
  const queryClient = useQueryClient()

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['engagement-status', engagementId] })
  }, [queryClient, engagementId])

  const { data, isLoading, error } = useQuery<EngagementStatusResponse>({
    queryKey: ['engagement-status', engagementId],
    queryFn: () => engagementsApi.status(engagementId),
    refetchInterval: (query) => {
      const d = query.state.data as EngagementStatusResponse | undefined
      if (!d) return 5000
      return d.health.hasActiveWork ? 5000 : 30_000
    },
    staleTime: 3000,
  })

  useEffect(() => {
    joinEngagementRoom(engagementId)
    const socket = getSocket()

    // Scoped handler — only invalidates when event is for THIS engagement
    const scoped = (payload: { engagementId?: string } | undefined) => {
      if (payload?.engagementId && payload.engagementId !== engagementId) return
      invalidate()
    }

    socket.on('job_started',       scoped)
    socket.on('job_completed',     scoped)
    socket.on('job_failed',        scoped)
    socket.on('gate_ready',        scoped)
    socket.on('gate_approved',     scoped)
    socket.on('gate_rejected',     scoped)
    socket.on('artifact_ready',    scoped)
    socket.on('cascade_detected',  scoped)
    socket.on('sow_section_ready', scoped)

    return () => {
      leaveEngagementRoom(engagementId)
      socket.off('job_started',       scoped)
      socket.off('job_completed',     scoped)
      socket.off('job_failed',        scoped)
      socket.off('gate_ready',        scoped)
      socket.off('gate_approved',     scoped)
      socket.off('gate_rejected',     scoped)
      socket.off('artifact_ready',    scoped)
      socket.off('cascade_detected',  scoped)
      socket.off('sow_section_ready', scoped)
    }
  }, [engagementId, invalidate])

  return { status: data ?? null, isLoading, error }
}
