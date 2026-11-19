import { Link, useLocation } from 'react-router-dom'
import { Icon, ICONS } from '../ui'
import { CRUMBS } from './nav'

export default function Topbar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { pathname } = useLocation()
  const crumb = [...CRUMBS].sort((a, b) => b.prefix.length - a.prefix.length).find((c) => pathname.startsWith(c.prefix)) ?? CRUMBS[0]
  const current = crumb.sub ?? crumb.page

  return (
    <header className="topbar">
      <nav aria-label="Breadcrumb" className="crumbs">
        <ol className="crumbs" style={{ margin: 0 }}>
          <li className="muted">{crumb.section}</li>
          <li aria-hidden="true" className="sep">/</li>
          {crumb.sub && (
            <>
              <li className="muted">{crumb.page}</li>
              <li aria-hidden="true" className="sep">/</li>
            </>
          )}
          <li aria-current="page" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>{current}</li>
        </ol>
      </nav>
      <button type="button" className="search-btn hv" onClick={onOpenPalette} aria-label="Search or run a command (Command K)">
        <Icon d={ICONS.search} />
        <span style={{ flex: 1 }}>Search or jump to…</span>
        <kbd className="kbd">⌘K</kbd>
      </button>
      <span title="Screens are populated from sample data, not a live backend" className="pill" style={{ height: 24, border: '1px dashed #3f3f46', background: 'transparent', color: 'var(--fg-3)', gap: 6 }}>
        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: '#e8b05c' }} />Sample data
      </span>
      <Link to="/copilot" className="btn hv" style={{ color: 'var(--fg-2)', borderColor: 'var(--line-2)', padding: '0 10px' }}>
        <Icon d={ICONS.sparkle} stroke={1.75} style={{ color: 'var(--accent-fg)' }} />Ask Copilot
      </Link>
      <button type="button" className="hv" aria-label="Notifications, 3 unread" style={{ position: 'relative', width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 0, borderRadius: 8, background: 'transparent', color: 'var(--fg-2)' }}>
        <Icon size={16} d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" />
        <span aria-hidden="true" style={{ position: 'absolute', top: 7, right: 8, width: 7, height: 7, borderRadius: 999, background: '#7c7ff5', boxShadow: '0 0 0 2px var(--bg)' }} />
      </button>
      <Link to="/opportunities" className="btn btn-primary" style={{ borderColor: 'var(--accent)' }}>
        <Icon d={ICONS.plus} stroke={2} />New opportunity
      </Link>
    </header>
  )
}
