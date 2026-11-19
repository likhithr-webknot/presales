import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Icon, ICONS, Pill } from '../../components/ui'

type SecStatus = 'reviewed' | 'drafted' | 'ai' | 'empty'
const OUTLINE: [string, SecStatus, number][] = [
  ['Executive summary', 'reviewed', 2], ['Client understanding', 'reviewed', 0], ['Proposed solution', 'ai', 3], ['Scope of work', 'drafted', 1], ['Architecture', 'drafted', 0], ['Delivery methodology', 'ai', 0],
  ['Timeline', 'drafted', 2], ['Team composition', 'ai', 0], ['Commercial proposal', 'drafted', 3], ['Assumptions', 'empty', 0], ['Exclusions', 'empty', 0], ['Terms and conditions', 'empty', 0],
]
const DOT: Record<SecStatus, React.CSSProperties> = {
  reviewed: { background: '#4acb8f' }, drafted: { background: '#d4d4d8' }, ai: { border: '1px dashed #a5a8fa' }, empty: { border: '1px solid #52525b' },
}
const CHECK_TONE = { ok: ['rgba(52,178,123,.15)', '#4acb8f', ICONS.check], warn: ['rgba(224,160,66,.15)', '#e8b05c', 'M12 8v5M12 16h.01'], err: ['rgba(229,103,95,.15)', '#f27e76', ICONS.close] } as const
const CHECKS: { t: keyof typeof CHECK_TONE; title: string; detail: string; action?: string }[] = [
  { t: 'err', title: 'Unsupported certification claim', detail: 'Section 8 states “ISO 27017 certified delivery team”. No matching certificate in the Knowledge Base.', action: 'Show in document' },
  { t: 'warn', title: 'Timeline differs from estimate', detail: 'Timeline says 13 months; approved estimate v3 plans 14 months including hypercare.', action: 'Compare with estimate' },
  { t: 'warn', title: 'Open placeholder', detail: '1 bracketed placeholder remains in “Out of scope”.', action: 'Go to placeholder' },
  { t: 'ok', title: 'Commercials match approved estimate', detail: 'Proposal value $1.90M equals Estimate v3 at 32% margin.' },
]
const COMMENTS = [
  { who: 'Meera Iyer', when: '40 min ago', quote: 'within 12 weeks of kickoff', text: 'Delivery can commit to 12 weeks only if the client confirms ERP access in week 1. Add as an assumption?' },
  { who: 'Daniel Okafor', when: '2 h ago', quote: 'refreshed every 15 minutes', text: 'Region 3 ERP only supports hourly batch. Needs a footnote.' },
  { who: 'Finance', when: 'Yesterday', quote: 'Commercial proposal', text: 'Discount above 8% needs CFO sign-off before submission.' },
]
const ASSIST = [
  { title: 'Rewrite selected text', desc: 'Tighten for an executive reader; keeps facts and citations.', icon: ICONS.edit },
  { title: 'Insert Knowledge Base reference', desc: 'Search approved case studies and capability documents.', icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z' },
  { title: 'Check against requirements', desc: 'Lists RFP requirements this section does not address.', icon: 'M3 6l2 2 3-3M3 16l2 2 3-3M12 7h9M12 17h9' },
  { title: 'Draft “Assumptions” from estimate v3', desc: 'Uses the 9 assumptions recorded in the estimate.', icon: ICONS.sparkle },
]
type Panel = 'checks' | 'comments' | 'assist'
type AiState = 'pending' | 'accepted' | 'discarded'
const linkBtn = { border: 0, background: 'transparent', padding: 0, color: 'var(--accent-fg)', fontSize: 12 } as const

export default function ProposalPage() {
  const [sec, setSec] = useState(2)
  const [panel, setPanel] = useState<Panel>('checks')
  const [ai, setAi] = useState<AiState>('pending')
  const [track, setTrack] = useState(true)
  const drafted = OUTLINE.filter((o, i) => (i === 2 && ai === 'accepted' ? 'drafted' : o[1]) !== 'empty' && o[1] !== 'ai').length + (ai === 'accepted' ? 1 : 0)

  return (
    <>
      <div className="row-wrap" style={{ padding: '10px 20px', borderBottom: '1px solid var(--line)' }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Proposal v4</span>
        <Pill tone="warning">Due Fri, 21 Nov</Pill>
        <span className="muted" style={{ fontSize: 12 }}>Sample document · changes are not persisted</span>
        <span className="grow" />
        <button type="button" className="btn btn-sm hv" aria-pressed={track} onClick={() => setTrack((t) => !t)} style={track ? { borderColor: '#3b3e8a', background: '#16173a', color: '#e0e1fd' } : undefined}>
          <Icon d={ICONS.edit} />Track changes
        </button>
        <button type="button" className="btn btn-sm hv">Versions</button>
        <button type="button" className="btn btn-sm hv">Export PDF / DOCX</button>
        <Link to="/approvals" className="btn btn-sm btn-primary">Request approval</Link>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', flex: 1 }}>
        <nav aria-label="Proposal outline" className="col" style={{ flex: '0 1 240px', minWidth: 200, padding: '16px 10px', borderRight: '1px solid var(--line)', gap: 2 }}>
          <div className="row between muted" style={{ padding: '0 8px 8px', fontSize: 12 }}><span>Outline</span><span className="num">{drafted} / 12 drafted</span></div>
          {OUTLINE.map(([name, status, comments], i) => {
            const st = i === 2 && ai === 'accepted' ? 'drafted' : status
            const on = i === sec
            return (
              <button key={name} type="button" className="hv" aria-current={on ? 'true' : undefined} onClick={() => setSec(i)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, height: 30, padding: '0 8px', border: 0, borderRadius: 7, fontSize: 13, textAlign: 'left', background: on ? '#18181b' : 'transparent', color: on ? 'var(--fg)' : 'var(--fg-2)', fontWeight: on ? 500 : 400 }}>
                <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, flex: 'none', boxSizing: 'border-box', ...DOT[st] }} />
                <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i + 1}. {name}</span>
                {comments > 0 && <span className="muted num" style={{ fontSize: 11 }}>{comments}</span>}
              </button>
            )
          })}
          <div className="col muted" style={{ gap: 6, padding: '14px 8px 0', marginTop: 8, borderTop: '1px solid var(--line)', fontSize: 11.5 }}>
            {[['Reviewed', DOT.reviewed], ['Drafted', DOT.drafted], ['AI draft, unreviewed', DOT.ai], ['Empty', DOT.empty]].map(([l, s]) => (
              <span key={l as string} className="row" style={{ gap: 8 }}><span style={{ width: 7, height: 7, borderRadius: 999, boxSizing: 'border-box', ...(s as React.CSSProperties) }} />{l as string}</span>
            ))}
          </div>
        </nav>

        <main style={{ flex: '999 1 480px', minWidth: 0, padding: '32px 24px 56px', display: 'flex', justifyContent: 'center', background: 'var(--bg-1)' }}>
          <article aria-label="Section editor" className="col" style={{ width: '100%', maxWidth: 720, gap: 16, fontSize: 15, lineHeight: 1.7, color: '#e4e4e7' }}>
            <p className="muted" style={{ fontSize: 12 }}>Section {sec + 1} of 12 · {OUTLINE[sec][0]}</p>
            <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--fg)', lineHeight: 1.25 }}>{sec === 2 ? 'Proposed solution' : OUTLINE[sec][0]}</h1>
            {sec !== 2 ? (
              <p className="muted" style={{ fontSize: 13 }}>Sample content is only provided for section 3, Proposed solution.</p>
            ) : (
              <>
                <p>We propose a control tower that unifies shipment, inventory and carrier data from Northline’s three regional ERPs into a single operational view, with exception alerts routed to the planners who own each lane.</p>
                <p>
                  The platform is delivered in three increments. Increment 1 connects the two highest-volume regions and replaces the daily spreadsheet roll-up
                  {track ? (<><del style={{ color: 'var(--danger)' }}> within 10 weeks</del><ins style={{ color: 'var(--success)', textUnderlineOffset: 3 }}> within 12 weeks of kickoff</ins></>) : ' within 12 weeks of kickoff'}
                  , which aligns with the approved estimate.
                </p>

                {ai === 'pending' && (
                  <section aria-label="AI-generated draft awaiting review" className="col" style={{ gap: 12, padding: '16px 18px', border: '1px dashed #4b4ea8', borderRadius: 10, background: '#0f0f1c' }}>
                    <div className="row" style={{ gap: 8, fontFamily: 'var(--font)', fontSize: 12, color: 'var(--accent-fg)' }}>
                      <Icon d={ICONS.sparkle} size={13} /><span style={{ fontWeight: 500 }}>Draft by Proposal Agent · not yet reviewed</span>
                      <span className="muted" style={{ marginLeft: 'auto' }}>Generated from 3 approved sources</span>
                    </div>
                    <p>Exception management follows the pattern used in Northline’s carrier-performance pilot<sup>[1]</sup>: each alert carries the lane, the breached threshold and a suggested next action, and is acknowledged within the planner’s existing queue rather than a separate tool<sup>[2]</sup>.</p>
                    <p>Data is refreshed every 15 minutes from the regional ERPs through the integration layer described in Section 5<sup>[3]</sup>.</p>
                    <div className="row-wrap" style={{ gap: 6, fontFamily: 'var(--font)' }}>
                      <button type="button" className="btn btn-sm btn-light" onClick={() => setAi('accepted')}>Accept into section</button>
                      <button type="button" className="btn btn-sm hv" style={{ borderColor: '#2e3070' }}>Edit draft</button>
                      <button type="button" className="btn btn-sm hv" style={{ borderColor: '#2e3070' }}>Regenerate</button>
                      <button type="button" className="btn btn-sm btn-ghost hv" onClick={() => setAi('discarded')}>Discard</button>
                    </div>
                    <ol className="muted" style={{ padding: '10px 0 0 18px', borderTop: '1px solid #23234a', fontFamily: 'var(--font)', fontSize: 12, lineHeight: 1.5, listStyle: 'decimal' }}>
                      <li>Carrier performance pilot – close-out report (Knowledge Base, approved 2025)</li>
                      <li>Discovery workshop 2 notes, item 7 (verified)</li>
                      <li>Target architecture v1, integration layer (approved)</li>
                    </ol>
                  </section>
                )}
                {ai === 'accepted' && (
                  <>
                    <p style={{ paddingLeft: 12, borderLeft: '2px solid #34b27b' }}>Exception management follows the pattern used in Northline’s carrier-performance pilot: each alert carries the lane, the breached threshold and a suggested next action, and is acknowledged within the planner’s existing queue rather than a separate tool. Data is refreshed every 15 minutes from the regional ERPs through the integration layer described in Section 5.</p>
                    <p role="status" className="muted" style={{ fontFamily: 'var(--font)', fontSize: 12 }}>Accepted by you · sources kept as references · <button type="button" style={linkBtn} onClick={() => setAi('pending')}>Undo</button></p>
                  </>
                )}
                {ai === 'discarded' && <p role="status" className="muted" style={{ fontFamily: 'var(--font)', fontSize: 12 }}>AI draft discarded. <button type="button" style={linkBtn} onClick={() => setAi('pending')}>Restore</button></p>}

                <h2 style={{ margin: '12px 0 0', fontSize: 18, fontWeight: 600, color: 'var(--fg)' }}>Out of scope</h2>
                <p><mark style={{ background: 'rgba(224,160,66,.18)', color: 'inherit', borderBottom: '1px solid #e8b05c', padding: '0 1px' }}>Warehouse management system replacement</mark> and carrier contract negotiation are excluded. <span className="muted">[Confirm with client whether yard management is in scope]</span></p>
              </>
            )}
          </article>
        </main>

        <aside aria-label="Assistant panel" className="col" style={{ flex: '1 1 300px', maxWidth: 360, minWidth: 0, borderLeft: '1px solid var(--line)' }}>
          <div className="tabs" role="tablist" aria-label="Panel" style={{ padding: '0 12px' }}>
            {([['checks', 'Checks', CHECKS.length], ['comments', 'Comments', COMMENTS.length], ['assist', 'Assist', 0]] as [Panel, string, number][]).map(([id, label, n]) => (
              <button key={id} type="button" role="tab" aria-selected={panel === id} onClick={() => setPanel(id)} style={{ height: 40 }}>{label}{n > 0 && <span className="muted num" style={{ fontSize: 11 }}>{n}</span>}</button>
            ))}
          </div>
          <div role="tabpanel" className="col" style={{ padding: 16, gap: 12 }}>
            {panel === 'checks' && (
              <>
                <p className="muted" style={{ fontSize: 12 }}>Compliance Review Agent checked this version against the RFP, approved estimate and Knowledge Base 4 min ago.</p>
                {CHECKS.map((c) => (
                  <div key={c.title} className="panel row" style={{ alignItems: 'flex-start', gap: 10, padding: 12 }}>
                    <span aria-hidden="true" style={{ width: 22, height: 22, flex: 'none', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: CHECK_TONE[c.t][0], color: CHECK_TONE[c.t][1] }}><Icon d={CHECK_TONE[c.t][2]} size={12} stroke={2.4} /></span>
                    <div className="col" style={{ gap: 4, minWidth: 0 }}>
                      <span style={{ fontWeight: 500 }}>{c.title}</span>
                      <span className="muted" style={{ fontSize: 12 }}>{c.detail}</span>
                      {c.action && <button type="button" style={{ ...linkBtn, fontWeight: 500, textAlign: 'left' }}>{c.action}</button>}
                    </div>
                  </div>
                ))}
              </>
            )}
            {panel === 'comments' && COMMENTS.map((c) => (
              <div key={c.text} className="panel col" style={{ gap: 6, padding: 12 }}>
                <div className="row" style={{ gap: 8 }}><Avatar name={c.who} /><span style={{ fontWeight: 500 }}>{c.who}</span><span className="muted" style={{ fontSize: 12, marginLeft: 'auto' }}>{c.when}</span></div>
                <span className="muted" style={{ fontSize: 12, borderLeft: '2px solid var(--line-3)', paddingLeft: 8 }}>“{c.quote}”</span>
                <span style={{ color: '#e4e4e7' }}>{c.text}</span>
                <div className="row" style={{ gap: 6 }}><button type="button" className="btn btn-sm hv" style={{ height: 24 }}>Reply</button><button type="button" className="btn btn-sm btn-ghost hv" style={{ height: 24 }}>Resolve</button></div>
              </div>
            ))}
            {panel === 'assist' && (
              <>
                <p className="muted" style={{ fontSize: 12 }}>Actions run on the selected section only. Output appears as a draft for you to review.</p>
                {ASSIST.map((a) => (
                  <button key={a.title} type="button" className="panel hv" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12, textAlign: 'left' }}>
                    <Icon d={a.icon} style={{ color: 'var(--accent-fg)', marginTop: 2, flex: 'none' }} />
                    <span className="col" style={{ gap: 2 }}><span style={{ fontWeight: 500 }}>{a.title}</span><span className="muted" style={{ fontSize: 12 }}>{a.desc}</span></span>
                  </button>
                ))}
              </>
            )}
          </div>
        </aside>
      </div>
    </>
  )
}
