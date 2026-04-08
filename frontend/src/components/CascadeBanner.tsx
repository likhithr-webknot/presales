/**
 * CascadeBanner — appears when cascade_detected WS event fires.
 * Shows what changed and whether manual restart is required.
 */
import { useState, useEffect } from 'react'
import { getSocket, WsCascadeDetected } from '../services/socket'

interface Props {
  engagementId: string
  onRestart?: () => void
}

export function CascadeBanner({ engagementId, onRestart }: Props) {
  const [event, setEvent] = useState<WsCascadeDetected | null>(null)

  useEffect(() => {
    const socket = getSocket()
    // I-05 fix: scope handler to this engagement — ignore cascade events for others
    const handler = (data: WsCascadeDetected & { engagementId?: string }) => {
      if (data.engagementId && data.engagementId !== engagementId) return
      setEvent(data)
    }
    socket.on('cascade_detected', handler)
    return () => { socket.off('cascade_detected', handler) }
  }, [engagementId])

  if (!event) return null

  return (
    <div style={{
      padding: '12px 16px', borderRadius: 10, marginBottom: 16,
      backgroundColor: '#2d1f00', border: '1px solid #92400e',
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    }}>
      <div>
        <div style={{ fontWeight: 700, color: '#fbbf24', fontSize: 13, marginBottom: 4 }}>
          ⚠️ Engagement updated — some agents were cancelled
        </div>
        <div style={{ fontSize: 12, color: '#d97706' }}>{event.message}</div>
        <div style={{ fontSize: 11, color: '#92400e', marginTop: 4 }}>
          Affected: {event.invalidatedAgents.join(', ')}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginLeft: 16, flexShrink: 0 }}>
        {event.requiresManualRestart && onRestart && (
          <button
            onClick={() => { onRestart(); setEvent(null) }}
            style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              backgroundColor: '#92400e', color: '#fef3c7', fontWeight: 600, fontSize: 12,
            }}
          >
            ↺ Restart Pipeline
          </button>
        )}
        <button
          onClick={() => setEvent(null)}
          style={{
            padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
            backgroundColor: '#1e293b', color: '#94a3b8', fontSize: 12,
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
