/**
 * GatePanel — shows gate status and allows reviewer to approve/reject
 */
import { useState } from 'react'
import { GateSummary } from '../services/api'
import { gatesApi } from '../services/api'

interface Props {
  gates: GateSummary[]
  engagementId: string
  userId: string
  onAction?: () => void
}

const GATE_LABELS: Record<string, string> = {
  GATE_1:       'Gate 1 — Initial Review',
  GATE_2:       'Gate 2 — Technical Review',
  GATE_3:       'Gate 3 — Final Review',
  DEFENSE_GATE: 'Defense Gate',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:               '#fbbf24',
  APPROVED:              '#34d399',
  APPROVED_WITH_FEEDBACK:'#86efac',
  REJECTED:              '#f87171',
  NOT_STARTED:           '#475569',
}

export function GatePanel({ gates, engagementId, userId, onAction }: Props) {
  const [feedback, setFeedback] = useState<Record<string, string>>({})
  const [loading, setLoading]   = useState<Record<string, boolean>>({})
  const [errors, setErrors]     = useState<Record<string, string>>({})

  if (gates.length === 0) return null

  // I-01 fix: surface error to user if approval API call fails
  const handleApprove = async (gateNumber: string, approved: boolean) => {
    setLoading(p => ({ ...p, [gateNumber]: true }))
    setErrors(p => ({ ...p, [gateNumber]: '' }))
    try {
      await gatesApi.approve(engagementId, gateNumber, { approved, feedback: feedback[gateNumber] })
      onAction?.()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Approval failed. Please try again.'
      setErrors(p => ({ ...p, [gateNumber]: msg }))
    } finally {
      setLoading(p => ({ ...p, [gateNumber]: false }))
    }
  }

  const isReviewer = (gate: GateSummary) =>
    gate.approvals.some(a => a.reviewer.id === userId && a.status === 'PENDING')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {gates.filter(g => !['SOW_AM', 'SOW_DM'].includes(g.gateNumber)).map(gate => (
        <div key={gate.gateNumber} style={{
          padding: 16, borderRadius: 10,
          backgroundColor: '#0d1526', border: '1px solid #1e293b',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9' }}>
              {GATE_LABELS[gate.gateNumber] ?? gate.gateNumber}
            </span>
            <span style={{ fontSize: 11, color: STATUS_COLORS[gate.overallStatus] ?? '#94a3b8', fontWeight: 600 }}>
              ● {gate.overallStatus}
            </span>
          </div>

          {/* Reviewer list */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {gate.approvals.map(a => (
              <div key={a.id} style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 12,
                backgroundColor: '#1e293b', color: STATUS_COLORS[a.status] ?? '#94a3b8',
              }}>
                {a.reviewer.name} — {a.status}
              </div>
            ))}
          </div>

          {/* Action panel for current user if they're a pending reviewer */}
          {isReviewer(gate) && gate.overallStatus === 'PENDING' && (
            <div style={{ marginTop: 8 }}>
              <textarea
                placeholder="Optional feedback..."
                value={feedback[gate.gateNumber] ?? ''}
                onChange={e => setFeedback(p => ({ ...p, [gate.gateNumber]: e.target.value }))}
                rows={2}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #1e293b',
                  backgroundColor: '#0a0f1e', color: '#f1f5f9', fontSize: 12, resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
              {errors[gate.gateNumber] && (
                <div style={{ fontSize: 11, color: '#f87171', marginTop: 6 }}>
                  {errors[gate.gateNumber]}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => handleApprove(gate.gateNumber, true)}
                  disabled={loading[gate.gateNumber]}
                  style={{
                    padding: '7px 18px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    backgroundColor: '#065f46', color: '#6ee7b7', fontWeight: 600, fontSize: 12,
                  }}
                >
                  ✓ Approve
                </button>
                <button
                  onClick={() => handleApprove(gate.gateNumber, false)}
                  disabled={loading[gate.gateNumber]}
                  style={{
                    padding: '7px 18px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    backgroundColor: '#7f1d1d', color: '#fca5a5', fontWeight: 600, fontSize: 12,
                  }}
                >
                  ✗ Reject
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
