import { useState } from 'react'
import { Icon, ICONS, Pill, type Tone } from '../../components/ui'

type ReqState = 'ai' | 'verified'
type Decision = 'accepted' | 'rejected'
interface Req { id: string; cat: string; prio: string; src: string; state: ReqState; conf: 'High' | 'Medium' | 'Low'; p: string; text: string; ac: string[]; why: string; trace: string }

const REQS: Req[] = [
  { id: 'REQ-041', cat: 'Non-functional', prio: 'Must', src: 'p.12 §4.3', state: 'ai', conf: 'High', p: 'a', text: 'Core platform availability of at least 99.95% measured monthly, excluding agreed maintenance windows.', ac: ['Monthly availability report ≥ 99.95%', 'Maintenance windows agreed in writing, max 4 h/month'], why: 'Stated as a mandatory SLA in §4.3 with a measurement period.', trace: 'Not yet linked to a solution component' },
  { id: 'REQ-042', cat: 'Non-functional', prio: 'Must', src: 'p.12 §4.3', state: 'ai', conf: 'High', p: 'b', text: 'Recovery point objective of 5 minutes and recovery time objective of 1 hour for tier-1 services.', ac: ['DR test demonstrates RPO ≤ 5 min', 'Failover to secondary completes in ≤ 60 min'], why: 'Explicit RPO/RTO values in §4.3.2.', trace: 'DR design (Architecture v2)' },
  { id: 'REQ-043', cat: 'Integration', prio: 'Should', src: 'p.13 §4.4', state: 'ai', conf: 'Medium', p: 'c', text: 'Expose account and transaction data through REST APIs to the existing mobile banking app.', ac: ['OpenAPI spec published for account and transaction endpoints'], why: '§4.4 lists the mobile app as a consumer but does not name the protocol; REST inferred from appendix C.', trace: 'API gateway component' },
  { id: 'REQ-044', cat: 'Integration', prio: 'Must', src: 'p.13 §4.4', state: 'ai', conf: 'Low', p: 'c', text: 'Integrate with the card switch using ISO 8583 messaging.', ac: ['Card authorisation flow tested end-to-end with client switch'], why: 'Conflicts with appendix C, which mentions ISO 20022. Recommend raising a clarification question.', trace: 'Not yet linked' },
  { id: 'REQ-045', cat: 'Compliance', prio: 'Must', src: 'p.14 §4.6', state: 'verified', conf: 'High', p: 'd', text: 'Customer data must remain within the client’s home jurisdiction, including backups.', ac: ['Data residency attestation for all regions used'], why: 'Regulatory requirement cited in §4.6.', trace: 'Hosting & region design' },
  { id: 'REQ-046', cat: 'Open question', prio: '—', src: 'p.14 §4.6', state: 'ai', conf: 'Medium', p: 'd', text: 'Does the residency requirement apply to non-production environments with masked data?', ac: ['Answer recorded from client before estimation freeze'], why: '§4.6 is silent on non-production environments.', trace: 'Clarification log' },
]
const PASSAGES = [
  { k: 'a', ref: '4.3.1', text: 'The core platform shall achieve availability of not less than 99.95% per calendar month,', rest: ' excluding maintenance windows agreed with the Bank in advance.' },
  { k: 'b', ref: '4.3.2', text: 'Tier-1 services shall meet an RPO of 5 minutes and an RTO of 1 hour.', rest: ' Disaster recovery shall be tested twice annually.' },
  { k: 'c', ref: '4.4', text: 'The solution shall integrate with the Bank’s mobile banking application and card switch.', rest: ' Interface specifications are provided in Appendix C.' },
  { k: 'd', ref: '4.6', text: 'All customer data, including backups, shall be stored within the Bank’s home jurisdiction.', rest: ' The Bidder shall describe its approach to data residency.' },
]
const PAGE_OF: Record<string, string> = { a: '12', b: '12', c: '13', d: '14' }
const CATS = ['all', 'Functional', 'Non-functional', 'Integration', 'Compliance', 'Constraints', 'Assumptions', 'Open question']
const COUNTS: Record<string, number> = { all: 71, Functional: 28, 'Non-functional': 12, Integration: 11, Compliance: 7, Constraints: 5, Assumptions: 3, 'Open question': 5 }
const TOTAL = 71, VERIFIED_BASE = 64
const CONF_COLOR = { High: 'var(--success)', Medium: 'var(--warning)', Low: 'var(--danger)' }
const STATE_UI: Record<ReqState | Decision, { label: string; tone: Tone; icon: string }> = {
  ai: { label: 'AI suggestion', tone: 'accent', icon: ICONS.sparkle },
  verified: { label: 'Verified', tone: 'success', icon: ICONS.check },
  accepted: { label: 'Accepted · unsaved', tone: 'success', icon: ICONS.check },
  rejected: { label: 'Rejected · unsaved', tone: 'neutral', icon: ICONS.close },
}

export default function RequirementsPage() {
  const [cat, setCat] = useState('all')
  const [open, setOpen] = useState('REQ-041')
  const [dec, setDec] = useState<Record<string, Decision>>({})

  const list = REQS.filter((r) => cat === 'all' || r.cat === cat)
  const openReq = REQS.find((r) => r.id === open)
  const keys = Object.keys(dec)
  const acc = keys.filter((k) => dec[k] === 'accepted').length
  const rej = keys.length - acc
  const reviewed = VERIFIED_BASE + keys.length
  const decide = (id: string, d: Decision | null) => setDec((x) => { const n = { ...x }; if (d) n[id] = d; else delete n[id]; return n })
  const acceptHigh = () => setDec((x) => { const n = { ...x }; REQS.forEach((r) => { if (r.state === 'ai' && r.conf === 'High' && !n[r.id]) n[r.id] = 'accepted' }); return n })

  return (
    <div className="shell-body" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="col" style={{ padding: '20px 32px 16px', gap: 14, borderBottom: '1px solid var(--line)' }}>
        <div className="row between" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <div className="col" style={{ gap: 4 }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>Review extracted requirements</h1>
            <p className="muted">Requirements Agent read <span style={{ color: 'var(--fg-2)' }}>Meridian_CoreBanking_RFP.pdf</span> (64 pages) 2 h ago. Nothing below is added to scope until a person accepts it.</p>
          </div>
          <div className="col num" style={{ gap: 6, minWidth: 220 }}>
            <div className="row between muted" style={{ fontSize: 12 }}><span>{reviewed} of {TOTAL} reviewed</span><span>{TOTAL - reviewed} left</span></div>
            <span aria-hidden="true" style={{ height: 4, borderRadius: 2, background: '#1f1f24', overflow: 'hidden', display: 'flex' }}>
              <span style={{ background: '#34b27b', width: `${((VERIFIED_BASE + acc) / TOTAL) * 100}%` }} />
              <span style={{ background: '#71717a', width: `${(rej / TOTAL) * 100}%` }} />
            </span>
          </div>
        </div>
        <div className="chip-tabs" role="tablist" aria-label="Requirement categories">
          {CATS.map((c) => (
            <button key={c} type="button" role="tab" aria-selected={cat === c} onClick={() => setCat(c)}>
              {c === 'all' ? 'All' : c === 'Open question' ? 'Open questions' : c}<span className="num" style={{ opacity: 0.75 }}>{COUNTS[c]}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', flex: 1 }}>
        <section aria-label="Source document" className="col" style={{ flex: '1 1 380px', minWidth: 0, maxWidth: 520, borderRight: '1px solid var(--line)', background: 'var(--bg-1)' }}>
          <div className="row muted" style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', fontSize: 12 }}>
            <span className="mono" style={{ color: 'var(--fg-2)' }}>RFP · p.{PAGE_OF[openReq?.p ?? 'a']}</span>
          </div>
          <article className="col" style={{ margin: 20, padding: '28px 30px', borderRadius: 6, background: '#f4f4f2', color: '#27272a', fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 13.5, lineHeight: 1.65, gap: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, fontFamily: 'var(--font)', color: '#18181b' }}>4. Technical requirements</h2>
            {PASSAGES.map((p) => {
              const on = p.k === openReq?.p
              return (
                <p key={p.k}>
                  <span className="mono" style={{ fontSize: 11, color: '#52525b', marginRight: 6 }}>{p.ref}</span>
                  <mark style={{ color: 'inherit', borderRadius: 2, padding: '1px 0', background: on ? 'rgba(91,95,232,.28)' : 'rgba(91,95,232,.08)', boxShadow: on ? '0 0 0 2px rgba(91,95,232,.45)' : 'none' }}>{p.text}</mark>{p.rest}
                </p>
              )
            })}
          </article>
        </section>

        <section aria-label="Extracted requirements" className="col" style={{ flex: '999 1 520px', minWidth: 0 }}>
          <ul style={{ flex: 1 }}>
            {list.map((r) => {
              const d = dec[r.id] as Decision | undefined
              const state: ReqState | Decision = d ?? r.state
              const isOpen = open === r.id
              const ui = STATE_UI[state]
              return (
                <li key={r.id} style={{ padding: '16px 24px', borderBottom: '1px solid var(--line)', opacity: state === 'rejected' ? 0.6 : 1, background: isOpen ? '#0f0f14' : undefined, boxShadow: isOpen ? 'inset 2px 0 0 #8b8ef8' : undefined }}>
                  <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
                    <button type="button" onClick={() => setOpen(isOpen ? '' : r.id)} aria-expanded={isOpen} aria-label={`${r.id}: ${r.text}`} className="col" style={{ flex: 1, minWidth: 0, gap: 6, border: 0, background: 'transparent', padding: 0, textAlign: 'left' }}>
                      <span className="row-wrap muted" style={{ fontSize: 12 }}>
                        <span className="mono" style={{ color: 'var(--fg-2)' }}>{r.id}</span><span>{r.cat}</span><span aria-hidden="true">·</span><span>{r.prio}</span><span aria-hidden="true">·</span><span>Source {r.src}</span>
                      </span>
                      <span style={{ fontSize: 14, lineHeight: 1.5 }}>{r.text}</span>
                    </button>
                    <Pill tone={ui.tone} ai={state === 'ai'}><Icon d={ui.icon} size={11} stroke={2.2} />{ui.label}</Pill>
                  </div>
                  {isOpen && (
                    <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '12px 24px', padding: '12px 14px', borderRadius: 8, background: 'var(--bg-3)', border: '1px solid var(--line)' }}>
                      <div className="col" style={{ gap: 6 }}>
                        <span className="muted" style={{ fontSize: 12 }}>Suggested acceptance criteria</span>
                        <ul className="col" style={{ paddingLeft: 16, color: 'var(--fg-2)', gap: 4, listStyle: 'disc' }}>{r.ac.map((a) => <li key={a}>{a}</li>)}</ul>
                      </div>
                      <div className="col" style={{ gap: 6 }}>
                        <span className="muted" style={{ fontSize: 12 }}>Agent rationale</span>
                        <span style={{ color: 'var(--fg-2)' }}>{r.why}</span>
                        <span className="muted" style={{ fontSize: 12, marginTop: 4 }}>Traces to: <span style={{ color: 'var(--fg-2)' }}>{r.trace}</span></span>
                      </div>
                    </div>
                  )}
                  {state === 'ai' && (
                    <div className="row-wrap" style={{ gap: 6, marginTop: 12 }}>
                      <button type="button" className="btn btn-sm hv" onClick={() => decide(r.id, 'accepted')}><Icon d={ICONS.check} size={12} stroke={2.4} style={{ color: '#4acb8f' }} />Accept</button>
                      <button type="button" className="btn btn-sm btn-ghost hv" onClick={() => decide(r.id, 'rejected')}>Reject</button>
                      <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>Confidence: <span style={{ fontWeight: 500, color: CONF_COLOR[r.conf] }}>{r.conf}</span>{r.conf === 'Low' && ' · consider raising a clarification'}</span>
                    </div>
                  )}
                  {d && (
                    <div className="row muted" style={{ gap: 8, marginTop: 10, fontSize: 12 }}>
                      <span>{d === 'accepted' ? 'Will be added to scope once you save.' : 'Will be excluded once you save.'}</span>
                      <button type="button" className="btn btn-sm btn-ghost hv" style={{ height: 24, color: 'var(--accent-fg)' }} onClick={() => decide(r.id, null)}>Undo</button>
                    </div>
                  )}
                </li>
              )
            })}
            {list.length === 0 && <li className="muted" style={{ padding: 32, textAlign: 'center' }}>No sample requirements in this category.</li>}
          </ul>
          <div role="status" aria-live="polite" className="row-wrap" style={{ position: 'sticky', bottom: 0, gap: 12, padding: '12px 24px', borderTop: '1px solid var(--line)', background: 'rgba(9,9,11,.94)' }}>
            <span className="num" style={{ color: 'var(--fg-2)' }}>{keys.length ? `${keys.length} unsaved decision${keys.length > 1 ? 's' : ''} · ${acc} accepted, ${rej} rejected` : 'No unsaved decisions'}</span>
            <span className="grow" />
            <button type="button" className="btn hv" onClick={acceptHigh}>Accept all high-confidence</button>
            <button type="button" className="btn btn-primary" disabled={keys.length === 0} onClick={() => setDec({})}>Save review</button>
          </div>
        </section>
      </div>
    </div>
  )
}
