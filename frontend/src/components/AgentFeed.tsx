/**
 * AgentFeed — live job progress panel
 * Shows active, completed, and failed agent jobs.
 * Failed jobs show action option cards.
 */
import { useState, useEffect } from 'react'
import { AgentJob } from '../services/api'
import { getSocket, WsJobFailed } from '../services/socket'

const AGENT_LABELS: Record<string, string> = {
  SECONDARY_RESEARCH: '🔍 Research',
  CONTEXT_MANAGER:    '📚 Context Manager',
  PACKAGING_AGENT:    '📦 Packaging',
  NARRATIVE_AGENT:    '✍️ Narrative',
  TECHNICAL_SOLUTION: '⚙️ Technical Solution',
  COMPLIANCE_SCORER:  '📊 Compliance Scorer',
  CASE_STUDY_MAKER:   '💼 Case Study',
  SOW_MAKER:          '📝 SOW Maker',
  DIFFGEN:            '🔀 Diff Generator',
  PRICING_ADAPTER:    '💰 Pricing',
}

interface Props {
  active: AgentJob[]
  failed: AgentJob[]
  completedCount: number
  onJobAction?: (jobId: string, action: string) => void
}

export function AgentFeed({ active, failed, completedCount, onJobAction }: Props) {
  const [liveFailures, setLiveFailures] = useState<WsJobFailed[]>([])

  useEffect(() => {
    const socket = getSocket()
    const handler = (data: WsJobFailed) => {
      setLiveFailures(prev => [data, ...prev.filter(f => f.jobId !== data.jobId)])
    }
    socket.on('job_failed', handler)
    return () => { socket.off('job_failed', handler) }
  }, [])

  // Merge WS failures with prop failures (deduplicate by jobId)
  const allFailed = [
    ...liveFailures,
    ...failed.filter(f => !liveFailures.find(l => l.jobId === f.id)).map(f => ({
      agentName: f.agentName,
      jobId: f.id,
      errorMessage: f.error ?? 'Unknown error',
      options: [
        { id: 'retry',   label: 'Retry',               description: 'Re-run this agent' },
        { id: 'proceed', label: 'Proceed anyway',       description: 'Continue with available output' },
        { id: 'manual',  label: 'Provide manual input', description: 'Enter the output manually' },
      ],
    })),
  ]

  if (active.length === 0 && allFailed.length === 0 && completedCount === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Active jobs */}
      {active.map(job => (
        <div key={job.id} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 16px', borderRadius: 10,
          backgroundColor: '#0f2a3f', border: '1px solid #1e4976',
        }}>
          <span style={{ fontSize: 18 }}>⚙️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#60a5fa' }}>
              {AGENT_LABELS[job.agentName] ?? job.agentName}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              {job.status === 'RUNNING' ? 'Running…' : 'Queued'}
            </div>
          </div>
          <Spinner />
        </div>
      ))}

      {/* Failed jobs with action cards */}
      {allFailed.map(job => (
        <div key={job.jobId} style={{
          padding: '12px 16px', borderRadius: 10,
          backgroundColor: '#2d1a1a', border: '1px solid #7f1d1d',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f87171', marginBottom: 4 }}>
            ❌ {AGENT_LABELS[job.agentName] ?? job.agentName} failed
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>
            {job.errorMessage}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {job.options.map(opt => (
              <button
                key={opt.id}
                onClick={() => onJobAction?.(job.jobId, opt.id)}
                title={opt.description}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  backgroundColor: opt.id === 'retry' ? '#1e40af' : '#1e293b',
                  color: '#f1f5f9', fontSize: 12, fontWeight: 600,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Completed count */}
      {completedCount > 0 && active.length === 0 && allFailed.length === 0 && (
        <div style={{ fontSize: 12, color: '#34d399', padding: '6px 0' }}>
          ✅ {completedCount} agent{completedCount !== 1 ? 's' : ''} completed
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <div style={{
      width: 16, height: 16,
      border: '2px solid #1e4976',
      borderTop: '2px solid #60a5fa',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
  )
}
