import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Avatar, Icon, ICONS, Pill, type Tone } from '../../components/ui'

const FACTS: { k: string; v: string; dot?: string }[] = [
  { k: 'Deal value', v: '$2.40M' }, { k: 'Stage', v: 'Proposal' }, { k: 'Probability', v: '60%' }, { k: 'Priority', v: 'High', dot: '#e8b05c' },
  { k: 'Presales owner', v: 'Priya Nair' }, { k: 'Health', v: 'At risk · 1 overdue', dot: '#e8b05c' }, { k: 'Proposal due', v: '2 Dec 2026' }, { k: 'Decision', v: '12 Dec 2026' },
]
const LIFECYCLE = ['Opportunity', 'Discovery', 'Requirements', 'Solution', 'Estimation', 'Pricing', 'Proposal', 'Review', 'Submission', 'Handoff']
const CURRENT_STEP = 6
const TABS = [
  { id: 'overview', label: 'Overview' }, { id: 'discovery', label: 'Discovery & Requirements', count: 71 }, { id: 'architecture', label: 'Solution Architecture' },
  { id: 'estimations', label: 'Estimations', count: 3 }, { id: 'commercials', label: 'Commercials' }, { id: 'proposals', label: 'Proposals', count: 4 },
  { id: 'tasks', label: 'Tasks', count: 9 }, { id: 'documents', label: 'Documents', count: 14 }, { id: 'activity', label: 'Activity' },
]
const MODULES: Record<string, { title: string; to?: string; desc: string; stats: [string, string][] }> = {
  discovery: { title: 'Discovery & Requirements', to: '/requirements', desc: '71 requirements extracted from the RFP and 3 discovery workshops. AI suggestions stay separate until a person verifies them.', stats: [['Verified', '64'], ['AI suggestions pending', '7'], ['Open questions', '5'], ['Linked to solution', '58']] },
  architecture: { title: 'Solution Architecture', desc: 'Target architecture v2 is in review with the client CTO office. 4 architecture decisions recorded.', stats: [['Current version', 'v2'], ['Components', '23'], ['Decisions (ADRs)', '4'], ['Open technical risks', '2']] },
  estimations: { title: 'Estimations', to: '/estimations', desc: 'Estimation v3 was approved on 14 Nov. A scenario with an extended data-migration phase is in draft.', stats: [['Approved effort', '11,460 h'], ['Blended rate', '$98/h'], ['Contingency', '12%'], ['Versions', '3']] },
  commercials: { title: 'Commercials', desc: 'Fixed price for build phases, T&M for hypercare. Discount request pending Finance review.', stats: [['Proposal value', '$2.40M'], ['Target margin', '32%'], ['Requested discount', '5%'], ['Payment milestones', '6']] },
  proposals: { title: 'Proposals', to: '/proposals', desc: 'Proposal v4 drafting. 7 of 12 sections complete; 3 sections include AI-drafted content awaiting review.', stats: [['Sections drafted', '7 / 12'], ['Open comments', '11'], ['AI drafts to review', '3'], ['Versions', '4']] },
  activity: { title: 'Activity', desc: 'Full history of changes, decisions and AI runs for this opportunity.', stats: [['Events this week', '42'], ['Decisions', '6'], ['Agent runs', '9'], ['Contributors', '7']] },
}
const STREAMS: { name: string; detail: string; pct: number; owner: string; status: string; tone: Tone; to?: string }[] = [
  { name: 'Requirements', detail: '64 of 71 verified', pct: 90, owner: 'Sara Lindqvist', status: '7 to review', tone: 'warning', to: '/requirements' },
  { name: 'Solution architecture', detail: 'v2 · 23 components', pct: 80, owner: 'Daniel Okafor', status: 'In review', tone: 'accent' },
  { name: 'Effort estimation', detail: 'v3 · 11,460 h', pct: 100, owner: 'Arjun Mehta', status: 'Approved', tone: 'success', to: '/estimations' },
  { name: 'Commercials', detail: 'Discount pending', pct: 55, owner: 'Finance', status: 'Draft', tone: 'neutral' },
  { name: 'Proposal', detail: '7 of 12 sections', pct: 58, owner: 'Priya Nair', status: 'Drafting', tone: 'accent', to: '/proposals' },
]
const RISKS: { title: string; mit: string; sev: string; tone: Tone; src: string; owner: string }[] = [
  { title: 'Data migration window is shorter than RFP volumes suggest', mit: 'Mitigation: propose rehearsal cutovers in phase 2', sev: 'High', tone: 'danger', src: 'Human', owner: 'Daniel Okafor' },
  { title: 'Security questionnaire is 1 day overdue', mit: 'Mitigation: split remaining 76 answers across 3 SMEs', sev: 'Medium', tone: 'warning', src: 'Human', owner: 'Sara Lindqvist' },
  { title: 'Two integration requirements conflict on message format', mit: 'Suggested: raise as clarification question to client', sev: 'Medium', tone: 'warning', src: 'AI · unverified', owner: 'Unassigned' },
]
const STAKE: { name: string; role: string; tag: string; tone: Tone }[] = [
  { name: 'Anand Rao', role: 'Chief Information Officer', tag: 'Decision maker', tone: 'accent' }, { name: 'Helen Cho', role: 'Head of Digital Banking', tag: 'Champion', tone: 'success' },
  { name: 'Marcus Webb', role: 'Procurement Lead', tag: 'Evaluator', tone: 'neutral' }, { name: 'Lina Ortiz', role: 'Enterprise Architect', tag: 'Evaluator', tone: 'neutral' },
]
const TEAM = [['Priya Nair', 'Presales lead'], ['Daniel Okafor', 'Solution architect'], ['Sara Lindqvist', 'Business analyst'], ['Arjun Mehta', 'Estimation'], ['Meera Iyer', 'Delivery manager']]
const MILES: { mon: string; day: string; title: string; sub: string; color: string }[] = [
  { mon: 'Nov', day: '20', title: 'Security questionnaire', sub: '1 day overdue', color: 'var(--danger)' }, { mon: 'Nov', day: '26', title: 'Internal proposal review', sub: 'Priya Nair, Finance, Delivery', color: 'var(--fg-3)' },
  { mon: 'Dec', day: '02', title: 'Proposal submission', sub: 'Client portal, 17:00 SGT', color: 'var(--warning)' }, { mon: 'Dec', day: '09', title: 'Client presentation', sub: '90 min, on-site', color: 'var(--fg-3)' },
]
const INSIGHTS = [
  { text: 'RFP §4.3 requires 99.95% availability, but the current architecture draft assumes a single-region deployment.', src: 'RFP §4.3, Architecture v2', action: 'Create risk' },
  { text: 'Proposal timeline (14 months) does not include the 6-week parallel-run period stated in the client’s discovery notes.', src: 'Workshop 2 notes', action: 'Open in proposal' },
  { text: '3 similar past proposals priced data migration 18–25% higher per account than estimate v3.', src: 'Knowledge Base · 3 proposals', action: 'Compare' },
]
const TASKS = [
  { id: 1, title: 'Finish security questionnaire (76 left)', owner: 'Sara Lindqvist', due: 'Overdue', color: 'var(--danger)', done: false },
  { id: 2, title: 'Validate migration volumes with client DBA', owner: 'Daniel Okafor', due: 'Nov 21', color: 'var(--fg-3)', done: false },
  { id: 3, title: 'Draft executive summary', owner: 'Priya Nair', due: 'Nov 24', color: 'var(--fg-3)', done: false },
  { id: 4, title: 'Confirm rate card for offshore QA', owner: 'Arjun Mehta', due: 'Nov 24', color: 'var(--fg-3)', done: false },
  { id: 5, title: 'Book client presentation room', owner: 'Meera Iyer', due: 'Done', color: 'var(--fg-3)', done: true },
]
const DOCS: { name: string; ext: string; meta: string; by: string; status: string; tone: Tone }[] = [
  { name: 'Meridian_CoreBanking_RFP.pdf', ext: 'PDF', meta: '64 pages · uploaded 4 Nov', by: 'Priya Nair', status: 'Source', tone: 'neutral' },
  { name: 'Discovery workshop 2 notes', ext: 'DOC', meta: 'Edited 2 days ago', by: 'Sara Lindqvist', status: 'Verified', tone: 'success' },
  { name: 'Target architecture v2', ext: 'ARC', meta: '23 components', by: 'Daniel Okafor', status: 'In review', tone: 'accent' },
  { name: 'Estimation v3.xlsx', ext: 'XLS', meta: 'Approved 14 Nov', by: 'Arjun Mehta', status: 'Approved', tone: 'success' },
  { name: 'Security questionnaire.xlsx', ext: 'XLS', meta: '42 of 118 answered', by: 'Sara Lindqvist', status: 'In progress', tone: 'warning' },
]

function Section({ id, title, action, children }: { id: string; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="col" style={{ gap: 10 }}>
      <div className="row between"><h2 id={id} style={{ fontSize: 15, fontWeight: 600 }}>{title}</h2>{action}</div>
      {children}
    </section>
  )
}

export default function EngagementPage() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState('overview')
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())
  const [done, setDone] = useState<Set<number>>(new Set(TASKS.filter((t) => t.done).map((t) => t.id)))
  const mod = MODULES[tab]
  const label = TABS.find((t) => t.id === tab)!.label
  const insights = INSIGHTS.filter((_, i) => !dismissed.has(i))

  return (
    <>
      <header className="col" style={{ padding: '20px 32px 0', gap: 16, borderBottom: '1px solid var(--line)' }}>
        <div className="row between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div className="row" style={{ alignItems: 'flex-start', gap: 14, minWidth: 0 }}>
            <span aria-hidden="true" style={{ width: 40, height: 40, flex: 'none', borderRadius: 9, border: '1px solid var(--line-3)', background: '#141417', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: 'var(--fg-2)' }}>MB</span>
            <div className="col" style={{ gap: 6, minWidth: 0 }}>
              <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>Core Banking Modernization</h1>
              <div className="row-wrap muted" style={{ gap: '6px 14px' }}>
                <span style={{ color: 'var(--fg-2)' }}>Meridian Bank</span><span>Banking · APAC</span><span className="num" title={`Route id: ${id}`}>OPP-2026-0142</span>
              </div>
            </div>
          </div>
          <div className="row-wrap">
            <button type="button" className="btn hv">Share</button>
            <Link to="/approvals" className="btn btn-light hv">Request approval</Link>
            <button type="button" className="btn hv" aria-label="More actions" style={{ width: 32, padding: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
            </button>
          </div>
        </div>

        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '12px 24px' }}>
          {FACTS.map((f) => (
            <div key={f.k} className="col" style={{ gap: 4, minWidth: 0 }}>
              <dt className="muted" style={{ fontSize: 12 }}>{f.k}</dt>
              <dd className="row num" style={{ margin: 0, gap: 6, fontWeight: 500, whiteSpace: 'nowrap' }}>
                {f.dot && <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: f.dot }} />}{f.v}
              </dd>
            </div>
          ))}
        </dl>

        <ol aria-label="Presales lifecycle" style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
          {LIFECYCLE.map((n, i) => (
            <li key={n} aria-current={i === CURRENT_STEP ? 'step' : undefined} className="col" style={{ flex: '1 0 92px', gap: 6 }}>
              <span aria-hidden="true" style={{ display: 'block', height: 3, borderRadius: 2, background: i < CURRENT_STEP ? '#5b5fe8' : i === CURRENT_STEP ? '#a5a8fa' : '#232327' }} />
              <span style={{ fontSize: 11.5, whiteSpace: 'nowrap', ...(i === CURRENT_STEP ? { color: 'var(--fg)', fontWeight: 500 } : { color: i < CURRENT_STEP ? 'var(--fg-2)' : 'var(--fg-3)' }) }}>{n}</span>
            </li>
          ))}
        </ol>

        <div className="tabs" role="tablist" aria-label="Opportunity sections" style={{ borderBottom: 0 }}>
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}{t.count && <span className="muted num" style={{ fontSize: 11 }}>{t.count}</span>}
            </button>
          ))}
        </div>
      </header>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <main role="tabpanel" aria-label={label} className="col" style={{ flex: '999 1 560px', minWidth: 0, padding: '24px 32px 40px', gap: 28 }}>
          {tab === 'overview' && (
            <>
              <Section id="ws-h" title="Workstreams">
                <div className="panel">
                  {STREAMS.map((s) => {
                    const row = (
                      <>
                        <span style={{ fontWeight: 500 }}>{s.name}</span>
                        <span className="row" style={{ gap: 10, minWidth: 0 }}>
                          <span aria-hidden="true" style={{ flex: 1, maxWidth: 220, height: 4, borderRadius: 2, background: '#1f1f24', overflow: 'hidden' }}>
                            <span style={{ display: 'block', height: '100%', width: `${s.pct}%`, background: s.pct === 100 ? '#34b27b' : '#7c7ff5' }} />
                          </span>
                          <span className="muted num" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{s.detail}</span>
                        </span>
                        <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{s.owner}</span>
                        <span><Pill tone={s.tone}>{s.status}</Pill></span>
                        <Icon d={ICONS.chevRight} style={{ color: s.to ? 'var(--fg-4)' : 'transparent' }} />
                      </>
                    )
                    const style = { display: 'grid', gridTemplateColumns: 'minmax(140px,190px) minmax(0,1fr) 120px 110px 16px', gap: 16, alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #18181b', color: 'var(--fg)' } as const
                    return s.to ? <Link key={s.name} to={s.to} className="rw" style={style}>{row}</Link> : <div key={s.name} style={style}>{row}</div>
                  })}
                </div>
              </Section>

              <section aria-labelledby="sum-h" className="col" style={{ gap: 8, maxWidth: 760 }}>
                <h2 id="sum-h" style={{ fontSize: 15, fontWeight: 600 }}>Deal summary</h2>
                <p style={{ color: 'var(--fg-2)', fontSize: 14, lineHeight: 1.6 }}>Meridian Bank is replacing its 20-year-old core banking system for retail deposits and lending across 3 markets. The RFP asks for a phased migration with zero-downtime cutover, a cloud-hosted target platform, and a 14-month delivery window starting Q1 2027.</p>
                <p className="muted">Evaluation weights (from RFP §6.2): technical 40%, commercial 35%, delivery approach 25%.</p>
              </section>

              <Section id="risk-h" title="Open risks" action={<button type="button" className="btn btn-sm hv">Add risk</button>}>
                <div className="table-wrap">
                  <table style={{ minWidth: 640 }}>
                    <thead><tr>{['Risk', 'Severity', 'Source', 'Owner'].map((h) => <th key={h} scope="col" style={{ padding: '9px 16px' }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {RISKS.map((r) => (
                        <tr key={r.title} className="rw">
                          <td style={{ padding: '10px 16px' }}><div style={{ fontWeight: 500 }}>{r.title}</div><div className="muted" style={{ fontSize: 12 }}>{r.mit}</div></td>
                          <td style={{ padding: '10px 16px' }}><Pill tone={r.tone}>{r.sev}</Pill></td>
                          <td style={{ padding: '10px 16px' }}>{r.src === 'Human' ? <span className="muted" style={{ fontSize: 12 }}>Human</span> : <Pill tone="accent" ai>{r.src}</Pill>}</td>
                          <td style={{ padding: '10px 16px', color: 'var(--fg-2)', whiteSpace: 'nowrap' }}>{r.owner}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>

              <Section id="sh-h" title="Client stakeholders">
                <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                  {STAKE.map((p) => (
                    <li key={p.name} className="row" style={{ gap: 10, padding: '12px 14px', background: 'var(--bg-2)' }}>
                      <Avatar name={p.name} size={28} />
                      <span className="col" style={{ minWidth: 0 }}><span style={{ fontWeight: 500 }}>{p.name}</span><span className="muted" style={{ fontSize: 12 }}>{p.role}</span></span>
                      <span style={{ marginLeft: 'auto' }}><Pill tone={p.tone}>{p.tag}</Pill></span>
                    </li>
                  ))}
                </ul>
              </Section>
            </>
          )}

          {mod && (
            <section className="col" style={{ gap: 16, maxWidth: 820 }}>
              <div className="row between" style={{ flexWrap: 'wrap', gap: 12 }}>
                <h2 className="h2">{mod.title}</h2>
                {mod.to && <Link to={mod.to} className="btn btn-sm hv" style={{ color: 'var(--fg)' }}>Open full workspace<Icon d="M7 17L17 7M8 7h9v9" stroke={2} /></Link>}
              </div>
              <p className="muted">{mod.desc}</p>
              <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                {mod.stats.map(([k, v]) => (
                  <div key={k} style={{ padding: '14px 16px', borderRight: '1px solid var(--line)', marginRight: -1, background: 'var(--bg-2)' }}>
                    <dt className="muted" style={{ fontSize: 12 }}>{k}</dt>
                    <dd className="num" style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 600 }}>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {tab === 'tasks' && (
            <Section id="tasks-h" title="Tasks" action={<button type="button" className="btn btn-sm hv">New task</button>}>
              <ul style={{ borderTop: '1px solid var(--line)' }}>
                {TASKS.map((t) => (
                  <li key={t.id} className="rw row" style={{ gap: 12, padding: '10px 8px', borderBottom: '1px solid var(--line)' }}>
                    <input type="checkbox" checked={done.has(t.id)} onChange={() => setDone((s) => { const n = new Set(s); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n })} aria-label={`Mark "${t.title}" complete`} />
                    <span style={{ flex: 1, minWidth: 0, ...(done.has(t.id) ? { color: 'var(--fg-3)', textDecoration: 'line-through' } : {}) }}>{t.title}</span>
                    <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{t.owner}</span>
                    <span className="num" style={{ fontSize: 12, width: 64, textAlign: 'right', color: t.color }}>{t.due}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {tab === 'documents' && (
            <Section id="docs-h" title="Documents" action={<button type="button" className="btn btn-sm hv">Upload</button>}>
              <ul style={{ borderTop: '1px solid var(--line)' }}>
                {DOCS.map((d) => (
                  <li key={d.name} className="rw" style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) 120px 100px', gap: 12, alignItems: 'center', padding: '10px 8px', borderBottom: '1px solid var(--line)' }}>
                    <span aria-hidden="true" className="mono" style={{ width: 28, height: 28, borderRadius: 6, background: '#141417', border: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--fg-3)' }}>{d.ext}</span>
                    <span style={{ minWidth: 0 }}><span style={{ fontWeight: 500 }}>{d.name}</span><span className="muted" style={{ display: 'block', fontSize: 12 }}>{d.meta}</span></span>
                    <span className="muted" style={{ fontSize: 12 }}>{d.by}</span>
                    <span><Pill tone={d.tone}>{d.status}</Pill></span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </main>

        <aside aria-label="Context panel" className="col" style={{ flex: '1 1 300px', maxWidth: 360, minWidth: 0, padding: '24px 24px 40px', borderLeft: '1px solid var(--line)', gap: 28 }}>
          <section aria-labelledby="ai-h" className="col" style={{ gap: 10 }}>
            <div className="row" style={{ gap: 8 }}>
              <Icon d={ICONS.sparkle} style={{ color: 'var(--accent-fg)' }} />
              <h2 id="ai-h" style={{ fontSize: 13, fontWeight: 600 }}>AI insights</h2>
              <span className="muted" style={{ fontSize: 11, marginLeft: 'auto' }}>Unverified · {insights.length}</span>
            </div>
            {insights.map((i) => (
              <article key={i.text} className="col" style={{ gap: 8, padding: 12, border: '1px solid #26264a', borderRadius: 10, background: '#0f0f1a' }}>
                <p style={{ color: '#e4e4e7' }}>{i.text}</p>
                <p className="muted" style={{ fontSize: 12 }}>Sources: {i.src}</p>
                <div className="row" style={{ gap: 6 }}>
                  <button type="button" className="btn btn-sm hv" style={{ height: 26, borderColor: '#2e3070' }}>{i.action}</button>
                  <button type="button" className="btn btn-sm btn-ghost hv" style={{ height: 26 }} onClick={() => setDismissed((s) => new Set(s).add(INSIGHTS.indexOf(i)))}>Dismiss</button>
                </div>
              </article>
            ))}
            {insights.length === 0 && <p className="muted">No open insights.</p>}
          </section>

          <section aria-labelledby="ms-h" className="col" style={{ gap: 10 }}>
            <h2 id="ms-h" style={{ fontSize: 13, fontWeight: 600 }}>Upcoming milestones</h2>
            <ol className="col" style={{ gap: 12 }}>
              {MILES.map((m) => (
                <li key={m.title} style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr)', gap: 10, alignItems: 'start' }}>
                  <span className="col" style={{ alignItems: 'center', padding: '4px 0', border: '1px solid var(--line-2)', borderRadius: 7, background: 'var(--bg-3)', lineHeight: 1.1 }}>
                    <span className="muted" style={{ fontSize: 10, textTransform: 'uppercase' }}>{m.mon}</span><span className="num" style={{ fontSize: 15, fontWeight: 600 }}>{m.day}</span>
                  </span>
                  <span className="col" style={{ gap: 2 }}><span style={{ fontWeight: 500 }}>{m.title}</span><span style={{ fontSize: 12, color: m.color }}>{m.sub}</span></span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="co-h" className="col" style={{ gap: 10 }}>
            <div className="row between"><h2 id="co-h" style={{ fontSize: 13, fontWeight: 600 }}>Team</h2><button type="button" className="btn btn-sm btn-ghost hv" style={{ height: 26, color: 'var(--accent-fg)' }}>Assign</button></div>
            <ul className="col" style={{ gap: 10 }}>
              {TEAM.map(([n, r]) => <li key={n} className="row" style={{ gap: 10 }}><Avatar name={n} size={24} /><span style={{ flex: 1, minWidth: 0 }}>{n}</span><span className="muted" style={{ fontSize: 12 }}>{r}</span></li>)}
            </ul>
          </section>
        </aside>
      </div>
    </>
  )
}
