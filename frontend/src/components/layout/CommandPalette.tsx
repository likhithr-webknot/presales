import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, ICONS } from '../ui'

interface Command { group: string; label: string; hint: string; to?: string; icon: string }

const COMMANDS: Command[] = [
  { group: 'Recent', label: 'Core Banking Modernization', hint: 'Opportunity', to: '/engagements/core-banking', icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2' },
  { group: 'Recent', label: 'Estimation · Claims Automation Platform', hint: 'Estimate v3', to: '/estimations', icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2' },
  { group: 'Navigate', label: 'Open pending approvals', hint: '4 pending', to: '/approvals', icon: ICONS.arrowRight },
  { group: 'Navigate', label: 'Go to Opportunities', hint: '', to: '/opportunities', icon: ICONS.arrowRight },
  { group: 'Navigate', label: 'Open AI Copilot', hint: '', to: '/copilot', icon: ICONS.sparkle },
  { group: 'Navigate', label: 'Design foundations', hint: '', to: '/foundations', icon: ICONS.file },
]

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (open) {
      setQuery('')
      setIdx(0)
      inputRef.current?.focus()
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return COMMANDS.filter((c) => !q || `${c.label} ${c.group} ${c.hint}`.toLowerCase().includes(q))
  }, [query])
  const active = Math.min(idx, Math.max(filtered.length - 1, 0))

  const run = (c?: Command) => {
    if (!c?.to) return
    onClose()
    navigate(c.to)
  }

  if (!open) return null
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="row" style={{ padding: '0 14px', gap: 10, borderBottom: '1px solid var(--line-2)' }}>
          <Icon d={ICONS.search} size={16} />
          <label htmlFor="cmdk" className="sr-only">Search commands</label>
          <input
            id="cmdk"
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIdx(0) }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(Math.min(active + 1, filtered.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(Math.max(active - 1, 0)) }
              else if (e.key === 'Enter') { e.preventDefault(); run(filtered[active]) }
              else if (e.key === 'Escape') { e.preventDefault(); onClose() }
            }}
            placeholder="Type a command or search…"
            autoComplete="off"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={filtered.length ? `cmd-${active}` : undefined}
            style={{ flex: 1, height: 48, border: 0, background: 'transparent', outline: 'none', fontSize: 14 }}
          />
          <kbd className="kbd">Esc</kbd>
        </div>
        <ul id="cmdk-list" role="listbox" aria-label="Commands" style={{ padding: 6, maxHeight: 360, overflowY: 'auto' }}>
          {filtered.map((c, i) => (
            <li key={c.label} role="presentation">
              {(i === 0 || filtered[i - 1].group !== c.group) && (
                <div className="muted" style={{ padding: '8px 10px 4px', fontSize: 11, fontWeight: 500 }}>{c.group}</div>
              )}
              <div id={`cmd-${i}`} role="option" aria-selected={i === active} className="cmd-item" onMouseEnter={() => setIdx(i)} onClick={() => run(c)}>
                <Icon d={c.icon} size={16} />
                <span style={{ flex: 1 }}>{c.label}</span>
                <span className="muted" style={{ fontSize: 11 }}>{c.hint}</span>
              </div>
            </li>
          ))}
          {filtered.length === 0 && <li className="muted" style={{ padding: '24px 12px', textAlign: 'center' }}>No commands match “{query}”. Try “approvals” or an opportunity name.</li>}
        </ul>
        <div className="row muted" style={{ gap: 16, padding: '8px 14px', borderTop: '1px solid var(--line-2)', fontSize: 11 }}>
          <span>↑↓ to move</span><span>↵ to open</span><span>Esc to close</span>
        </div>
      </div>
    </div>
  )
}
