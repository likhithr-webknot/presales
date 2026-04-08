import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { engagementsApi, CollateralType } from '../../services/api'
import { StatusBadge } from '../../components/StatusBadge'

const COLLATERAL_OPTIONS: { value: CollateralType; label: string }[] = [
  { value: 'FIRST_MEETING_DECK',    label: 'First Meeting Deck' },
  { value: 'POST_DISCOVERY_DECK',   label: 'Post Discovery Deck' },
  { value: 'TECHNICAL_PROPOSAL',    label: 'Technical Proposal' },
  { value: 'PROPOSAL_DEFENSE_DECK', label: 'Proposal Defense Deck' },
  { value: 'STATEMENT_OF_WORK',     label: 'Statement of Work' },
  { value: 'COMMERCIAL_ESTIMATION', label: 'Commercial Estimation' },
  { value: 'CASE_STUDY_DOCUMENT',   label: 'Case Study' },
  { value: 'MARKETING_CONTENT',     label: 'Marketing Content' },
]

const DOMAIN_OPTIONS = [
  'EdTech', 'FinTech', 'HealthTech', 'E-Commerce', 'SaaS', 'Enterprise',
  'Logistics', 'Real Estate', 'Manufacturing', 'Government', 'Non-Profit', 'Other',
]

function timeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({
    clientName: '', domain: '', collateralType: '' as CollateralType, opportunityContext: '',
  })

  const { data: engagements = [], isLoading } = useQuery({
    queryKey: ['engagements'],
    queryFn: engagementsApi.list,
    refetchInterval: 30_000,
  })

  const createMutation = useMutation({
    mutationFn: () => engagementsApi.create({
      clientName: form.clientName,
      domain: form.domain,
      collateralType: form.collateralType,
      opportunityContext: form.opportunityContext || undefined,
    }),
    onSuccess: (eng) => {
      queryClient.invalidateQueries({ queryKey: ['engagements'] })
      navigate(`/engagements/${eng.id}`)
    },
  })

  const isAdmin = user?.roles.includes('ADMIN')

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#030712', fontFamily: 'system-ui, sans-serif', color: '#f9fafb',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 32px', borderBottom: '1px solid #0f172a',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#0a0f1e',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>🏛️</span>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#f1f5f9' }}>Presales Orchestrator</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {isAdmin && (
            <button onClick={() => navigate('/admin')} style={linkBtn}>Admin</button>
          )}
          <div style={{ fontSize: 13, color: '#64748b' }}>{user?.name}</div>
          <button
            onClick={() => { fetch('/auth/logout', { method: 'POST', credentials: 'include' }).then(() => navigate('/login')) }}
            style={linkBtn}
          >
            Sign out
          </button>
        </div>
      </div>

      <div style={{ padding: '32px', maxWidth: 960, margin: '0 auto' }}>
        {/* Title row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Engagements</h1>
            <p style={{ margin: '4px 0 0', color: '#475569', fontSize: 13 }}>
              {isAdmin ? 'All engagements' : 'Your active engagements'}
            </p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            style={{
              padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
              backgroundColor: '#1e40af', color: '#f1f5f9', fontWeight: 600, fontSize: 14,
            }}
          >
            + New Engagement
          </button>
        </div>

        {/* New Engagement Modal */}
        {showNew && (
          <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
          }}>
            <div style={{
              backgroundColor: '#0a0f1e', borderRadius: 16, padding: 32, width: 480,
              border: '1px solid #1e293b', maxHeight: '90vh', overflowY: 'auto',
            }}>
              <h2 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 700 }}>New Engagement</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Client Name">
                  <input
                    value={form.clientName} onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))}
                    placeholder="e.g. Acme Corp" style={inputStyle}
                  />
                </Field>
                <Field label="Domain">
                  <select value={form.domain} onChange={e => setForm(p => ({ ...p, domain: e.target.value }))} style={inputStyle}>
                    <option value="">Select domain…</option>
                    {DOMAIN_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Collateral Type">
                  <select value={form.collateralType} onChange={e => setForm(p => ({ ...p, collateralType: e.target.value as CollateralType }))} style={inputStyle}>
                    <option value="">Select type…</option>
                    {COLLATERAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <Field label="Opportunity Context (optional)">
                  <textarea
                    value={form.opportunityContext} onChange={e => setForm(p => ({ ...p, opportunityContext: e.target.value }))}
                    placeholder="Brief context about the opportunity…" rows={3} style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </Field>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button
                  onClick={() => createMutation.mutate()}
                  disabled={!form.clientName || !form.domain || !form.collateralType || createMutation.isPending}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                    backgroundColor: '#1e40af', color: '#f1f5f9', fontWeight: 600, fontSize: 14,
                    opacity: (!form.clientName || !form.domain || !form.collateralType) ? 0.5 : 1,
                  }}
                >
                  {createMutation.isPending ? 'Creating…' : 'Create & Open'}
                </button>
                <button
                  onClick={() => setShowNew(false)}
                  style={{
                    padding: '10px 20px', borderRadius: 8, border: '1px solid #1e293b', cursor: 'pointer',
                    backgroundColor: 'transparent', color: '#94a3b8', fontSize: 14,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Engagement List */}
        {isLoading ? (
          <div style={{ color: '#475569', fontSize: 14, padding: '32px 0', textAlign: 'center' }}>Loading…</div>
        ) : engagements.length === 0 ? (
          <div style={{
            padding: '48px 0', textAlign: 'center', color: '#475569',
            border: '1px dashed #1e293b', borderRadius: 12,
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14 }}>No engagements yet. Create your first one.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {engagements.map(eng => (
              <div
                key={eng.id}
                onClick={() => navigate(`/engagements/${eng.id}`)}
                style={{
                  padding: '16px 20px', borderRadius: 10, cursor: 'pointer',
                  backgroundColor: '#0a0f1e', border: '1px solid #1e293b',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#1e40af')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e293b')}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4, color: '#f1f5f9' }}>
                    {eng.clientName}
                  </div>
                  <div style={{ fontSize: 12, color: '#475569' }}>
                    {eng.domain} · {eng.collateralType.replace(/_/g, ' ')} · {eng.stage.replace('_', ' ')}
                  </div>
                  {eng.currentBlocker && (
                    <div style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>
                      ⚠️ {eng.currentBlocker}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                  <StatusBadge status={eng.status} />
                  <span style={{ fontSize: 11, color: '#334155' }}>{timeSince(eng.updatedAt)}</span>
                  <span style={{ color: '#334155' }}>›</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #1e293b',
  backgroundColor: '#030712', color: '#f1f5f9', fontSize: 13, boxSizing: 'border-box',
  outline: 'none',
}

const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', color: '#475569',
  fontSize: 13, padding: 0,
}
