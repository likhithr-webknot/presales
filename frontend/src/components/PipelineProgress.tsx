/**
 * PipelineProgress — horizontal step tracker
 */

interface Props {
  pipeline: {
    totalSteps: number
    currentStepIndex: number
    completedSteps: number
    currentStepAgents: string[]
  }
  hasActiveWork: boolean
}

export function PipelineProgress({ pipeline, hasActiveWork }: Props) {
  if (pipeline.totalSteps === 0) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', padding: '4px 0' }}>
      {Array.from({ length: pipeline.totalSteps }).map((_, i) => {
        const isDone    = i < pipeline.completedSteps
        const isCurrent = i === pipeline.currentStepIndex
        const isActive  = isCurrent && hasActiveWork
        const isNext    = i === pipeline.currentStepIndex && !hasActiveWork && !isDone

        let bg = '#1e293b'
        let textColor = '#475569'
        if (isDone)    { bg = '#0f2a1a'; textColor = '#34d399' }
        if (isCurrent) { bg = '#0f2a3f'; textColor = '#60a5fa' }

        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              backgroundColor: bg, color: textColor, whiteSpace: 'nowrap',
              border: isActive ? '1px solid #1e4976' : '1px solid transparent',
              position: 'relative',
            }}>
              {isDone && '✓ '}
              {isActive && <span style={{ marginRight: 4 }}>⚙️</span>}
              Step {i + 1}
              {isNext && <span style={{ marginLeft: 4, color: '#fbbf24' }}>←</span>}
            </div>
            {i < pipeline.totalSteps - 1 && (
              <div style={{ width: 20, height: 1, backgroundColor: '#1e293b' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
