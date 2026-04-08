/**
 * Approvals page — accessed via email token link.
 * Reviewer can approve/reject a gate without logging in.
 * Token is validated server-side.
 */
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../services/api'

export default function ApprovalsPage() {
  const { token } = useParams<{ token: string }>()
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!decision) return
    setSubmitting(true)
    try {
      await api.post(`/api/approvals/${token}`, {
        approved: decision === 'approved',
        feedback: feedback || undefined,
      })
      setDone(true)
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Submission failed. The link may have expired.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#030712', fontFamily: 'system-ui, sans-serif', color: '#f9fafb',
    }}>
      <div style={{
        width: 480, padding: 36, borderRadius: 16,
        backgroundColor: '#0a0f1e', border: '1px solid #1e293b',
      }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>Gate Review</h1>
        <p style={{ color: '#475569', fontSize: 13, margin: '0 0 24px' }}>
          Review and approve or reject this presales deliverable.
        </p>

        {done ? (
          <div style={{ padding: '16px', borderRadius: 8, backgroundColor: '#0f2a1a', color: '#34d399', fontWeight: 600 }}>
            ✅ Your response has been recorded. Thank you.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <DecisionCard
                selected={decision === 'approved'}
                onClick={() => setDecision('approved')}
                label="✓ Approve"
                bg={decision === 'approved' ? '#065f46' : '#0d1526'}
                color={decision === 'approved' ? '#6ee7b7' : '#64748b'}
              />
              <DecisionCard
                selected={decision === 'rejected'}
                onClick={() => setDecision('rejected')}
                label="✗ Reject"
                bg={decision === 'rejected' ? '#7f1d1d' : '#0d1526'}
                color={decision === 'rejected' ? '#fca5a5' : '#64748b'}
              />
            </div>

            <textarea
              placeholder="Optional feedback for the team…"
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              rows={4}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid #1e293b', backgroundColor: '#030712',
                color: '#f1f5f9', fontSize: 13, resize: 'vertical', boxSizing: 'border-box',
                marginBottom: 16, outline: 'none',
              }}
            />

            {error && (
              <div style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>{error}</div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!decision || submitting}
              style={{
                width: '100%', padding: '11px 0', borderRadius: 8, border: 'none',
                cursor: 'pointer', fontWeight: 700, fontSize: 14,
                backgroundColor: decision === 'approved' ? '#065f46' : decision === 'rejected' ? '#7f1d1d' : '#1e293b',
                color: decision ? '#f1f5f9' : '#475569',
                opacity: !decision ? 0.5 : 1,
              }}
            >
              {submitting ? 'Submitting…' : decision === 'approved' ? 'Confirm Approval' : decision === 'rejected' ? 'Confirm Rejection' : 'Select a Decision'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function DecisionCard({ selected, onClick, label, bg, color }: {
  selected: boolean; onClick: () => void; label: string; bg: string; color: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '14px 0', borderRadius: 10, border: selected ? '2px solid currentColor' : '2px solid #1e293b',
        cursor: 'pointer', fontWeight: 700, fontSize: 15,
        backgroundColor: bg, color, transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
}
