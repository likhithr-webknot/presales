/** Formats a value expressed in $K (e.g. 2400 -> "$2.4M", 540 -> "$540K"). */
export function moneyK(k: number): string {
  return k >= 1000 ? `$${(k / 1000).toFixed(2).replace(/0$/, '')}M` : `$${Math.round(k)}K`
}

export function initials(name: string, max = 2): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, max)
    .toUpperCase()
}

const AVATAR_COLORS = ['#3b3f8f', '#2e5e4e', '#6b4a2b', '#5a3360', '#2f4f6b', '#5c3a3a']

/** Deterministic colour per name so an owner always gets the same avatar. */
export function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 997
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function sparkPoints(values: number[], w = 72, h = 24): string {
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  return values
    .map((v, i) => `${((i * w) / (values.length - 1)).toFixed(1)},${(h - 3 - ((v - min) / range) * 18).toFixed(1)}`)
    .join(' ')
}
