import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon, Pill, type Tone } from '../../components/ui'

type Filter = 'pending' | 'changes' | 'approved' | 'rejected' | 'escalated'
interface Req { id: string; f: Filter; type: string; tone: Tone; title: string; opp: string; by: string; age: string; ageColor: string }
const ALL: Req[] = [
  { id: 'a1', f: 'pending', type: 'Estimation', tone: 'accent', title: 'Estimate v3 · $345,700', opp: 'Claims Automation Platform', by: 'Arjun Mehta', age: 'Due today', ageColor: 'var(--warning)' },
  { id: 'a2', f: 'pending', type: 'Discount', tone: 'warning', title: '12% discount, above 8% threshold', opp: 'Supply Chain Control Tower', by: 'Finance', age: 'Due tomorrow', ageColor: 'var(--fg-3)' },
  { id: 'a3', f: 'pending', type: 'Proposal', tone: 'neutral', title: 'Proposal v4 for client submission', opp: 'Field Service Mobile App', by: 'Meera Iyer', age: '2 days', ageColor: 'var(--danger)' },
  { id: 'a4', f: 'pending', type: 'Architecture', tone: 'neutral', title: 'Target architecture v2', opp: 'Data Platform Migration', by: 'Daniel Okafor', age: '3 days', ageColor: 'var(--danger)' },
  { id: 'a5', f: 'changes', type: 'Estimation', tone: 'accent', title: 'Treasury Analytics estimate v1', opp: 'Treasury Analytics', by: 'Meera Iyer', age: '4 days', ageColor: 'var(--fg-3)' },
  { id: 'a6', f: 'approved', type: 'Proposal', tone: 'neutral', title: 'Proposal v3', opp: 'Core Banking Modernization', by: 'Priya Nair', age: '12 Nov', ageColor: 'var(--fg-3)' },
  { id: 'a7', f: 'escalated', type: 'Discount', tone: 'warning', title: '15% discount with extended payment terms', opp: 'Kestrel Motors', by: 'Daniel Okafor', age: 'CFO · 1 day', ageColor: 'var(--fg-3)' },
]
const FILTERS: { id: Filter; label: string }[] = [{ id: 'pending', label: 'Pending' }, { id: 'changes', label: 'Changes requested' }, { id: 'approved', label: 'Approved' }, { id: 'rejected', label: 'Rejected' }, { id: 'escalated', label: 'Escalated' }]
const DIFF = [
  { k: 'Total effort', a: '1,760 h', b: '1,840 h', c: '+80 h', w: true }, { k: 'QA effort', a: '200 h', b: '320 h', c: '+120 h', w: true },
  { k: 'Contingency', a: '$16,165', b: '$17,833', c: '+$1,668', w: true }, { k: 'Proposal value', a: '$336,036', b: '$345,700', c: '+$9,664 (+2.9%)', w: true }, { k: 'Margin', a: '31%', b: '31%', c: 'No change', w: false },
]
const HISTORY = [
  { who: 'Arjun Mehta', what: 'submitted v3 for approval', when: 'Today, 09:14', c: '#a5a8fa' },
  { who: 'You', what: 'requested changes on v2.1: “Split QA into automation and performance.”', when: '14 Nov', c: '#e8b05c' },
  { who: 'Priya Nair', what: 'approved v2', when: '28 Oct', c: '#4acb8f' },
]
type Decision = 'approve' | 'changes' | 'reject'
const DIALOGS: Record<Decision, { title: string; body: string; confirm: string; reason?: string; cls: string }> = {
  approve: { title: 'Approve this request?', body: 'The requester and the opportunity team will be notified, and this version becomes the baseline.', confirm: 'Approve', cls: 'btn btn-light' },
  changes: { title: 'Request changes', body: 'The request returns to the requester. The previous approved version stays the baseline.', confirm: 'Send request', reason: 'What should change?', cls: 'btn btn-primary' },
  reject: { title: 'Reject this request?', body: 'Rejection closes this request. The requester must submit a new version to continue.', confirm: 'Reject', reason: 'Reason for rejection', cls: 'btn' },
}

export default function ApprovalsInboxPage() {
  const [filter, setFilter] = useState<Filter>('pending')
  const [sel, setSel] = useState(0)
  const [dlg, setDlg] = useState<Decision | null>(null)
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const [notice, setNotice] = useState('')
  const reasonRef = useRef<HTMLTextAreaElement>(null)
  const list = ALL.filter((a) => a.f === filter)
  const cur = list[Math.min(sel, list.length - 1)]
  const d = dlg ? DIALOGS[dlg] : null
  const invalid = tried && !!d?.reason && !reason.trim()

  useEffect(() => { if (dlg) reasonRef.current?.focus() }, [dlg])

  const open = (k: Decision) => { setDlg(k); setReason(''); setTried(false) }
  const confirm = () => {
    if (d?.reason && !reason.trim()) { setTried(true); return }
    setNotice('Sample data: this decision was not saved. With a backend, the request would move to ' + (dlg === 'approve' ? 'Approved' : dlg === 'reject' ? 'Rejected' : 'Changes requested') + ' once the server confirms.')
    setDlg(null)
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', flex: 1 }}>
      <section aria-label="Approval requests" className="col" style={{ flex: '1 1 320px', maxWidth: 400, minWidth: 0, borderRight: '1px solid var(--line)' }}>
        <div className="col" style={{ padding: '16px 16px 0', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>Approvals</h1>
          <div className="tabs" role="tablist" aria-label="Approval status">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} onClick={() => { setFilter(f.id); setSel(0) }} style={{ height: 34, fontSize: 12 }}>
                {f.label}<span className="muted num" style={{ fontSize: 11 }}>{ALL.filter((a) => a.f === f.id).length}</span>
              </button>
            ))}
          </div>
        </div>
        <ul className="col" style={{ padding: 6, gap: 2 }}>
          {list.map((a, i) => (
            <li key={a.id}>
              <button type="button" className="hv col" aria-current={cur?.id === a.id ? 'true' : undefined} onClick={() => setSel(i)}
                style={{ width: '100%', gap: 6, padding: 12, borderRadius: 8, textAlign: 'left', border: `1px solid ${cur?.id === a.id ? '#2e3070' : 'transparent'}`, background: cur?.id === a.id ? '#111226' : 'transparent' }}>
                <span className="row"><Pill tone={a.tone}>{a.type}</Pill><span className="num" style={{ marginLeft: 'auto', fontSize: 12, color: a.ageColor }}>{a.age}</span></span>
                <span style={{ fontWeight: 500 }}>{a.title}</span>
                <span className="muted" style={{ fontSize: 12 }}>{a.opp} · {a.by}</span>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="muted" style={{ padding: '40px 16px', textAlign: 'center' }}>Nothing here. Requests you decide on move to Approved or Rejected.</li>}
        </ul>
      </section>

      <main className="col" style={{ flex: '999 1 520px', minWidth: 0, padding: '20px 32px 40px', gap: 24 }}>
        {cur ? (
          <>
            <header className="col" style={{ gap: 10 }}>
              <div className="row-wrap muted" style={{ fontSize: 12 }}>
                <Pill tone={cur.tone}>{cur.type}</Pill><span>APR-0311</span><span aria-hidden="true">·</span><span>Submitted by {cur.by}</span><span aria-hidden="true">·</span><span style={{ color: cur.ageColor }}>{cur.age}</span>
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>{cur.title}</h2>
              <p style={{ color: 'var(--fg-2)', maxWidth: 720 }}>“QA effort increased after the client confirmed regression coverage for legacy claim types. WP3 contingency raised because rule count is still unconfirmed.” <span className="muted">— {cur.by}</span></p>
              <div className="row-wrap muted" style={{ gap: 16, fontSize: 12 }}>
                <span>Opportunity: <Link to="/engagements/core-banking">{cur.opp}</Link></span>
                <span>Approver: <span style={{ color: 'var(--fg)' }}>You</span></span>
                <span>Policy: estimates above $250K need Presales lead approval</span>
              </div>
            </header>

            {cur.type === 'Estimation' && (
              <>
                <section aria-labelledby="cmp-h" className="col" style={{ gap: 10 }}>
                  <div className="row between" style={{ flexWrap: 'wrap', gap: 12 }}>
                    <h3 id="cmp-h" style={{ fontSize: 15, fontWeight: 600 }}>What changed from v2</h3>
                    <Link to="/estimations" style={{ fontSize: 12, fontWeight: 500 }}>Open estimate v3</Link>
                  </div>
                  <div className="table-wrap">
                    <table className="num" style={{ minWidth: 520 }}>
                      <thead><tr>{['Measure', 'v2 · approved 28 Oct', 'v3 · this request', 'Change'].map((h, i) => <th key={h} scope="col" style={{ padding: '9px 16px', textAlign: i ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {DIFF.map((r) => (
                          <tr key={r.k}>
                            <th scope="row" style={{ fontWeight: 400, padding: '9px 16px', color: 'var(--fg-2)', background: 'transparent', borderBottom: '1px solid #18181b' }}>{r.k}</th>
                            <td className="muted" style={{ padding: '9px 16px', textAlign: 'right' }}>{r.a}</td>
                            <td style={{ padding: '9px 16px', textAlign: 'right', fontWeight: 500 }}>{r.b}</td>
                            <td style={{ padding: '9px 16px', textAlign: 'right', fontWeight: 500, color: r.w ? 'var(--warning)' : 'var(--fg-3)' }}>{r.c}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ul className="col" style={{ paddingLeft: 18, color: 'var(--fg-2)', gap: 4, listStyle: 'disc' }}>
                    <li>Test automation: 120 h → 240 h (regression scope for legacy claim types)</li>
                    <li>Intake UI: 220 h → 180 h (reuses existing design system)</li>
                    <li>WP3 contingency: 12% → 15% (rule count unconfirmed)</li>
                  </ul>
                </section>
              </>
            )}

            <section aria-labelledby="hist-h" className="col" style={{ gap: 10 }}>
              <h3 id="hist-h" style={{ fontSize: 15, fontWeight: 600 }}>Decision history</h3>
              <ol className="col" style={{ gap: 10 }}>
                {HISTORY.map((h) => (
                  <li key={h.what} style={{ display: 'grid', gridTemplateColumns: '12px minmax(0,1fr) auto', gap: 10, alignItems: 'baseline' }}>
                    <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: h.c }} />
                    <span><span style={{ fontWeight: 500 }}>{h.who}</span> <span style={{ color: 'var(--fg-2)' }}>{h.what}</span></span>
                    <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{h.when}</span>
                  </li>
                ))}
              </ol>
            </section>

            {notice && (
              <div role="status" className="row" style={{ alignItems: 'flex-start', padding: '12px 14px', border: '1px dashed #3f3f46', borderRadius: 10, color: 'var(--fg-2)' }}>
                <Icon d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5M12 16h.01" size={16} style={{ color: 'var(--warning)', flex: 'none', marginTop: 1 }} /><span>{notice}</span>
              </div>
            )}

            <div className="row-wrap" style={{ position: 'sticky', bottom: 0, padding: '12px 0', borderTop: '1px solid var(--line)', background: 'rgba(9,9,11,.94)' }}>
              <button type="button" className="btn btn-light" style={{ height: 34 }} onClick={() => open('approve')}>Approve</button>
              <button type="button" className="btn hv" style={{ height: 34 }} onClick={() => open('changes')}>Request changes</button>
              <button type="button" className="btn hv" style={{ height: 34, borderColor: '#5a2a28', color: '#f8a9a3' }} onClick={() => open('reject')}>Reject</button>
              <span className="grow" />
              <button type="button" className="btn btn-ghost hv" style={{ height: 34, color: 'var(--fg-2)' }}>Comment</button>
              <button type="button" className="btn btn-ghost hv" style={{ height: 34, color: 'var(--fg-2)' }}>Reassign</button>
            </div>
          </>
        ) : (
          <p className="muted">Select a request to review it.</p>
        )}
      </main>

      {d && (
        <div className="overlay" style={{ alignItems: 'center', padding: 16 }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="dlg-h" aria-describedby="dlg-d" className="dialog col" style={{ maxWidth: 460, padding: 20, gap: 14 }} onKeyDown={(e) => { if (e.key === 'Escape') setDlg(null) }}>
            <h2 id="dlg-h" className="h2">{d.title}</h2>
            <p id="dlg-d" className="muted">{d.body}</p>
            {d.reason && (
              <>
                <label htmlFor="reason" style={{ fontSize: 12, color: 'var(--fg-2)' }}>{d.reason} <span style={{ color: 'var(--danger)' }}>(required)</span></label>
                <textarea id="reason" ref={reasonRef} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={invalid}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: 'var(--bg-1)', color: 'var(--fg)', font: 'inherit', outline: 'none', resize: 'vertical', border: `1px solid ${invalid ? '#b4413b' : 'var(--line-3)'}` }} />
                {invalid && <span style={{ fontSize: 12, color: 'var(--danger)' }}>Add a reason so the requester knows what to change.</span>}
              </>
            )}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn hv" onClick={() => setDlg(null)}>Cancel</button>
              <button type="button" className={d.cls} style={dlg === 'reject' ? { background: '#b4413b', borderColor: '#b4413b', color: '#fff' } : undefined} onClick={confirm}>{d.confirm}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
