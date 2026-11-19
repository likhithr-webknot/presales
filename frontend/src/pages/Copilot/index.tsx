import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Icon, ICONS } from '../../components/ui'

type RunState = 'completed' | 'running' | 'awaiting' | 'queued'
interface Step {
  name: string; state: RunState; time: string; summary: string; inputs: string[]
  log: { t: string; m: string }[]; outputs: { name: string; to?: string }[]
  err?: string; human?: { title: string; text: string; action: string; to: string }
}
const STATE_UI: Record<RunState, { label: string; bg: string; fg: string }> = {
  completed: { label: 'Completed', bg: 'rgba(52,178,123,.13)', fg: '#4acb8f' },
  running: { label: 'Running', bg: 'rgba(124,127,245,.14)', fg: '#a5a8fa' },
  awaiting: { label: 'Awaiting human input', bg: 'rgba(224,160,66,.13)', fg: '#e8b05c' },
  queued: { label: 'Queued', bg: '#1c1c21', fg: '#a1a1aa' },
}
const STEPS: Step[] = [
  { name: 'Discovery Agent', state: 'completed', time: '1m 12s', summary: 'Read 48 pages and 1 workshop note; built the opportunity brief.', inputs: ['RFP_Ridgeview_SIS.pdf (48 pages)', 'Workshop 1 notes (verified)'], log: [{ t: '14:02', m: 'Parsed RFP into 31 sections' }, { t: '14:03', m: 'Extracted 6 stakeholders, 4 deadlines' }], outputs: [{ name: 'Opportunity brief', to: '/engagements/core-banking' }] },
  { name: 'Requirements Analysis Agent', state: 'completed', time: '2m 40s', summary: 'Suggested 18 requirements and flagged 5 gaps where the RFP is silent.', inputs: ['Opportunity brief', 'RFP §3–5'], log: [{ t: '14:03', m: 'Classified 18 candidate requirements' }, { t: '14:05', m: 'Compared with 3 similar past RFPs' }, { t: '14:05', m: 'Flagged 5 gaps' }], outputs: [{ name: '18 requirement suggestions', to: '/requirements' }, { name: 'Gap list (5)' }] },
  { name: 'Compliance Review Agent', state: 'running', time: '0:48', summary: 'Checking accessibility and data-protection clauses. Attempt 2 of 3.', inputs: ['RFP §5 (Compliance)', 'Knowledge Base: policies'], log: [{ t: '14:05', m: 'Attempt 1: KB search started' }, { t: '14:06', m: 'Attempt 1 failed (timeout)' }, { t: '14:06', m: 'Attempt 2: KB search started' }], outputs: [], err: 'KnowledgeBaseTimeout: search exceeded 30s (policies collection)' },
  { name: 'Review gate · verify requirements', state: 'awaiting', time: 'Waiting 6 min', summary: 'Architecture starts after a person accepts or rejects the 18 suggestions.', inputs: ['18 requirement suggestions'], log: [{ t: '14:05', m: 'Assigned to you' }, { t: '14:05', m: 'Notification sent' }], outputs: [], human: { title: 'Your review is needed', text: '18 AI-suggested requirements are waiting. Downstream agents only use requirements a person has accepted.', action: 'Open review', to: '/requirements' } },
  { name: 'Solution Architecture Agent', state: 'queued', time: '—', summary: 'Blocked by the review gate.', inputs: ['Accepted requirements (after review)'], log: [], outputs: [] },
  { name: 'Estimation Agent', state: 'queued', time: '—', summary: 'Will draft an estimate for estimator approval.', inputs: ['Architecture draft', 'Rate card APAC 2026 Q4'], log: [], outputs: [] },
]
const NODE_COLOR = { completed: '#34b27b', running: '#8b8ef8', awaiting: '#e0a042', queued: 'transparent' }

function StatePill({ s }: { s: RunState }) {
  const u = STATE_UI[s]
  return <span className="pill" style={{ background: u.bg, color: u.fg }}>{u.label}</span>
}

export default function CopilotPage() {
  const [sel, setSel] = useState(3)
  const [draft, setDraft] = useState('')
  const [sent, setSent] = useState(false)
  const d = STEPS[sel]
  const onSubmit = (e: FormEvent) => { e.preventDefault(); if (draft.trim()) { setSent(true); setDraft('') } }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', flex: 1 }}>
      <section aria-label="Conversation" className="col" style={{ flex: '1 1 340px', maxWidth: 420, minWidth: 0, borderRight: '1px solid var(--line)' }}>
        <div className="row" style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
          <span style={{ fontWeight: 600 }}>Student Information System</span>
          <span className="muted" style={{ fontSize: 12 }}>· Ridgeview University</span>
          <button type="button" className="btn btn-sm hv" style={{ marginLeft: 'auto', height: 26 }}>History</button>
        </div>
        <div className="col" style={{ flex: 1, padding: 16, gap: 16, overflowY: 'auto' }}>
          <div style={{ alignSelf: 'flex-end', maxWidth: '88%', padding: '10px 12px', borderRadius: 10, background: '#18181b', border: '1px solid var(--line-2)', color: '#f4f4f5' }}>
            Analyze the Ridgeview RFP, identify missing requirements, then prepare a first estimate from the approved scope.
            <span className="row-wrap" style={{ gap: 6, marginTop: 8 }}>
              {['RFP_Ridgeview_SIS.pdf', 'Workshop 1 notes'].map((f) => <span key={f} className="row" style={{ gap: 4, height: 20, padding: '0 6px', borderRadius: 5, background: 'var(--line-2)', fontSize: 11, color: 'var(--fg-2)' }}>{f}</span>)}
            </span>
          </div>
          {sent && <div role="status" style={{ alignSelf: 'flex-end', maxWidth: '88%', padding: '10px 12px', borderRadius: 10, background: '#18181b', border: '1px solid var(--line-2)' }}>Message queued. <span className="muted">Sample data: Copilot replies are not connected to a backend yet.</span></div>}
          <div className="col" style={{ gap: 10, color: '#e4e4e7' }}>
            <div className="row muted" style={{ gap: 8, fontSize: 12 }}>
              <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: 6, background: '#16173a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-fg)' }}><Icon d={ICONS.sparkle} size={12} stroke={2} /></span>Copilot · 14:02
            </div>
            <p>I’ve started run #218 with 6 steps. Two steps need people:</p>
            <ol className="col" style={{ paddingLeft: 18, gap: 4, listStyle: 'decimal' }}>
              <li>You review 18 extracted requirements before architecture starts.</li>
              <li>An estimator approves the draft estimate before it is linked to the opportunity.</li>
            </ol>
            <p>So far: 48 pages read, 18 requirements suggested, and <span style={{ color: 'var(--fg)', fontWeight: 500 }}>5 gaps</span> found where the RFP is silent (data migration, accessibility level, SSO provider, hosting, support hours).</p>
            <p className="muted" style={{ fontSize: 12 }}>Sources: RFP §3–5, Workshop 1 notes (verified)</p>
            <div className="row-wrap" style={{ gap: 6 }}>
              <Link to="/requirements" className="btn btn-sm btn-light">Review requirements</Link>
              <button type="button" className="btn btn-sm hv">Draft client questions for the 5 gaps</button>
            </div>
          </div>
        </div>
        <form onSubmit={onSubmit} className="col" style={{ margin: 12, border: '1px solid var(--line-3)', borderRadius: 12, background: 'var(--bg-3)' }}>
          <label htmlFor="prompt" className="sr-only">Message Copilot</label>
          <textarea id="prompt" rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask about this opportunity, or @mention a document…" style={{ border: 0, background: 'transparent', resize: 'none', padding: 12, outline: 'none', font: 'inherit', color: 'var(--fg)' }} />
          <div className="row-wrap" style={{ gap: 6, padding: 8, borderTop: '1px solid var(--line)' }}>
            <button type="button" className="btn btn-sm hv" style={{ borderColor: 'var(--line-2)', color: 'var(--fg-2)' }}>Context: this opportunity · 6 docs</button>
            <button type="submit" aria-label="Send" disabled={!draft.trim()} className="btn btn-primary" style={{ marginLeft: 'auto', width: 28, height: 28, padding: 0, borderRadius: 7 }}><Icon d="M12 19V5M5 12l7-7 7 7" stroke={2} /></button>
          </div>
        </form>
      </section>

      <main className="col" style={{ flex: '999 1 420px', minWidth: 0, padding: '20px 24px 40px', gap: 16 }}>
        <div className="row-wrap" style={{ gap: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em' }}>Run #218</h1>
          <span className="pill pill-warning" style={{ height: 22 }}>Waiting on 1 person</span>
          <span className="muted num" style={{ fontSize: 12 }}>Started 14:02 · 2 of 6 steps done</span>
          <span className="grow" />
          <button type="button" className="btn btn-sm hv">Pause run</button>
        </div>
        <ol aria-label="Agent steps" className="col">
          {STEPS.map((s, i) => {
            const on = i === sel, u = STATE_UI[s.state]
            return (
              <li key={s.name} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr)', gap: 12 }}>
                <span className="col" style={{ alignItems: 'center' }}>
                  <span aria-hidden="true" style={{ width: 28, height: 28, flex: 'none', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-3)', border: `1px solid ${s.state === 'queued' ? 'var(--line-2)' : u.fg}` }}>
                    <span style={{ width: 8, height: 8, boxSizing: 'border-box', borderRadius: s.state === 'awaiting' ? 2 : 999, background: NODE_COLOR[s.state], border: s.state === 'queued' ? '1.5px solid #52525b' : 0, animation: s.state === 'running' ? 'po-pulse 1.4s ease-in-out infinite' : undefined }} />
                  </span>
                  {i < STEPS.length - 1 && <span aria-hidden="true" style={{ flex: 1, width: 1, minHeight: 16, background: s.state === 'completed' ? '#2e5e4e' : 'var(--line-2)' }} />}
                </span>
                <button type="button" className="hv col" aria-pressed={on} onClick={() => setSel(i)} style={{ gap: 6, width: '100%', marginBottom: 12, padding: '12px 14px', borderRadius: 10, textAlign: 'left', background: on ? '#121216' : 'transparent', border: `1px solid ${on ? '#3b3e8a' : 'var(--line)'}`, opacity: s.state === 'queued' ? 0.75 : 1 }}>
                  <span className="row-wrap"><span style={{ fontWeight: 600 }}>{s.name}</span><StatePill s={s.state} /><span className="muted num" style={{ marginLeft: 'auto', fontSize: 12 }}>{s.time}</span></span>
                  <span className="muted">{s.summary}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </main>

      <aside aria-label="Step details" aria-live="polite" className="col" style={{ flex: '1 1 300px', maxWidth: 380, minWidth: 0, borderLeft: '1px solid var(--line)', padding: 20, gap: 20, background: 'var(--bg-1)' }}>
        <div className="col" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 12 }}>Step {sel + 1} of {STEPS.length}</span>
          <h2 className="h2">{d.name}</h2>
          <span><StatePill s={d.state} /></span>
        </div>
        {d.human && (
          <div className="col" style={{ gap: 8, padding: 12, border: '1px solid #5a4520', borderRadius: 10, background: '#1a1408' }}>
            <span style={{ fontWeight: 500, color: '#f5d9a8' }}>{d.human.title}</span>
            <span style={{ fontSize: 12, color: '#d4c4a4' }}>{d.human.text}</span>
            <Link to={d.human.to} className="btn btn-sm btn-light" style={{ alignSelf: 'flex-start' }}>{d.human.action}</Link>
          </div>
        )}
        {d.err && (
          <div className="col" style={{ gap: 6, padding: 12, border: '1px solid #5a2a28', borderRadius: 10, background: '#1a0d0c' }}>
            <span style={{ fontWeight: 500, color: '#f8c4c0' }}>Attempt 1 failed</span>
            <span className="mono" style={{ fontSize: 11.5, color: '#e7b3af' }}>{d.err}</span>
            <span style={{ fontSize: 12, color: '#d4a9a5' }}>Retried automatically at 14:06. Attempt 2 of 3 is running.</span>
          </div>
        )}
        <section className="col" style={{ gap: 8 }}>
          <h3 className="muted" style={{ fontSize: 12, fontWeight: 500 }}>Input context</h3>
          <ul className="col" style={{ gap: 6 }}>{d.inputs.map((i) => <li key={i} className="row" style={{ color: 'var(--fg-2)' }}><Icon d={ICONS.file} size={12} style={{ color: 'var(--fg-3)' }} />{i}</li>)}</ul>
        </section>
        <section className="col" style={{ gap: 8 }}>
          <h3 className="muted" style={{ fontSize: 12, fontWeight: 500 }}>Actions</h3>
          <ol className="col mono" style={{ gap: 6, fontSize: 11.5, color: 'var(--fg-2)' }}>
            {(d.log.length ? d.log : [{ t: '—', m: 'Not started' }]).map((l, i) => <li key={i} style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr)', gap: 8 }}><span className="muted">{l.t}</span><span>{l.m}</span></li>)}
          </ol>
        </section>
        <section className="col" style={{ gap: 8 }}>
          <h3 className="muted" style={{ fontSize: 12, fontWeight: 500 }}>Output artifacts</h3>
          {d.outputs.length ? (
            <>
              <ul className="col" style={{ gap: 6 }}>
                {d.outputs.map((o) => (
                  <li key={o.name} className="row" style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8 }}>
                    {o.to ? <Link to={o.to} style={{ color: 'var(--fg)', fontWeight: 500, flex: 1 }}>{o.name}</Link> : <span style={{ fontWeight: 500, flex: 1 }}>{o.name}</span>}
                    <span style={{ fontSize: 11, color: 'var(--accent-fg)' }}>Unverified</span>
                  </li>
                ))}
              </ul>
              <span className="muted" style={{ fontSize: 12 }}>Linked to Student Information System.</span>
            </>
          ) : <span className="muted">No output yet.</span>}
        </section>
      </aside>
    </div>
  )
}
