import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon, ICONS, Pill } from '../../components/ui'

const RATES: Record<string, number> = { 'Solution Architect': 140, 'Senior Engineer': 110, Engineer: 85, 'UX Designer': 95, 'Business Analyst': 90, 'QA Engineer': 70, 'DevOps Engineer': 115, 'Project Manager': 120 }
const QA_ROLES = new Set(['QA Engineer'])
const MGMT_ROLES = new Set(['Business Analyst', 'Project Manager'])
type Cx = 'Low' | 'Medium' | 'High'
interface Task { id: string; name: string; role: string; cx: Cx; h: number; note: string; was?: number }
interface WorkPackage { code: string; name: string; cont: number; note: string; tasks: Task[] }

const WPS: WorkPackage[] = [
  { code: 'WP1', name: 'Discovery & design', cont: 5, note: 'Fixed-scope workshops', tasks: [
    { id: 't1', name: 'Requirements workshops', role: 'Business Analyst', cx: 'Medium', h: 80, note: '3 workshops + write-up' },
    { id: 't2', name: 'Solution design', role: 'Solution Architect', cx: 'High', h: 120, note: 'Includes integration patterns' },
    { id: 't3', name: 'UX design for intake portal', role: 'UX Designer', cx: 'Medium', h: 100, note: '' }] },
  { code: 'WP2', name: 'Claims intake', cont: 12, note: 'OCR vendor dependency', tasks: [
    { id: 't4', name: 'Intake API', role: 'Senior Engineer', cx: 'Medium', h: 160, note: '' },
    { id: 't5', name: 'Document OCR integration', role: 'Senior Engineer', cx: 'High', h: 200, note: 'Vendor sandbox assumed by sprint 2' },
    { id: 't6', name: 'Intake UI', role: 'Engineer', cx: 'Medium', h: 180, note: '' }] },
  { code: 'WP3', name: 'Rules & adjudication', cont: 15, note: 'Rule count capped at 40', tasks: [
    { id: 't7', name: 'Rules engine configuration', role: 'Senior Engineer', cx: 'High', h: 220, note: '' },
    { id: 't8', name: 'Adjudication workflow', role: 'Engineer', cx: 'High', h: 200, note: '' }] },
  { code: 'WP4', name: 'Quality & release', cont: 10, note: '', tasks: [
    { id: 't9', name: 'Test automation', role: 'QA Engineer', cx: 'Medium', h: 240, note: '+120 h vs v2 for regression scope', was: 120 },
    { id: 't10', name: 'Performance testing', role: 'QA Engineer', cx: 'High', h: 80, note: '' },
    { id: 't11', name: 'CI/CD & environments', role: 'DevOps Engineer', cx: 'Medium', h: 100, note: '' }] },
  { code: 'WP5', name: 'Project management', cont: 0, note: '', tasks: [
    { id: 't12', name: 'Delivery management', role: 'Project Manager', cx: 'Low', h: 160, note: '~10% of build effort' }] },
]
const INFRA = 38000
const SAVED_MARGIN = 31
const CX_COLOR: Record<Cx, string> = { Low: 'var(--fg-3)', Medium: 'var(--fg-2)', High: 'var(--warning)' }
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const hrs = (n: number) => Math.round(n).toLocaleString('en-US')

type Base = 'v2' | 'saved' | 'offshore'
const BASES: Record<Base, { label: string; short: string; price: number | null }> = {
  v2: { label: 'v2 (approved 28 Oct)', short: 'vs v2', price: 336036 },
  saved: { label: 'v3 as saved', short: 'vs saved', price: null },
  offshore: { label: 'Offshore QA scenario', short: 'vs Offshore QA', price: 332950 },
}
const HISTORY = [
  { delta: '+120 h', what: 'Test automation (regression scope)', who: 'Arjun Mehta · 3 h ago', worse: true },
  { delta: '−40 h', what: 'Intake UI (reuse design system)', who: 'Arjun Mehta · 3 h ago', worse: false },
  { delta: '+3 pts', what: 'WP3 contingency raised to 15%', who: 'Daniel Okafor · yesterday', worse: true },
]

/** Pure pricing model so the page and the "saved" baseline share one calculation. */
function compute(hours: Record<string, number>, marginPct: number) {
  let dev = 0, qa = 0, mgmt = 0, cont = 0, total = 0
  const wps = WPS.map((w) => {
    let wh = 0, wc = 0
    w.tasks.forEach((t) => {
      const h = hours[t.id] ?? t.h
      const cost = h * RATES[t.role]
      wh += h; wc += cost
      if (QA_ROLES.has(t.role)) qa += cost
      else if (MGMT_ROLES.has(t.role)) mgmt += cost
      else dev += cost
    })
    const wcont = (wc * w.cont) / 100
    cont += wcont; total += wh
    return { code: w.code, hours: wh, cost: wc, cont: wcont }
  })
  const cost = dev + qa + mgmt + cont + INFRA
  const price = cost / (1 - marginPct / 100)
  return { wps, dev, qa, mgmt, cont, total, cost, price, margin: price - cost }
}

export default function EstimationPage() {
  const [hours, setHours] = useState<Record<string, number>>({})
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const [margin, setMargin] = useState(SAVED_MARGIN)
  const [base, setBase] = useState<Base>('v2')

  const m = useMemo(() => compute(hours, margin), [hours, margin])
  const savedPrice = useMemo(() => compute({}, SAVED_MARGIN).price, [])
  const edits = WPS.flatMap((w) => w.tasks).filter((t) => hours[t.id] != null && hours[t.id] !== t.h).map((t) => ({ delta: `${hours[t.id] - t.h > 0 ? '+' : '−'}${Math.abs(hours[t.id] - t.h)} h`, what: t.name, who: 'You · unsaved', worse: hours[t.id] - t.h > 0 }))
  const dirty = edits.length > 0 || margin !== SAVED_MARGIN
  const basePrice = base === 'saved' ? savedPrice : BASES[base].price!
  const diff = m.price - basePrice
  const pct = (diff / basePrice) * 100
  const baseLabel = BASES[base].label
  const deltaColor = Math.abs(diff) < 1 ? 'var(--fg-3)' : diff > 0 ? 'var(--warning)' : 'var(--success)'
  const needsFinance = margin < 25

  const summary: { k: string; v: string; strong?: boolean; color?: string }[] = [
    { k: 'Total effort', v: `${hrs(m.total)} h` }, { k: 'Development', v: usd(m.dev) }, { k: 'QA', v: usd(m.qa) }, { k: 'Analysis & management', v: usd(m.mgmt) },
    { k: 'Infrastructure', v: usd(INFRA) }, { k: 'Contingency', v: usd(m.cont) }, { k: 'Total cost', v: usd(m.cost), strong: true },
    { k: `Margin (${margin}%)`, v: usd(m.margin), color: needsFinance ? 'var(--danger)' : 'var(--success)' },
  ]

  return (
    <>
      <div className="row between" style={{ padding: '20px 32px 16px', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, borderBottom: '1px solid var(--line)' }}>
        <div className="col" style={{ gap: 6 }}>
          <div className="row-wrap" style={{ gap: 10 }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>Estimate v3</h1>
            <Pill tone="accent">In review</Pill>
            {dirty && <Pill tone="warning"><span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: 'currentColor' }} />Unsaved changes</Pill>}
          </div>
          <p className="muted">Harbor Mutual · Based on 52 approved requirements · Rate card APAC 2026 Q4 · Last saved by Arjun Mehta, 3 h ago</p>
        </div>
        <div className="row-wrap">
          <div className="seg" role="group" aria-label="Compare scenario">
            {(Object.keys(BASES) as Base[]).map((b) => <button key={b} type="button" aria-pressed={base === b} onClick={() => setBase(b)}>{BASES[b].short}</button>)}
          </div>
          <button type="button" className="btn hv">Import CSV</button>
          <button type="button" className="btn hv">Export .xlsx</button>
          <Link to="/approvals" className="btn btn-primary">Request approval</Link>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <main className="col" style={{ flex: '999 1 640px', minWidth: 0, padding: '20px 24px 40px 32px', gap: 14 }}>
          <div className="table-wrap">
            <table className="num" style={{ minWidth: 920 }}>
              <caption className="sr-only">Effort estimate by work package and task</caption>
              <thead>
                <tr>
                  {['Work package / task', 'Role', 'Complexity', 'Hours', 'Rate', 'Cost', 'Contingency', 'Notes'].map((h, i) => (
                    <th key={h} scope="col" style={{ padding: '9px 12px', textAlign: i >= 3 && i <= 6 ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              {WPS.map((w, wi) => {
                const open = !closed[w.code]
                const t = m.wps[wi]
                return (
                  <tbody key={w.code}>
                    <tr style={{ background: '#101013' }}>
                      <th scope="rowgroup" colSpan={3} style={{ padding: '8px 12px 8px 8px', background: 'transparent' }}>
                        <button type="button" className="hv" aria-expanded={open} onClick={() => setClosed((c) => ({ ...c, [w.code]: !c[w.code] }))} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 6px', border: 0, borderRadius: 6, background: 'transparent', fontWeight: 600, color: 'var(--fg)' }}>
                          <Icon d={ICONS.chevDown} size={12} stroke={2.2} style={{ transition: 'transform .15s', transform: `rotate(${open ? 0 : -90}deg)` }} />
                          <span className="mono muted" style={{ fontSize: 11, fontWeight: 500 }}>{w.code}</span>{w.name}
                        </button>
                      </th>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>{hrs(t.hours)} h</td>
                      <td />
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>{usd(t.cost)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--fg-2)' }}>{usd(t.cont)}</td>
                      <td className="muted" style={{ padding: '8px 14px 8px 12px', fontSize: 12 }}>{w.note}</td>
                    </tr>
                    {open && w.tasks.map((task) => {
                      const h = hours[task.id] ?? task.h
                      const userChanged = hours[task.id] != null && hours[task.id] !== task.h
                      return (
                        <tr key={task.id}>
                          <td style={{ padding: '6px 12px 6px 44px' }}>{task.name}</td>
                          <td style={{ padding: '6px 12px', color: 'var(--fg-2)', whiteSpace: 'nowrap' }}>{task.role}</td>
                          <td style={{ padding: '6px 12px', fontSize: 12, color: CX_COLOR[task.cx] }}>{task.cx}</td>
                          <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                            <span className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                              {(userChanged || task.was != null) && <span title={userChanged ? `Edited from ${task.h} h (unsaved)` : `Changed from ${task.was} h in v2`} style={{ width: 6, height: 6, borderRadius: 999, background: '#e8b05c' }} />}
                              <input type="number" min={0} step={4} value={h} aria-label={`Hours for ${task.name}`} className="cell"
                                onChange={(e) => { const v = Math.max(0, parseInt(e.target.value, 10) || 0); setHours((x) => ({ ...x, [task.id]: v })) }}
                                style={{ width: 64, height: 26, padding: '0 6px', border: '1px solid transparent', borderRadius: 5, background: 'transparent', textAlign: 'right' }} />
                            </span>
                          </td>
                          <td className="muted" style={{ padding: '6px 12px', textAlign: 'right' }}>${RATES[task.role]}</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right' }}>{usd(h * RATES[task.role])}</td>
                          <td className="muted" style={{ padding: '6px 12px', textAlign: 'right' }}>{w.cont}%</td>
                          <td className="muted" style={{ padding: '6px 14px 6px 12px', fontSize: 12, maxWidth: 220 }}>{task.note}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                )
              })}
              <tbody>
                <tr>
                  <td colSpan={3} style={{ padding: '10px 14px', color: 'var(--fg-2)' }}>Infrastructure (non-labour) · cloud environments, 6 months</td>
                  <td className="muted" style={{ padding: '10px 12px', textAlign: 'right' }}>—</td><td />
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>{usd(INFRA)}</td>
                  <td className="muted" style={{ padding: '10px 12px', textAlign: 'right' }}>0%</td>
                  <td className="muted" style={{ padding: '10px 14px 10px 12px', fontSize: 12 }}>Client hosts production</td>
                </tr>
              </tbody>
            </table>
          </div>

          <section aria-labelledby="as-h" className="col" style={{ gap: 8, marginTop: 12 }}>
            <h2 id="as-h" style={{ fontSize: 15, fontWeight: 600 }}>Assumptions</h2>
            <ol className="col" style={{ paddingLeft: 18, color: 'var(--fg-2)', gap: 4, listStyle: 'decimal' }}>
              <li>Client provides OCR vendor sandbox access by sprint 2. <span className="muted">Source: REQ-118</span></li>
              <li>Maximum 40 adjudication rules in phase 1; additional rules estimated separately. <span className="muted">Source: workshop 3</span></li>
              <li>UAT is run by the client; vendor supports with 1 QA engineer. <span className="muted">Source: RFP §7.1</span></li>
            </ol>
          </section>
        </main>

        <aside aria-label="Estimate summary" style={{ flex: '1 1 300px', maxWidth: 360, minWidth: 0, padding: '20px 32px 40px 8px', position: 'sticky', top: 56, alignSelf: 'flex-start' }}>
          <div className="panel" style={{ borderRadius: 12, overflow: 'hidden' }}>
            <div className="col" style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)', gap: 4 }}>
              <span className="muted" style={{ fontSize: 12 }}>Proposal value</span>
              <span className="num" aria-live="polite" style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}>{usd(m.price)}</span>
              <span className="num" style={{ fontSize: 12, color: deltaColor }}>
                {Math.abs(diff) < 1 ? 'No change' : `${diff > 0 ? '+' : '−'}${usd(Math.abs(diff))} (${diff > 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%)`} vs {baseLabel}
              </span>
            </div>
            <dl className="col num" style={{ margin: 0, padding: '8px 18px' }}>
              {summary.map((s) => (
                <div key={s.k} className="row between" style={{ gap: 12, padding: s.strong ? '10px 0 7px' : '7px 0', ...(s.strong ? { borderTop: '1px solid var(--line)', marginTop: 4 } : {}) }}>
                  <dt className="muted">{s.k}</dt><dd style={{ margin: 0, fontWeight: s.strong ? 600 : 500, color: s.color }}>{s.v}</dd>
                </div>
              ))}
            </dl>
            <div className="col" style={{ padding: '12px 18px 16px', borderTop: '1px solid var(--line)', gap: 8 }}>
              <label htmlFor="margin" className="row between muted" style={{ fontSize: 12 }}><span>Target margin</span><span className="num" style={{ color: 'var(--fg)', fontWeight: 500 }}>{margin}%</span></label>
              <input id="margin" type="range" min={15} max={45} step={1} value={margin} onChange={(e) => setMargin(parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: '#7c7ff5' }} />
              <span style={{ fontSize: 12, color: needsFinance ? 'var(--danger)' : 'var(--fg-3)' }}>{needsFinance ? 'Below 25%: Finance approval required.' : 'Below 25% requires Finance approval.'}</span>
            </div>
          </div>

          <section aria-labelledby="ch-h" className="col" style={{ marginTop: 20, gap: 10 }}>
            <h2 id="ch-h" style={{ fontSize: 13, fontWeight: 600 }}>Changes since {baseLabel}</h2>
            <ol className="col" style={{ gap: 10 }}>
              {[...edits, ...HISTORY].map((c, i) => (
                <li key={i} className="col" style={{ gap: 2, paddingLeft: 10, borderLeft: '2px solid var(--line-3)' }}>
                  <span className="num"><span style={{ fontWeight: 600, color: c.worse ? 'var(--warning)' : 'var(--success)' }}>{c.delta}</span> {c.what}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{c.who}</span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </>
  )
}
