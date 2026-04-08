import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { engagementsApi, adminApi, RoleType, KBEntryType } from '../../services/api'
import { StatusBadge } from '../../components/StatusBadge'

type AdminTab = 'engagements' | 'users' | 'kb' | 'config' | 'email' | 'templates'

const ALL_ROLES: RoleType[] = ['AM', 'DM', 'SALES_HEAD', 'REVIEWER', 'ADMIN']

const KB_TYPES: KBEntryType[] = ['PROJECT', 'CAPABILITY', 'CASE_STUDY', 'TEAM_PROFILE', 'DIFFERENTIATOR', 'WEDGE_OFFERING', 'MARKETING_ASSET']

const CONFIG_DESCRIPTIONS: Record<string, string> = {
  gate_reminder_hours:          'Hours before sending gate reminder (default: 24)',
  min_reviewer_count:           'Minimum reviewers required to approve a gate',
  compliance_variance_threshold:'Score variance threshold before flagging for manual review',
  max_gate_reminders:           'Max reminder emails per gate before going quiet',
  sow_max_revision_cycles:      'Max AI revision cycles per SOW section',
}

export default function AdminPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<AdminTab>('engagements')

  if (!user?.roles.includes('ADMIN')) {
    return (
      <div style={centeredPage}>
        <div style={{ color: '#f87171', fontSize: 14 }}>Access denied. Admin role required.</div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={{
        padding: '14px 32px', borderBottom: '1px solid #0f172a',
        backgroundColor: '#0a0f1e', display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <button onClick={() => navigate('/dashboard')} style={linkBtn}>← Dashboard</button>
        <span style={{ fontWeight: 700, fontSize: 16, color: '#f1f5f9' }}>🛠 Admin Panel</span>
      </div>

      {/* Tab bar */}
      <div style={{ padding: '0 32px', borderBottom: '1px solid #0f172a', display: 'flex' }}>
        {([
          ['engagements', 'Engagements'],
          ['users',       'Users & Roles'],
          ['kb',          'Knowledge Base'],
          ['config',      'System Config'],
          ['email',       'Email'],
          ['templates',   'SOW Templates'],
        ] as [AdminTab, string][]).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            color: activeTab === tab ? '#60a5fa' : '#475569',
            borderBottom: activeTab === tab ? '2px solid #1e40af' : '2px solid transparent',
          }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
        {activeTab === 'engagements' && <EngagementsTab navigate={navigate} />}
        {activeTab === 'users'       && <UsersTab queryClient={queryClient} />}
        {activeTab === 'kb'          && <KBTab queryClient={queryClient} />}
        {activeTab === 'config'      && <ConfigTab queryClient={queryClient} />}
        {activeTab === 'email'       && <EmailTab currentUser={user} />}
        {activeTab === 'templates'   && <TemplatesTab queryClient={queryClient} />}
      </div>
    </div>
  )
}

// ── Engagements Tab ───────────────────────────────────────────────────────────

function EngagementsTab({ navigate }: { navigate: (path: string) => void }) {
  const { data: engagements = [], isLoading } = useQuery({
    queryKey: ['engagements'],
    queryFn: engagementsApi.list,
  })

  if (isLoading) return <Loading />

  const stats = {
    total:     engagements.length,
    active:    engagements.filter(e => !['DELIVERED', 'CANCELLED'].includes(e.status)).length,
    blocked:   engagements.filter(e => e.status === 'BLOCKED').length,
    delivered: engagements.filter(e => e.status === 'DELIVERED').length,
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total',     value: stats.total,     color: '#60a5fa' },
          { label: 'Active',    value: stats.active,    color: '#34d399' },
          { label: 'Blocked',   value: stats.blocked,   color: '#f87171' },
          { label: 'Delivered', value: stats.delivered, color: '#86efac' },
        ].map(s => (
          <div key={s.label} style={{ padding: 20, borderRadius: 12, backgroundColor: '#0a0f1e', border: '1px solid #1e293b' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <SectionTitle>All Engagements</SectionTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse', borderRadius: 10, overflow: 'hidden', border: '1px solid #1e293b' }}>
        <thead>
          <tr style={{ backgroundColor: '#0d1526' }}>
            {['Client', 'Domain', 'Type', 'Stage', 'Status', 'Updated'].map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {engagements.map((eng, i) => (
            <tr key={eng.id} onClick={() => navigate(`/engagements/${eng.id}`)}
              style={{ borderTop: '1px solid #0f172a', cursor: 'pointer', backgroundColor: i % 2 === 0 ? '#0a0f1e' : '#080c18' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0f1a2e')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? '#0a0f1e' : '#080c18')}
            >
              <td style={{ ...tdStyle, fontWeight: 600, color: '#f1f5f9' }}>{eng.clientName}</td>
              <td style={tdStyle}>{eng.domain}</td>
              <td style={{ ...tdStyle, fontSize: 11 }}>{eng.collateralType.replace(/_/g, ' ')}</td>
              <td style={tdStyle}>{eng.stage.replace('_', ' ')}</td>
              <td style={tdStyle}><StatusBadge status={eng.status} /></td>
              <td style={{ ...tdStyle, color: '#334155', fontSize: 11 }}>{new Date(eng.updatedAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

function UsersTab({ queryClient }: { queryClient: ReturnType<typeof useQueryClient> }) {
  const { data: users = [], isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: adminApi.listUsers })

  const assignMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: RoleType }) => adminApi.assignRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const revokeMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: RoleType }) => adminApi.revokeRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  if (isLoading) return <Loading />

  return (
    <div>
      <SectionTitle>Users & Roles</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {users.map(u => (
          <div key={u.id} style={{ padding: '14px 18px', borderRadius: 10, backgroundColor: '#0a0f1e', border: '1px solid #1e293b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              {u.avatarUrl
                ? <img src={u.avatarUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                : <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#64748b' }}>
                    {u.name[0]}
                  </div>
              }
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#f1f5f9' }}>{u.name}</div>
                <div style={{ fontSize: 12, color: '#475569' }}>{u.email}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ALL_ROLES.map(role => {
                const hasRole = u.roles.includes(role)
                return (
                  <button
                    key={role}
                    onClick={() => hasRole
                      ? revokeMutation.mutate({ userId: u.id, role })
                      : assignMutation.mutate({ userId: u.id, role })
                    }
                    style={{
                      padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 600,
                      backgroundColor: hasRole ? '#1e40af' : '#1e293b',
                      color: hasRole ? '#93c5fd' : '#475569',
                      transition: 'all 0.15s',
                    }}
                  >
                    {hasRole ? '✓ ' : '+ '}{role}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Knowledge Base Tab ────────────────────────────────────────────────────────

function KBTab({ queryClient }: { queryClient: ReturnType<typeof useQueryClient> }) {
  const [search, setSearch]   = useState('')
  const [typeFilter, setType] = useState<KBEntryType | ''>('')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm]       = useState({ type: '' as KBEntryType, title: '', content: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['admin-kb', search, typeFilter],
    queryFn:  () => adminApi.listKB({ search: search || undefined, type: typeFilter || undefined, active: true }),
  })

  const createMutation = useMutation({
    mutationFn: () => adminApi.createKB({ type: form.type, title: form.title, content: form.content }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-kb'] }); setShowNew(false); setForm({ type: '' as KBEntryType, title: '', content: '' }) },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => adminApi.updateKB(id, { isActive: active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-kb'] }),
  })

  const entries = data?.data ?? []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <SectionTitle>Knowledge Base</SectionTitle>
        <button onClick={() => setShowNew(true)} style={primaryBtnStyle}>+ New Entry</button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ ...inputStyle, flex: 1 }} />
        <select value={typeFilter} onChange={e => setType(e.target.value as KBEntryType | '')} style={{ ...inputStyle, width: 180 }}>
          <option value="">All types</option>
          {KB_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {showNew && (
        <Modal title="New KB Entry" onClose={() => setShowNew(false)}>
          <Field label="Type">
            <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as KBEntryType }))} style={inputStyle}>
              <option value="">Select type…</option>
              {KB_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </Field>
          <Field label="Title">
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Entry title" style={inputStyle} />
          </Field>
          <Field label="Content">
            <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} rows={6} placeholder="Full content…" style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={() => createMutation.mutate()} disabled={!form.type || !form.title || !form.content || createMutation.isPending} style={primaryBtnStyle}>
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setShowNew(false)} style={ghostBtnStyle}>Cancel</button>
          </div>
        </Modal>
      )}

      {isLoading ? <Loading /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.length === 0 && <div style={{ color: '#475569', fontSize: 13 }}>No entries found.</div>}
          {entries.map(e => (
            <div key={e.id} style={{ padding: '12px 16px', borderRadius: 10, backgroundColor: '#0a0f1e', border: '1px solid #1e293b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', marginRight: 8, textTransform: 'uppercase' }}>{e.type}</span>
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#f1f5f9' }}>{e.title}</span>
                </div>
                <button onClick={() => toggleMutation.mutate({ id: e.id, active: !e.isActive })}
                  style={{ ...ghostBtnStyle, fontSize: 11, color: e.isActive ? '#f87171' : '#34d399' }}>
                  {e.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 6, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {e.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {data && data.pagination.totalPages > 1 && (
        <div style={{ color: '#475569', fontSize: 12, marginTop: 12, textAlign: 'center' }}>
          {data.pagination.total} total entries
        </div>
      )}
    </div>
  )
}

// ── Config Tab ────────────────────────────────────────────────────────────────

function ConfigTab({ queryClient }: { queryClient: ReturnType<typeof useQueryClient> }) {
  const [editKey, setEditKey] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')

  const { data: configs = [], isLoading } = useQuery({ queryKey: ['admin-config'], queryFn: adminApi.listConfig })

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => adminApi.updateConfig(key, value),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-config'] }); setEditKey(null) },
  })

  if (isLoading) return <Loading />

  return (
    <div>
      <SectionTitle>System Configuration</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {configs.map(cfg => (
          <div key={cfg.key} style={{ padding: '14px 16px', borderRadius: 10, backgroundColor: '#0a0f1e', border: '1px solid #1e293b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9', marginBottom: 3 }}>{cfg.key}</div>
                <div style={{ fontSize: 11, color: '#475569' }}>{CONFIG_DESCRIPTIONS[cfg.key] ?? ''}</div>
              </div>
              {editKey === cfg.key ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    style={{ ...inputStyle, width: 120 }}
                    autoFocus
                    onKeyDown={e => e.key === 'Escape' && setEditKey(null)}
                  />
                  <button onClick={() => updateMutation.mutate({ key: cfg.key, value: editVal })} style={primaryBtnStyle}>
                    {updateMutation.isPending ? '…' : 'Save'}
                  </button>
                  <button onClick={() => setEditKey(null)} style={ghostBtnStyle}>Cancel</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#60a5fa' }}>{cfg.value}</span>
                  <button onClick={() => { setEditKey(cfg.key); setEditVal(cfg.value) }} style={ghostBtnStyle}>Edit</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {configs.length === 0 && <div style={{ color: '#475569', fontSize: 13 }}>No config values in database yet.</div>}
      </div>
    </div>
  )
}

// ── Email Tab ─────────────────────────────────────────────────────────────────

function EmailTab({ currentUser }: { currentUser: { email: string } | null }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleTest = async () => {
    setStatus('sending')
    try {
      const res = await adminApi.testEmail()
      setStatus('ok')
      setMessage(res.message)
    } catch (e: unknown) {
      setStatus('error')
      setMessage((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Test email failed')
    }
  }

  return (
    <div>
      <SectionTitle>Email Configuration</SectionTitle>
      <div style={{ padding: 20, borderRadius: 10, backgroundColor: '#0a0f1e', border: '1px solid #1e293b', maxWidth: 480 }}>
        <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16, lineHeight: 1.6 }}>
          SMTP credentials are configured via environment variables (<code style={{ fontSize: 11, color: '#60a5fa' }}>EMAIL_SMTP_*</code>).
          Use the test button to verify delivery is working.
        </div>
        <div style={{ fontSize: 12, color: '#475569', marginBottom: 20 }}>
          Test email will be sent to: <strong style={{ color: '#94a3b8' }}>{currentUser?.email}</strong>
        </div>
        <button onClick={handleTest} disabled={status === 'sending'} style={primaryBtnStyle}>
          {status === 'sending' ? 'Sending…' : '✉ Send Test Email'}
        </button>
        {status === 'ok' && (
          <div style={{ marginTop: 12, fontSize: 12, color: '#34d399' }}>✅ {message}</div>
        )}
        {status === 'error' && (
          <div style={{ marginTop: 12, fontSize: 12, color: '#f87171' }}>❌ {message}</div>
        )}
      </div>
    </div>
  )
}

// ── SOW Templates Tab ─────────────────────────────────────────────────────────

function TemplatesTab({ queryClient }: { queryClient: ReturnType<typeof useQueryClient> }) {
  const [file, setFile]         = useState<File | null>(null)
  const [name, setName]         = useState('')
  const [isDefault, setDefault] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const { data: templates = [], isLoading } = useQuery({ queryKey: ['admin-templates'], queryFn: adminApi.listTemplates })

  const setDefaultMutation = useMutation({
    mutationFn: (key: string) => adminApi.setDefaultTemplate(key.replace('sow_template_', '')),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-templates'] }),
  })

  const handleUpload = async () => {
    if (!file || !name) return
    setUploading(true)
    setUploadError('')
    try {
      await adminApi.uploadTemplate(file, name, isDefault)
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] })
      setFile(null); setName(''); setDefault(false)
    } catch (e: unknown) {
      setUploadError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Upload failed')
    } finally {
      setUploading(false) }
  }

  return (
    <div>
      <SectionTitle>SOW Templates</SectionTitle>

      {/* Upload form */}
      <div style={{ padding: 20, borderRadius: 10, backgroundColor: '#0a0f1e', border: '1px solid #1e293b', maxWidth: 480, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 16 }}>Upload New Template (.docx)</div>
        <Field label="Template Name">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standard SOW v3" style={inputStyle} />
        </Field>
        <Field label="File">
          <input type="file" accept=".docx" onChange={e => setFile(e.target.files?.[0] ?? null)}
            style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }} />
        </Field>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8', margin: '12px 0 16px', cursor: 'pointer' }}>
          <input type="checkbox" checked={isDefault} onChange={e => setDefault(e.target.checked)} />
          Set as default template
        </label>
        {uploadError && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 10 }}>{uploadError}</div>}
        <button onClick={handleUpload} disabled={!file || !name || uploading} style={primaryBtnStyle}>
          {uploading ? 'Uploading…' : '⬆ Upload Template'}
        </button>
      </div>

      {/* Existing templates */}
      <SectionTitle>Existing Templates</SectionTitle>
      {isLoading ? <Loading /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {templates.length === 0 && <div style={{ color: '#475569', fontSize: 13 }}>No templates uploaded yet.</div>}
          {templates.map(t => (
            <div key={t.key} style={{ padding: '12px 16px', borderRadius: 10, backgroundColor: '#0a0f1e', border: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9' }}>{t.name}</span>
                {t.isDefault && <span style={{ marginLeft: 10, fontSize: 10, color: '#34d399', fontWeight: 700 }}>● DEFAULT</span>}
                <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                  Uploaded {new Date(t.uploadedAt).toLocaleDateString()}
                </div>
              </div>
              {!t.isDefault && (
                <button onClick={() => setDefaultMutation.mutate(t.key)} style={ghostBtnStyle}>
                  Set as default
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' }}>
      {children}
    </h2>
  )
}

function Loading() {
  return <div style={{ color: '#475569', fontSize: 13, padding: '12px 0' }}>Loading…</div>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ backgroundColor: '#0a0f1e', borderRadius: 16, padding: 28, width: 520, border: '1px solid #1e293b', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ ...ghostBtnStyle, fontSize: 18 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', flexDirection: 'column',
  backgroundColor: '#030712', fontFamily: 'system-ui, sans-serif', color: '#f9fafb',
}

const centeredPage: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  backgroundColor: '#030712', fontFamily: 'system-ui, sans-serif', color: '#f9fafb',
}

const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: 13, padding: 0,
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 7, border: 'none', cursor: 'pointer',
  backgroundColor: '#1e40af', color: '#f1f5f9', fontWeight: 600, fontSize: 13,
}

const ghostBtnStyle: React.CSSProperties = {
  padding: '6px 14px', borderRadius: 7, border: '1px solid #1e293b', cursor: 'pointer',
  backgroundColor: 'transparent', color: '#94a3b8', fontSize: 12,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #1e293b',
  backgroundColor: '#030712', color: '#f1f5f9', fontSize: 13, boxSizing: 'border-box', outline: 'none',
}

const thStyle: React.CSSProperties = {
  padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em',
}

const tdStyle: React.CSSProperties = { padding: '11px 16px', fontSize: 13, color: '#94a3b8' }
