/**
 * Admin page — basic ops panel (Sprint 8 will expand this significantly)
 */
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { engagementsApi } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import { StatusBadge } from '../../components/StatusBadge'

export default function AdminPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const { data: engagements = [], isLoading: engLoading } = useQuery({
    queryKey: ['engagements'],
    queryFn: engagementsApi.list,
  })

  if (!user?.roles.includes('ADMIN')) {
    return (
      <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#f87171', fontSize: 14 }}>Access denied. Admin role required.</div>
      </div>
    )
  }

  const stats = {
    total:       engagements.length,
    active:      engagements.filter(e => !['DELIVERED', 'CANCELLED'].includes(e.status)).length,
    blocked:     engagements.filter(e => e.status === 'BLOCKED').length,
    delivered:   engagements.filter(e => e.status === 'DELIVERED').length,
  }

  return (
    <div style={pageStyle}>
      <div style={{
        padding: '14px 32px', borderBottom: '1px solid #0f172a',
        backgroundColor: '#0a0f1e', display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <button onClick={() => navigate('/dashboard')} style={linkBtn}>← Dashboard</button>
        <span style={{ fontWeight: 700, fontSize: 16, color: '#f1f5f9' }}>Admin Panel</span>
      </div>

      <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'Total',     value: stats.total,     color: '#60a5fa' },
            { label: 'Active',    value: stats.active,    color: '#34d399' },
            { label: 'Blocked',   value: stats.blocked,   color: '#f87171' },
            { label: 'Delivered', value: stats.delivered, color: '#86efac' },
          ].map(s => (
            <div key={s.label} style={{
              padding: 20, borderRadius: 12,
              backgroundColor: '#0a0f1e', border: '1px solid #1e293b',
            }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* All engagements table */}
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#94a3b8', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          All Engagements
        </h2>
        {engLoading && (
          <div style={{ color: '#475569', fontSize: 13, padding: '16px 0' }}>Loading engagements…</div>
        )}
        <div style={{ borderRadius: 10, border: '1px solid #1e293b', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#0d1526' }}>
                {['Client', 'Domain', 'Type', 'Stage', 'Status', 'Updated'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {engagements.map((eng, i) => (
                <tr
                  key={eng.id}
                  onClick={() => navigate(`/engagements/${eng.id}`)}
                  style={{
                    borderTop: '1px solid #0f172a', cursor: 'pointer',
                    backgroundColor: i % 2 === 0 ? '#0a0f1e' : '#080c18',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0f1a2e')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? '#0a0f1e' : '#080c18')}
                >
                  <td style={td}><span style={{ fontWeight: 600, color: '#f1f5f9' }}>{eng.clientName}</span></td>
                  <td style={td}>{eng.domain}</td>
                  <td style={{ ...td, fontSize: 11 }}>{eng.collateralType.replace(/_/g, ' ')}</td>
                  <td style={td}>{eng.stage.replace('_', ' ')}</td>
                  <td style={td}><StatusBadge status={eng.status} /></td>
                  <td style={{ ...td, color: '#334155', fontSize: 11 }}>
                    {new Date(eng.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh', backgroundColor: '#030712',
  fontFamily: 'system-ui, sans-serif', color: '#f9fafb',
}

const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#475569', fontSize: 13, padding: 0,
}

const td: React.CSSProperties = {
  padding: '11px 16px', fontSize: 13, color: '#94a3b8',
}
