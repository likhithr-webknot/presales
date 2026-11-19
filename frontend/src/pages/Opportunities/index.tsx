import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon, ICONS, Avatar } from '../../components/ui'
import { moneyK, initials } from '../../lib/format'
import { OPPORTUNITIES, STAGES, type Opportunity, type Priority, type Stage } from '../../mocks/opportunities'

type SortKey = 'name' | 'client' | 'value' | 'stage' | 'priority' | 'prob' | 'owner' | 'close' | 'last'
const COLS: { k: SortKey; l: string; right?: boolean }[] = [
  { k: 'name', l: 'Opportunity' }, { k: 'client', l: 'Client' }, { k: 'value', l: 'Deal value', right: true }, { k: 'stage', l: 'Stage' },
  { k: 'priority', l: 'Priority' }, { k: 'prob', l: 'Probability' }, { k: 'owner', l: 'Presales owner' }, { k: 'close', l: 'Expected close' }, { k: 'last', l: 'Last activity' },
]
const SORT_FIELD: Record<SortKey, (o: Opportunity) => string | number> = {
  name: (o) => o.name, client: (o) => o.client, value: (o) => o.value, stage: (o) => STAGES.indexOf(o.stage), priority: (o) => PRIO_RANK[o.priority],
  prob: (o) => o.prob, owner: (o) => o.owner, close: (o) => o.closeSort, last: (o) => o.lastMinutes,
}
const PRIO_RANK: Record<Priority, number> = { Urgent: 4, High: 3, Medium: 2, Low: 1 }
const PRIO_COLOR: Record<Priority, string> = { Urgent: 'var(--danger)', High: 'var(--warning)', Medium: 'var(--fg-2)', Low: 'var(--fg-3)' }
const STAGE_TONE: Record<Stage, string> = {
  'Lead qualification': '', Discovery: '', Solutioning: 'pill-accent', Estimation: 'pill-accent', Proposal: 'pill-warning', Negotiation: 'pill-success', Won: 'pill-success', Lost: 'pill-danger',
}
const VIEWS = [
  { id: 'all', label: 'All active', f: () => true },
  { id: 'mine', label: 'My opportunities', f: (o: Opportunity) => o.owner === 'Priya Nair' },
  { id: 'quarter', label: 'Closing this quarter', f: (o: Opportunity) => o.closeSort < 20261231 },
  { id: 'risk', label: 'At risk', f: (o: Opportunity) => o.lastMinutes > 2000 },
]
const TEXT_ASC = new Set<SortKey>(['name', 'client', 'owner'])

export default function OpportunitiesPage() {
  const [q, setQ] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('value')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [compact, setCompact] = useState(false)
  const [view, setView] = useState('all')
  const [stages, setStages] = useState<Record<number, Stage>>({})

  const rows = useMemo(() => {
    const vf = VIEWS.find((v) => v.id === view)!.f
    const term = q.trim().toLowerCase()
    const get = SORT_FIELD[sortKey]
    return OPPORTUNITIES.map((o) => ({ ...o, stage: stages[o.id] ?? o.stage }))
      .filter(vf)
      .filter((o) => !term || `${o.name} ${o.client} ${o.owner}`.toLowerCase().includes(term))
      .sort((a, b) => {
        const x = get(a), y = get(b)
        const r = x < y ? -1 : x > y ? 1 : 0
        return dir === 'asc' ? r : -r
      })
  }, [q, sortKey, dir, view, stages])

  const allChecked = rows.length > 0 && rows.every((o) => sel.has(o.id))
  const pad = compact ? '6px 12px' : '11px 12px'
  const toggle = (id: number) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const sortBy = (k: SortKey) => {
    if (k === sortKey) setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(k); setDir(TEXT_ASC.has(k) ? 'asc' : 'desc') }
  }

  return (
    <main className="page">
      <div className="row between" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div className="col" style={{ gap: 4 }}>
          <h1 className="h1">Opportunities</h1>
          <p className="muted num">38 active · $12.4M unweighted · $4.9M weighted by probability</p>
        </div>
        <div className="row-wrap">
          <button type="button" className="btn hv"><Icon d={ICONS.download} />Export</button>
          <button type="button" className="btn btn-primary"><Icon d={ICONS.plus} stroke={2} />New opportunity</button>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Saved views">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)}>
            {v.label}<span className="muted num" style={{ fontSize: 11 }}>{OPPORTUNITIES.filter(v.f).length}</span>
          </button>
        ))}
      </div>

      <div className="row-wrap">
        <label className="input" style={{ flex: '0 1 300px', minWidth: 200 }}>
          <Icon d={ICONS.search} />
          <span className="sr-only">Search opportunities</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, client, owner…" />
        </label>
        <span className="grow" />
        <div className="seg" role="group" aria-label="Row density">
          <button type="button" aria-pressed={!compact} onClick={() => setCompact(false)}>Comfortable</button>
          <button type="button" aria-pressed={compact} onClick={() => setCompact(true)}>Compact</button>
        </div>
      </div>

      {sel.size > 0 && (
        <div role="region" aria-label="Bulk actions" className="row-wrap" style={{ padding: '6px 8px 6px 14px', border: '1px solid #33357a', borderRadius: 10, background: '#12132a' }}>
          <span className="num" style={{ fontWeight: 500 }}>{sel.size} selected</span>
          <span className="grow" />
          <button type="button" className="btn btn-sm hv" style={{ borderColor: '#2e3070' }}>Assign owner</button>
          <button type="button" className="btn btn-sm hv" style={{ borderColor: '#2e3070' }}>Change stage</button>
          <button type="button" className="btn btn-sm hv" style={{ borderColor: '#2e3070' }}>Export selected</button>
          <button type="button" className="btn btn-sm btn-ghost hv" style={{ color: '#c7c9fc' }} onClick={() => setSel(new Set())}>Clear</button>
        </div>
      )}

      <div className="table-wrap">
        <table style={{ minWidth: 1080 }}>
          <caption className="sr-only">Opportunities, {rows.length} shown</caption>
          <thead>
            <tr>
              <th scope="col" style={{ width: 40, paddingLeft: 14 }}>
                <input type="checkbox" aria-label="Select all rows" checked={allChecked} onChange={() => setSel(allChecked ? new Set() : new Set(rows.map((r) => r.id)))} />
              </th>
              {COLS.map((c) => {
                const on = sortKey === c.k
                return (
                  <th key={c.k} scope="col" aria-sort={on ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} style={{ padding: '0 12px', textAlign: c.right ? 'right' : 'left' }}>
                    <button type="button" className="th-btn hv" onClick={() => sortBy(c.k)}>
                      {c.l}
                      <Icon size={12} stroke={2} d={on ? (dir === 'asc' ? 'M12 19V5M6 11l6-6 6 6' : 'M12 5v14M6 13l6 6 6-6') : 'M8 9l4-4 4 4M8 15l4 4 4-4'} style={{ color: on ? 'var(--accent-fg)' : '#52525b' }} />
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="rw" style={sel.has(o.id) ? { background: '#121326' } : undefined}>
                <td style={{ padding: pad, paddingLeft: 14 }}><input type="checkbox" aria-label={`Select ${o.name}`} checked={sel.has(o.id)} onChange={() => toggle(o.id)} /></td>
                <td style={{ padding: pad }}><Link to="/engagements/core-banking" style={{ color: 'var(--fg)', fontWeight: 500 }}>{o.name}</Link></td>
                <td style={{ padding: pad }}>
                  <span className="row" style={{ gap: 8, whiteSpace: 'nowrap' }}>
                    <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: 5, border: '1px solid var(--line-3)', background: '#141417', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: 'var(--fg-2)' }}>{initials(o.client)}</span>
                    <span style={{ color: 'var(--fg-2)' }}>{o.client}</span>
                  </span>
                </td>
                <td className="num" style={{ padding: pad, textAlign: 'right', fontWeight: 500 }}>{moneyK(o.value)}</td>
                <td style={{ padding: pad }}>
                  <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                    <span className="sr-only">Stage for {o.name}</span>
                    <select value={o.stage} onChange={(e) => setStages((s) => ({ ...s, [o.id]: e.target.value as Stage }))} className={`pill ${STAGE_TONE[o.stage]}`} style={{ appearance: 'none', WebkitAppearance: 'none', height: 22, padding: '0 22px 0 9px', border: 0, cursor: 'pointer' }}>
                      {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <Icon d="M6 9l6 6 6-6" size={10} stroke={3} style={{ position: 'absolute', right: 8, pointerEvents: 'none', color: 'var(--fg-3)' }} />
                  </label>
                </td>
                <td style={{ padding: pad }}><span style={{ color: PRIO_COLOR[o.priority], fontSize: 12 }}>{o.priority}</span></td>
                <td style={{ padding: pad }}>
                  <span className="row num" style={{ gap: 8 }}>
                    <span aria-hidden="true" style={{ width: 44, height: 4, borderRadius: 2, background: '#1f1f24', overflow: 'hidden', display: 'inline-block' }}>
                      <span style={{ display: 'block', height: '100%', width: `${o.prob}%`, background: o.prob >= 50 ? '#34b27b' : '#7c7ff5' }} />
                    </span>{o.prob}%
                  </span>
                </td>
                <td style={{ padding: pad }}><span className="row" style={{ gap: 8, whiteSpace: 'nowrap' }}><Avatar name={o.owner} />{o.owner}</span></td>
                <td className="num" style={{ padding: pad, whiteSpace: 'nowrap', color: 'var(--fg-2)' }}>{o.close}</td>
                <td className="muted" style={{ padding: pad, whiteSpace: 'nowrap' }}>{o.last}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="col" style={{ padding: '48px 24px', alignItems: 'center', gap: 8, textAlign: 'center' }}>
            <span style={{ fontWeight: 500 }}>No opportunities match “{q}”</span>
            <span className="muted">Check the spelling or clear the search to see all active opportunities.</span>
            <button type="button" className="btn btn-sm hv" onClick={() => setQ('')}>Clear search</button>
          </div>
        )}
        <div className="row between muted num" style={{ padding: '10px 14px', borderTop: '1px solid var(--line)', fontSize: 12 }}>
          <span>Showing {rows.length} of {OPPORTUNITIES.length} sample rows · sorted by {COLS.find((c) => c.k === sortKey)!.l.toLowerCase()} {dir === 'asc' ? '↑' : '↓'}</span>
        </div>
      </div>
    </main>
  )
}
