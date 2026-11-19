/**
 * Provenance stamping for human edits. Any text element that did not exist verbatim in the
 * previous version cannot be claimed as AI-verified: it is stamped `human`, so the UI and the
 * exports never present hand-typed text as evidence-backed.
 */
type Json = null | boolean | number | string | Json[] | { [k: string]: Json }

function collectTexts(node: Json, out: Set<string>): void {
  if (Array.isArray(node)) node.forEach((n) => collectTexts(n, out))
  else if (node && typeof node === 'object') {
    if (typeof node.text === 'string' && Array.isArray(node.evidence_ids)) out.add(node.text)
    Object.values(node).forEach((v) => collectTexts(v, out))
  }
}

function stamp(node: Json, known: Set<string>): Json {
  if (Array.isArray(node)) return node.map((n) => stamp(n, known))
  if (node && typeof node === 'object') {
    const out: { [k: string]: Json } = {}
    for (const [k, v] of Object.entries(node)) out[k] = stamp(v, known)
    if (typeof out.text === 'string' && Array.isArray(out.evidence_ids) && !known.has(out.text)) {
      out.origin = 'human'
    }
    return out
  }
  return node
}

export function stampHumanEdits<T>(previous: T | null | undefined, next: T): T {
  const known = new Set<string>()
  if (previous) collectTexts(previous as Json, known)
  return stamp(next as Json, known) as T
}

const clip = (t: string) => t.slice(0, 300)

/** What a person changed between two versions: text that disappeared and text that appeared. */
export function diffTexts<T>(previous: T | null | undefined, next: T): { removed: string[]; added: string[] } {
  const before = new Set<string>()
  const after = new Set<string>()
  if (previous) collectTexts(previous as Json, before)
  collectTexts(next as Json, after)
  return {
    removed: [...before].filter((t) => !after.has(t)).slice(0, 20).map(clip),
    added: [...after].filter((t) => !before.has(t)).slice(0, 20).map(clip),
  }
}
