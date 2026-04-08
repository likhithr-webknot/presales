/**
 * AuditTimeline — last N audit events as a compact timeline
 */
import { AuditLog } from '../services/api'

const ACTION_ICONS: Record<string, string> = {
  ENGAGEMENT_CREATED:     '🆕',
  ENGAGEMENT_UPDATED:     '✏️',
  STAGE_ADVANCED:         '⏩',
  AGENT_INVOKED:          '🤖',
  AGENT_COMPLETED:        '✅',
  AGENT_FAILED:           '❌',
  GATE_SENT_FOR_REVIEW:   '🔍',
  GATE_APPROVED:          '✅',
  GATE_REJECTED:          '🚫',
  GATE_OVERRIDDEN:        '⚠️',
  REVISION_REQUESTED:     '🔄',
  VERSION_CREATED:        '📌',
  ARTIFACT_DOWNLOADED:    '⬇️',
  SOW_SECTION_CONFIRMED:  '📝',
  OVERRIDE_APPLIED:       '🔧',
  CASCADE_DETECTED:       '⚡',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function AuditTimeline({ logs }: { logs: AuditLog[] }) {
  if (logs.length === 0) return (
    <div style={{ color: '#475569', fontSize: 12, padding: '8px 0' }}>No activity yet.</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {logs.map(log => (
        <div key={log.id} style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0',
          borderBottom: '1px solid #0f172a',
        }}>
          <span style={{ fontSize: 14, lineHeight: 1.5, flexShrink: 0 }}>
            {ACTION_ICONS[log.action] ?? '•'}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 12, color: '#cbd5e1' }}>
              {log.action.replace(/_/g, ' ').toLowerCase()}
            </span>
            {log.user && (
              <span style={{ fontSize: 11, color: '#475569', marginLeft: 6 }}>
                by {log.user.name}
              </span>
            )}
          </div>
          <span style={{ fontSize: 10, color: '#334155', flexShrink: 0, paddingTop: 2 }}>
            {timeAgo(log.createdAt)}
          </span>
        </div>
      ))}
    </div>
  )
}
