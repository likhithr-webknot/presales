const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  INITIATED:            { label: 'Initiated',           bg: '#1e293b', color: '#94a3b8' },
  RESEARCH_COMPLETE:    { label: 'Research Done',        bg: '#0f3460', color: '#60a5fa' },
  PROPOSAL_IN_PROGRESS: { label: 'In Progress',          bg: '#1e3a5f', color: '#38bdf8' },
  UNDER_REVIEW:         { label: 'Under Review',         bg: '#3d2b00', color: '#fbbf24' },
  APPROVED:             { label: 'Approved',             bg: '#0f2a1a', color: '#34d399' },
  DELIVERED:            { label: 'Delivered',            bg: '#1a2e1a', color: '#86efac' },
  BLOCKED:              { label: 'Blocked',              bg: '#2d1a1a', color: '#f87171' },
  CANCELLED:            { label: 'Cancelled',            bg: '#1a1a1a', color: '#6b7280' },
}

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: '#1e293b', color: '#94a3b8' }
  return (
    <span style={{
      padding: '2px 10px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.05em',
      backgroundColor: cfg.bg,
      color: cfg.color,
      textTransform: 'uppercase',
    }}>
      {cfg.label}
    </span>
  )
}
