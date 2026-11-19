import { Pill, type Tone } from '../../components/ui'

const COLORS: [string, string, string][] = [['bg', '#09090B', '#FFFFFF'], ['surface-1', '#0C0C0E', '#FAFAFA'], ['surface-2', '#111113', '#F4F4F5'], ['surface-3', '#18181B', '#EDEDF0'], ['border', '#1F1F23', '#E4E4E7'], ['border-strong', '#2A2A30', '#D4D4D8'], ['text', '#FAFAFA', '#09090B'], ['text-muted', '#A1A1AA', '#52525B'], ['accent', '#5B5FE8', '#4F46E5'], ['accent-text', '#A5A8FA', '#4338CA'], ['success', '#4ACB8F', '#047857'], ['warning', '#E8B05C', '#B45309'], ['danger', '#F27E76', '#B91C1C'], ['focus-ring', '#8B8EF8', '#6366F1']]
const TYPE: { token: string; spec: string; sample: string; style: React.CSSProperties }[] = [
  { token: 'display', spec: '30 / 600 / -2%', sample: 'Pipeline overview', style: { fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em' } },
  { token: 'page-title', spec: '26 / 600 / -2%', sample: 'Opportunities', style: { fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' } },
  { token: 'section', spec: '17 / 600 / -1%', sample: 'My priorities', style: { fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em' } },
  { token: 'card-title', spec: '14 / 500', sample: 'Core Banking Modernization', style: { fontSize: 14, fontWeight: 500 } },
  { token: 'body', spec: '13 / 400 / 1.45', sample: 'Requirements stay as suggestions until a person accepts them.', style: { fontSize: 13 } },
  { token: 'meta', spec: '12 / 400 / muted', sample: 'Updated 3 h ago by Arjun Mehta', style: { fontSize: 12, color: 'var(--fg-3)' } },
  { token: 'numeric', spec: 'tabular-nums', sample: '$12.4M  1,840 h  31%', style: { fontSize: 20, fontWeight: 600, fontVariantNumeric: 'tabular-nums' } },
]
const MOTION = [['duration-fast', '120ms · hover, row selection'], ['duration-base', '180ms · popovers, tabs, sidebar'], ['duration-slow', '240ms · dialogs, drawers, page enter'], ['ease-out', 'cubic-bezier(.2,.8,.2,1) · no spring bounce'], ['reduced', 'prefers-reduced-motion → opacity only, no loops']]
const PILLS: [string, Tone][] = [['Draft', 'neutral'], ['In review', 'accent'], ['Approved', 'success'], ['Due today', 'warning'], ['Overdue', 'danger'], ['Queued', 'neutral']]
const AGENT: { l: string; d: string; dot: React.CSSProperties }[] = [
  { l: 'Queued', d: 'hollow ring', dot: { borderRadius: 999, border: '1.5px solid #52525b' } },
  { l: 'Running', d: 'indigo, slow pulse', dot: { borderRadius: 999, background: '#8b8ef8', animation: 'po-pulse 1.4s ease-in-out infinite' } },
  { l: 'Awaiting human input', d: 'amber square', dot: { borderRadius: 2, background: '#e0a042' } },
  { l: 'Completed', d: 'green dot', dot: { borderRadius: 999, background: '#34b27b' } },
  { l: 'Failed', d: 'red dot + retry', dot: { borderRadius: 999, background: '#e5675f' } },
]
const mono = { fontFamily: 'var(--mono)' } as const
const cell = { padding: 20, background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', gap: 12 } as const

export default function FoundationsPage() {
  return (
    <main className="page" style={{ maxWidth: 1360, padding: '48px 40px 64px', gap: 48 }}>
      <header className="col" style={{ gap: 8, maxWidth: 720 }}>
        <p className="muted" style={{ ...mono, fontSize: 12 }}>presales-orchestrator / tokens v0.1</p>
        <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em' }}>Design foundations</h1>
        <p className="muted" style={{ fontSize: 14 }}>One neutral ramp, one indigo accent, four status hues. Status colors also differ in lightness and always pair with a label or icon. Dark values are live in <span style={mono}>src/styles/app.css</span>; light values are reference only.</p>
      </header>

      <section aria-labelledby="c-h" className="col" style={{ gap: 16 }}>
        <h2 id="c-h" style={{ fontSize: 18, fontWeight: 600 }}>Color · semantic tokens</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12 }}>
          {COLORS.map(([n, dark, light]) => (
            <div key={n} className="col" style={{ gap: 8 }}>
              <span aria-hidden="true" style={{ display: 'flex', height: 48, borderRadius: 8, border: '1px solid var(--line-3)', background: `linear-gradient(90deg,${dark} 50%,${light} 50%)` }} />
              <span className="col" style={{ gap: 1 }}><span style={{ ...mono, fontSize: 12 }}>{n}</span><span className="muted" style={{ ...mono, fontSize: 11 }}>dark {dark} · light {light}</span></span>
            </div>
          ))}
        </div>
      </section>

      <div className="row" style={{ flexWrap: 'wrap', gap: 48, alignItems: 'flex-start' }}>
        <section aria-labelledby="t-h" className="col" style={{ flex: '1 1 520px', minWidth: 0, gap: 16 }}>
          <h2 id="t-h" style={{ fontSize: 18, fontWeight: 600 }}>Type · Geist, Geist Mono</h2>
          <div className="col" style={{ borderTop: '1px solid var(--line)' }}>
            {TYPE.map((t) => (
              <div key={t.token} style={{ display: 'grid', gridTemplateColumns: '140px minmax(0,1fr)', gap: 16, alignItems: 'baseline', padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                <span className="muted" style={{ ...mono, fontSize: 11 }}>{t.token}<br />{t.spec}</span><span style={t.style}>{t.sample}</span>
              </div>
            ))}
          </div>
        </section>
        <section aria-labelledby="s-h" className="col" style={{ flex: '1 1 360px', minWidth: 0, gap: 16 }}>
          <h2 id="s-h" style={{ fontSize: 18, fontWeight: 600 }}>Space, radius, motion</h2>
          <div className="col" style={{ gap: 8 }}>
            {[1, 2, 3, 4, 6, 8, 10, 12].map((n) => <div key={n} className="row" style={{ gap: 12 }}><span className="muted" style={{ width: 56, ...mono, fontSize: 11 }}>space-{n}</span><span aria-hidden="true" style={{ height: 8, borderRadius: 2, background: '#5b5fe8', width: n * 4 }} /><span className="num" style={{ fontSize: 12, color: 'var(--fg-2)' }}>{n * 4}px</span></div>)}
          </div>
          <div className="row-wrap" style={{ gap: 12 }}>
            {([['sm', 4], ['md', 6], ['lg', 8], ['xl', 10]] as const).map(([n, r]) => <div key={n} className="col" style={{ alignItems: 'center', gap: 6 }}><span aria-hidden="true" style={{ width: 44, height: 44, border: '1px solid #3f3f46', background: 'var(--bg-4)', borderRadius: r }} /><span className="muted" style={{ ...mono, fontSize: 11 }}>{n} {r}</span></div>)}
          </div>
          <dl className="col" style={{ margin: 0, gap: 6, fontSize: 12 }}>
            {MOTION.map(([k, v]) => <div key={k} style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,1fr)', gap: 12 }}><dt className="muted" style={mono}>{k}</dt><dd style={{ margin: 0, color: 'var(--fg-2)' }}>{v}</dd></div>)}
          </dl>
        </section>
      </div>

      <section aria-labelledby="k-h" className="col" style={{ gap: 16 }}>
        <h2 id="k-h" style={{ fontSize: 18, fontWeight: 600 }}>Components</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={cell}>
            <span className="muted" style={{ fontSize: 12 }}>Buttons · 32px default, 28px compact</span>
            <div className="row-wrap">
              <button type="button" className="btn btn-primary">Primary</button>
              <button type="button" className="btn btn-light">Decision</button>
              <button type="button" className="btn hv">Secondary</button>
              <button type="button" className="btn btn-ghost hv">Ghost</button>
              <button type="button" className="btn hv" style={{ borderColor: '#5a2a28', color: '#f8a9a3' }}>Destructive</button>
              <button type="button" className="btn" disabled>Disabled</button>
            </div>
          </div>
          <div style={cell}>
            <span className="muted" style={{ fontSize: 12 }}>Status pills · always text + color</span>
            <div className="row-wrap" style={{ gap: 6 }}>{PILLS.map(([l, t]) => <Pill key={l} tone={t}>{l}</Pill>)}</div>
          </div>
          <div style={cell}>
            <span className="muted" style={{ fontSize: 12 }}>Provenance · AI vs human-verified</span>
            <div className="col" style={{ gap: 8 }}>
              <div style={{ padding: '10px 12px', border: '1px dashed #4b4ea8', borderRadius: 8, background: '#0f0f1c', color: '#e4e4e7' }}>AI suggestion — dashed, indigo, never counted in scope</div>
              <div style={{ padding: '10px 12px', border: '1px solid #1f3d31', borderRadius: 8, background: '#0b1511', color: '#e4e4e7' }}>Verified by a person — solid, with verifier name</div>
            </div>
          </div>
          <div style={cell}>
            <span className="muted" style={{ fontSize: 12 }}>Agent states</span>
            <div className="col" style={{ gap: 8 }}>
              {AGENT.map((a) => <span key={a.l} className="row" style={{ gap: 10 }}><span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 999, border: '1px solid var(--line-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ width: 8, height: 8, boxSizing: 'border-box', ...a.dot }} /></span><span style={{ fontWeight: 500 }}>{a.l}</span><span className="muted" style={{ fontSize: 12 }}>{a.d}</span></span>)}
            </div>
          </div>
          <div style={cell}>
            <span className="muted" style={{ fontSize: 12 }}>Loading · skeleton, never fake progress</span>
            <div className="col" style={{ gap: 8 }}>{[70, 90, 45].map((w) => <span key={w} style={{ height: 12, width: `${w}%`, borderRadius: 4, background: '#1c1c21', animation: 'po-pulse 1.4s ease-in-out infinite' }} />)}</div>
          </div>
          <div style={{ ...cell, gap: 10 }}>
            <span className="muted" style={{ fontSize: 12 }}>Empty and error states</span>
            <div className="col" style={{ gap: 4, padding: 14, border: '1px dashed var(--line-3)', borderRadius: 8 }}><span style={{ fontWeight: 500 }}>No proposals yet</span><span className="muted" style={{ fontSize: 12 }}>Start from a template or let the Proposal Agent draft from approved scope.</span></div>
            <div role="alert" className="row" style={{ padding: '10px 12px', border: '1px solid #5a2a28', borderRadius: 8, background: '#1a0d0c', fontSize: 12, color: '#f8c4c0' }}><span>Couldn’t load estimates. Your edits are kept locally.</span><button type="button" style={{ marginLeft: 'auto', border: 0, background: 'transparent', color: 'var(--fg)', fontWeight: 500 }}>Retry</button></div>
          </div>
        </div>
      </section>
    </main>
  )
}
