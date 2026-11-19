import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Icon, ICONS } from '../ui'
import { NAV } from './nav'
import { initials } from '../../lib/format'

export default function Sidebar() {
  const { user } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const expanded = !collapsed
  const name = user?.name ?? 'Signed-in user'

  return (
    <nav className="sidebar" aria-label="Primary" style={{ width: expanded ? 248 : 60 }}>
      <div style={{ padding: '10px 8px 6px' }}>
        <button type="button" className="sb-btn hv" aria-label="Switch workspace: Acme Presales" title="Acme Presales" style={{ width: '100%', height: 40, padding: '0 8px' }}>
          <span aria-hidden="true" className="avatar" style={{ width: 24, height: 24, borderRadius: 6, background: '#5b5fe8', color: '#fff' }}>AP</span>
          {expanded && (
            <>
              <span className="col grow" style={{ minWidth: 0, lineHeight: 1.25 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Acme Presales</span>
                <span className="muted" style={{ fontSize: 11 }}>Enterprise · 24 members</span>
              </span>
              <Icon d="M7 15l5 5 5-5M7 9l5-5 5 5" />
            </>
          )}
        </button>
      </div>
      <div style={{ padding: '0 8px 6px' }}>
        <button type="button" className="sb-btn hv muted" onClick={() => setCollapsed((c) => !c)} aria-expanded={expanded} aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'} title={expanded ? 'Collapse sidebar' : 'Expand sidebar'} style={{ width: '100%', height: 30, padding: '0 10px', borderRadius: 7, fontSize: 12, color: 'var(--fg-3)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg>
          {expanded && <span>Collapse sidebar</span>}
        </button>
      </div>

      <div className="col" style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 12px', gap: 12 }}>
        {NAV.map((sec, si) => {
          const open = !expanded || !closed[sec.id]
          return (
            <div key={sec.id} className="col" style={{ gap: 1 }}>
              {expanded ? (
                <button type="button" className="sb-group-head hv" aria-expanded={open} onClick={() => setClosed((c) => ({ ...c, [sec.id]: !c[sec.id] }))}>
                  <span>{sec.label}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transition: 'transform .15s', transform: `rotate(${open ? 0 : -90}deg)` }}><path d="M6 9l6 6 6-6" /></svg>
                </button>
              ) : (
                si > 0 && <span aria-hidden="true" style={{ height: 1, background: 'var(--line)', margin: '2px 8px 6px' }} />
              )}
              {open &&
                sec.items.map((it) => {
                  const label = it.label + (it.badge ? `, ${it.badge} pending` : '')
                  const inner = (
                    <>
                      <Icon d={it.icon} size={16} />
                      {expanded && <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</span>}
                      {it.badge && (expanded ? <span aria-hidden="true" className={`badge ${it.id === 'approvals' ? 'badge-accent' : ''}`}>{it.badge}</span> : <span aria-hidden="true" className="dot-badge" />)}
                    </>
                  )
                  const style = expanded ? undefined : { justifyContent: 'center' as const }
                  // Screens that are not designed yet render as disabled, not as dead "#" links.
                  return it.to ? (
                    <NavLink key={it.id} to={it.to} className="sb-item" aria-label={label} title={it.label} style={style} end={it.to === '/dashboard'}>
                      {inner}
                    </NavLink>
                  ) : (
                    <span key={it.id} className="sb-item" role="link" aria-disabled="true" aria-label={`${label} (coming soon)`} title={`${it.label} — coming soon`} style={style}>
                      {inner}
                    </span>
                  )
                })}
            </div>
          )
        })}
      </div>

      <div style={{ padding: 8, borderTop: '1px solid var(--line)' }}>
        <button type="button" className="sb-btn hv" aria-label={`Account menu: ${name}`} title={name} style={{ width: '100%', height: 44, padding: '0 8px' }}>
          <span aria-hidden="true" className="avatar" style={{ width: 26, height: 26, background: '#3b3f8f', fontSize: 11 }}>{initials(name)}</span>
          {expanded && (
            <>
              <span className="col grow" style={{ minWidth: 0, lineHeight: 1.25 }}>
                <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                <span className="muted" style={{ fontSize: 11 }}>{user?.roles?.[0] ?? 'Presales'}</span>
              </span>
              <Icon d={ICONS.chevDown} />
            </>
          )}
        </button>
      </div>
    </nav>
  )
}
