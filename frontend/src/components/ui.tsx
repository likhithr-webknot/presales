import type { CSSProperties, ReactNode } from 'react'
import { avatarColor, initials } from '../lib/format'

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

export function Pill({ tone = 'neutral', ai, children }: { tone?: Tone; ai?: boolean; children: ReactNode }) {
  const cls = ['pill', tone !== 'neutral' && `pill-${tone}`, ai && 'pill-ai'].filter(Boolean).join(' ')
  return <span className={cls}>{children}</span>
}

export function Avatar({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{ width: size, height: size, background: avatarColor(name) }}
    >
      {initials(name)}
    </span>
  )
}

/** Stroke icon from a single SVG path string. Decorative unless `label` is given. */
export function Icon({ d, size = 14, stroke = 1.75, label, style }: { d: string; size?: number; stroke?: number; label?: string; style?: CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      style={style}
    >
      <path d={d} />
    </svg>
  )
}

export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string; icon?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" className="hv" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.icon && <Icon d={o.icon} />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export const ICONS = {
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12l5 5L20 7',
  close: 'M6 6l12 12M18 6L6 18',
  search: 'M20 20l-3.5-3.5M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0z',
  sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z',
  user: 'M20 21a8 8 0 1 0-16 0M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
  filter: 'M3 4h18l-7 8v6l-4 2v-8z',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  chevLeft: 'M15 6l-6 6 6 6',
  chevRight: 'M9 6l6 6-6 6',
  chevDown: 'M6 9l6 6 6-6',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16v-4M12 8h.01',
}
