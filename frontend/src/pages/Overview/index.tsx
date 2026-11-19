import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Icon, ICONS, Pill, Segmented, type Tone } from '../../components/ui'
import { moneyK, sparkPoints } from '../../lib/format'
import { OPPORTUNITIES, type Stage } from '../../mocks/opportunities'
import { useAuth } from '../../hooks/useAuth'

const FUNNEL: { name: Stage; count: number; value: number }[] = [
  { name: 'Lead qualification', count: 9, value: 2.2 }, { name: 'Discovery', count: 8, value: 2.6 }, { name: 'Solutioning', count: 7, value: 2.3 },
  { name: 'Estimation', count: 6, value: 1.9 }, { name: 'Proposal', count: 5, value: 2.1 }, { name: 'Negotiation', count: 3, value: 1.3 },
]
const WON = 6, WON_VALUE = 2.8, LOST = 11
const STAGE_TONE: Record<string, Tone> = { 'Lead qualification': 'neutral', Discovery: 'neutral', Solutioning: 'accent', Estimation: 'accent', Proposal: 'warning', Negotiation: 'success' }

type KpiTone = 'up' | 'warn' | 'down'
const KPI_COLOR: Record<KpiTone, string> = { up: 'var(--success)', warn: 'var(--warning)', down: 'var(--danger)' }

const PRIORITIES: { kind: string; kt: Tone; title: string; opp: string; owner: string; due: string; dt: 'danger' | 'warning' | 'muted'; status: string; st: Tone; action: string; to: string }[] = [
  { kind: 'Approval', kt: 'accent', title: 'Estimation v3 · 1,840 h, margin 31%', opp: 'Claims Automation Platform', owner: 'Requested by Arjun Mehta', due: 'Due today', dt: 'warning', status: 'Awaiting you', st: 'accent', action: 'Review', to: '/approvals' },
  { kind: 'Overdue', kt: 'danger', title: 'Security questionnaire responses (42 of 118 answered)', opp: 'Core Banking Modernization', owner: 'Sara Lindqvist', due: '1 day overdue', dt: 'danger', status: 'In progress', st: 'neutral', action: 'Open', to: '/engagements/core-banking' },
  { kind: 'Deadline', kt: 'warning', title: 'Client submission: final proposal', opp: 'Supply Chain Control Tower', owner: 'Priya Nair', due: 'Fri, 21 Nov', dt: 'warning', status: 'In review', st: 'accent', action: 'Open proposal', to: '/proposals' },
  { kind: 'AI risk', kt: 'accent', title: '4 integration requirements have no acceptance criteria', opp: 'Patient Portal Rebuild', owner: 'Requirements Agent', due: 'Flagged 2h ago', dt: 'muted', status: 'Needs review', st: 'warning', action: 'Review', to: '/requirements' },
  { kind: 'Approval', kt: 'accent', title: 'Discount of 12% exceeds 8% threshold', opp: 'Supply Chain Control Tower', owner: 'Requested by Finance', due: 'Thu, 20 Nov', dt: 'muted', status: 'Awaiting you', st: 'accent', action: 'Review', to: '/approvals' },
  { kind: 'Review', kt: 'neutral', title: 'Target architecture v2', opp: 'Data Platform Migration', owner: 'Daniel Okafor', due: 'Sat, 22 Nov', dt: 'muted', status: 'Ready', st: 'success', action: 'Review', to: '/engagements/core-banking' },
]
const DUE_COLOR = { danger: 'var(--danger)', warning: 'var(--warning)', muted: 'var(--fg-3)' }

const ACTIVITY: { who: string; what: string; opp: string; when: string; tone: Tone; icon: string; ai?: boolean }[] = [
  { who: 'Meera Iyer', what: 'approved Proposal v4', opp: 'Field Service Mobile App', when: '18 min ago', tone: 'success', icon: ICONS.check },
  { who: 'Daniel Okafor', what: 'updated the architecture (3 components added)', opp: 'Data Platform Migration', when: '1 h ago', tone: 'neutral', icon: ICONS.edit },
  { who: 'Estimation Agent', what: 'produced a draft estimate of 1,840 h', opp: 'Claims Automation Platform', when: '2 h ago', tone: 'accent', icon: ICONS.sparkle, ai: true },
  { who: 'Arjun Mehta', what: 'revised Estimation v3 (+120 h QA)', opp: 'Claims Automation Platform', when: '3 h ago', tone: 'neutral', icon: ICONS.edit },
  { who: 'Sara Lindqvist', what: 'was assigned as Solution Architect', opp: 'Patient Portal Rebuild', when: '5 h ago', tone: 'neutral', icon: ICONS.user },
  { who: 'Daniel Okafor', what: 'uploaded RFP_Ridgeview_SIS.pdf (48 pages)', opp: 'Student Information System', when: 'Yesterday', tone: 'neutral', icon: ICONS.file },
  { who: 'Priya Nair', what: 'moved the deal to Negotiation', opp: 'Supply Chain Control Tower', when: 'Yesterday', tone: 'warning', icon: ICONS.arrowRight },
]
const DOT: Record<Tone, [string, string]> = { success: ['rgba(52,178,123,.15)', '#4acb8f'], neutral: ['#1c1c21', '#a1a1aa'], accent: ['rgba(124,127,245,.16)', '#a5a8fa'], warning: ['rgba(224,160,66,.15)', '#e8b05c'], danger: ['rgba(229,103,95,.15)', '#f27e76'] }

export default function OverviewPage() {
  const { user } = useAuth()
  const [range, setRange] = useState('30D')
  const [view, setView] = useState<'funnel' | 'board' | 'table'>('funnel')

  const activeCount = FUNNEL.reduce((a, s) => a + s.count, 0)
  const total = FUNNEL.reduce((a, s) => a + s.value, 0)
  const maxV = Math.max(...FUNNEL.map((s) => s.value))
  const kpis: { label: string; value: string; delta: string; tone: KpiTone; spark: number[]; def: string }[] = [
    { label: 'Active opportunities', value: String(activeCount), delta: '+4 vs previous 30 days', tone: 'up', spark: [30, 31, 33, 32, 34, 36, 38], def: 'Open opportunities in any stage before Won/Lost.' },
    { label: 'Total pipeline value', value: `$${total.toFixed(1)}M`, delta: '+8.2% vs previous 30 days', tone: 'up', spark: [10.6, 10.9, 11.2, 11, 11.6, 12, 12.4], def: 'Sum of deal value across active opportunities, unweighted.' },
    { label: 'Proposals in progress', value: '5', delta: '3 due within 7 days', tone: 'warn', spark: [3, 4, 4, 6, 5, 5, 5], def: 'Opportunities in the Proposal stage with an open draft.' },
    { label: 'Pending approvals', value: '4', delta: '2 waiting more than 48h', tone: 'down', spark: [2, 3, 2, 5, 3, 4, 4], def: 'Approval requests assigned to you that have no decision.' },
    { label: 'Win rate', value: `${Math.round((WON / (WON + LOST)) * 100)}%`, delta: '+3 pts vs prior 90 days', tone: 'up', spark: [29, 30, 31, 30, 32, 33, 35], def: 'Won ÷ (Won + Lost), opportunities closed in the trailing 90 days.' },
    { label: 'Avg. proposal turnaround', value: '9.2 days', delta: '1.4 days faster', tone: 'up', spark: [11.8, 11.2, 10.9, 10.6, 10.1, 9.6, 9.2], def: 'Median days from RFP intake to client submission, trailing 90 days.' },
  ]
  const firstName = user?.name?.split(' ')[0]

  return (
    <main className="page page-wide">
      <section aria-labelledby="greet" className="row between" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div className="col" style={{ gap: 6, minWidth: 0 }}>
          <p className="muted" style={{ fontSize: 12 }}>{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 id="greet" style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}>{firstName ? `Welcome back, ${firstName}` : 'Welcome back'}</h1>
          <p className="muted" style={{ fontSize: 14 }}>
            You have <Link to="/approvals" style={{ color: 'var(--fg)', fontWeight: 500 }}>4 approvals awaiting review</Link> and <span style={{ color: 'var(--fg)', fontWeight: 500 }}>3 proposals due in the next 7 days</span>.
          </p>
        </div>
        <div className="row-wrap">
          <Segmented label="Date range" value={range} onChange={setRange} options={['7D', '30D', 'QTD', '12M'].map((r) => ({ id: r, label: r }))} />
          <Link to="/approvals" className="btn btn-light hv">Review approvals<Icon d={ICONS.arrowRight} stroke={2} /></Link>
        </div>
      </section>

      <section aria-label="Key metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', overflow: 'hidden' }}>
        {kpis.map((k) => (
          <div key={k.label} className="col" style={{ padding: '16px 18px', gap: 10, borderRight: '1px solid var(--line)', marginRight: -1, borderBottom: '1px solid var(--line)', marginBottom: -1 }}>
            <div className="row between">
              <span className="muted" style={{ fontSize: 12 }}>{k.label}</span>
              <span title={k.def} role="img" aria-label={`Definition: ${k.def}`} style={{ display: 'inline-flex', color: 'var(--fg-4)' }}><Icon d={ICONS.info} /></span>
            </div>
            <div className="row between" style={{ alignItems: 'flex-end' }}>
              <span className="num" style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>{k.value}</span>
              <svg width="72" height="24" viewBox="0 0 72 24" fill="none" aria-hidden="true"><polyline points={sparkPoints(k.spark)} stroke={k.tone === 'up' ? '#4acb8f' : '#71717a'} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg>
            </div>
            <span className="num" style={{ fontSize: 12, color: KPI_COLOR[k.tone] }}>{k.delta}</span>
          </div>
        ))}
      </section>

      <section aria-labelledby="pipe-h" className="col" style={{ gap: 14 }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="row" style={{ alignItems: 'baseline', gap: 10 }}>
            <h2 id="pipe-h" className="h2">Pipeline</h2>
            <span className="muted num" style={{ fontSize: 12 }}>{activeCount} active · ${total.toFixed(1)}M</span>
          </div>
          <Segmented label="Pipeline view" value={view} onChange={setView} options={[
            { id: 'funnel', label: 'Funnel', icon: ICONS.filter }, { id: 'board', label: 'Board', icon: 'M4 4h5v16H4zM10 4h5v10h-5zM16 4h4v13h-4z' }, { id: 'table', label: 'Table', icon: 'M3 5h18M3 12h18M3 19h18' },
          ]} />
        </div>

        {view === 'funnel' && (
          <div className="panel" style={{ padding: '8px 0' }}>
            {FUNNEL.map((s) => (
              <Link key={s.name} to="/opportunities" className="rw" style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,170px) minmax(0,1fr) 72px 64px', alignItems: 'center', gap: 16, padding: '9px 18px', color: 'var(--fg)' }}>
                <span style={{ color: 'var(--fg-2)' }}>{s.name}</span>
                <span style={{ height: 22, borderRadius: 5, background: '#141417', overflow: 'hidden', display: 'block' }}>
                  <span style={{ display: 'block', height: '100%', borderRadius: 5, background: '#5b5fe8', opacity: 0.45 + (0.55 * s.value) / maxV, width: `${(s.value / maxV) * 100}%` }} />
                </span>
                <span className="num" style={{ textAlign: 'right', fontWeight: 500 }}>${s.value.toFixed(1)}M</span>
                <span className="num muted" style={{ textAlign: 'right' }}>{s.count} opps</span>
              </Link>
            ))}
            <div className="row-wrap muted" style={{ gap: 20, padding: '10px 18px 4px', marginTop: 4, borderTop: '1px solid var(--line)', fontSize: 12 }}>
              <span>Closed, trailing 90 days:</span>
              <span className="row" style={{ gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#34b27b' }} />Won {WON} · ${WON_VALUE.toFixed(1)}M</span>
              <span className="row" style={{ gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#52525b' }} />Lost {LOST}</span>
            </div>
          </div>
        )}

        {view === 'board' && (
          <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(200px,1fr))', gap: 12, minWidth: 1240 }}>
              {FUNNEL.map((s) => {
                const items = OPPORTUNITIES.filter((o) => o.stage === s.name).slice(0, 2)
                return (
                  <div key={s.name} className="col panel" style={{ gap: 8, padding: 10 }}>
                    <div className="row between" style={{ padding: '0 2px 4px' }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-2)' }}>{s.name}</span>
                      <span className="muted num" style={{ fontSize: 12 }}>{s.count}</span>
                    </div>
                    {items.map((o) => (
                      <Link key={o.id} to="/engagements/core-banking" className="col hv" style={{ gap: 8, padding: 10, borderRadius: 8, border: '1px solid var(--line-2)', background: 'var(--bg-4)', color: 'var(--fg)' }}>
                        <span style={{ fontWeight: 500, lineHeight: 1.3 }}>{o.name}</span>
                        <span className="muted" style={{ fontSize: 12 }}>{o.client}</span>
                        <span className="row between"><span className="num" style={{ fontWeight: 500 }}>{moneyK(o.value)}</span><Avatar name={o.owner} /></span>
                      </Link>
                    ))}
                    {s.count > items.length && <Link to="/opportunities" className="muted" style={{ fontSize: 12, padding: '2px 4px' }}>+{s.count - items.length} more</Link>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {view === 'table' && (
          <div className="table-wrap">
            <table style={{ minWidth: 760 }}>
              <thead><tr>{['Opportunity', 'Stage', 'Value', 'Owner', 'Expected close'].map((h, i) => <th key={h} scope="col" style={{ padding: '10px 16px', textAlign: i === 2 ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
              <tbody>
                {OPPORTUNITIES.map((o) => (
                  <tr key={o.id} className="rw">
                    <td style={{ padding: '9px 16px' }}><Link to="/engagements/core-banking" style={{ color: 'var(--fg)', fontWeight: 500 }}>{o.name}</Link><div className="muted" style={{ fontSize: 12 }}>{o.client}</div></td>
                    <td style={{ padding: '9px 16px' }}><Pill tone={STAGE_TONE[o.stage] ?? 'neutral'}>{o.stage}</Pill></td>
                    <td className="num" style={{ padding: '9px 16px', textAlign: 'right' }}>{moneyK(o.value)}</td>
                    <td style={{ padding: '9px 16px' }}><span className="row" style={{ gap: 8 }}><Avatar name={o.owner} />{o.owner}</span></td>
                    <td className="num" style={{ padding: '9px 16px', color: 'var(--fg-2)' }}>{o.close}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="row" style={{ flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
        <section aria-labelledby="prio-h" className="col" style={{ flex: '2 1 560px', minWidth: 0, gap: 12 }}>
          <h2 id="prio-h" className="h2">My priorities</h2>
          <ul style={{ borderTop: '1px solid var(--line)' }}>
            {PRIORITIES.map((p) => (
              <li key={p.title} className="rw" style={{ display: 'grid', gridTemplateColumns: '92px minmax(0,1fr) auto', gap: 14, alignItems: 'center', padding: '12px 8px', borderBottom: '1px solid var(--line)' }}>
                <span><Pill tone={p.kt}>{p.kind}</Pill></span>
                <div className="col" style={{ minWidth: 0, gap: 3 }}>
                  <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</span>
                  <span className="row-wrap muted" style={{ gap: 6, fontSize: 12 }}>
                    <Link to="/engagements/core-banking" style={{ color: 'var(--fg-2)' }}>{p.opp}</Link><span aria-hidden="true">·</span><span>{p.owner}</span><span aria-hidden="true">·</span>
                    <span className="num" style={{ color: DUE_COLOR[p.dt] }}>{p.due}</span>
                  </span>
                </div>
                <div className="row" style={{ gap: 10 }}>
                  <Pill tone={p.st}>{p.status}</Pill>
                  <Link to={p.to} className="btn btn-sm hv" style={{ color: 'var(--fg)' }}>{p.action}</Link>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="act-h" className="col" style={{ flex: '1 1 320px', minWidth: 0, gap: 12 }}>
          <h2 id="act-h" className="h2">Recent activity</h2>
          <ol className="col" style={{ paddingTop: 4 }}>
            {ACTIVITY.map((a, i) => (
              <li key={i} style={{ display: 'grid', gridTemplateColumns: '24px minmax(0,1fr)', gap: 12, paddingBottom: 16 }}>
                <span className="col" style={{ alignItems: 'center', gap: 4 }}>
                  <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: DOT[a.tone][0], color: DOT[a.tone][1] }}><Icon d={a.icon} size={12} stroke={2} /></span>
                  <span aria-hidden="true" style={{ flex: 1, width: 1, background: 'var(--line)' }} />
                </span>
                <div className="col" style={{ gap: 2, minWidth: 0, paddingTop: 2 }}>
                  <span style={{ color: 'var(--fg-2)' }}><span style={{ color: 'var(--fg)', fontWeight: 500 }}>{a.who}</span> {a.what}</span>
                  <span className="row-wrap muted" style={{ gap: 6, fontSize: 12 }}>
                    <Link to="/engagements/core-banking" style={{ color: 'var(--fg-3)', textDecoration: 'underline', textDecorationColor: '#3f3f46', textUnderlineOffset: 2 }}>{a.opp}</Link><span aria-hidden="true">·</span><time>{a.when}</time>
                    {a.ai && <Pill tone="accent">AI · needs review</Pill>}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  )
}
