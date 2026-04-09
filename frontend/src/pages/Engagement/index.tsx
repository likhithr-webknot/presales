import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { useEngagementStatus } from '../../hooks/useEngagementStatus'
import { engagementsApi, artifactsApi } from '../../services/api'
import { StatusBadge } from '../../components/StatusBadge'
import { AgentFeed } from '../../components/AgentFeed'
import { PipelineProgress } from '../../components/PipelineProgress'
import { GatePanel } from '../../components/GatePanel'
import { CascadeBanner } from '../../components/CascadeBanner'
import { AuditTimeline } from '../../components/AuditTimeline'

interface ChatMessage {
  role: 'user' | 'system'
  text: string
  timestamp: Date
}

export default function EngagementPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // B-03 fix: guard against missing id (misconfigured route)
  if (!id) return <Navigate to="/dashboard" replace />
  const { user } = useAuth()
  const { status, isLoading } = useEngagementStatus(id!)
  const queryClient = useQueryClient()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [activeTab, setActiveTab] = useState<'chat' | 'gates' | 'versions' | 'audit'>('chat')
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const messageMutation = useMutation({
    mutationFn: (msg: string) => engagementsApi.message(id!, msg),
    onSuccess: (result) => {
      let systemMsg = ''
      if (result.status === 'dispatched') {
        systemMsg = '✅ All details collected. Agents are running — watch the pipeline panel.'
      } else {
        systemMsg = result.followUpQuestion || `I still need: ${result.missingFields?.join(', ')}. Please provide those details.`
      }
      setMessages(prev => [...prev, { role: 'system', text: systemMsg, timestamp: new Date() }])
      queryClient.invalidateQueries({ queryKey: ['engagement-status', id] })
    },
    onError: () => {
      setMessages(prev => [...prev, {
        role: 'system',
        text: '❌ Something went wrong. Please try again.',
        timestamp: new Date(),
      }])
    },
  })

  const feedbackMutation = useMutation({
    mutationFn: ({ feedback, section }: { feedback: string; section?: string }) =>
      engagementsApi.feedback(id!, feedback, section),
    onSuccess: (result) => {
      setMessages(prev => [...prev, {
        role: 'system',
        text: `↺ Feedback routed to ${result.routedTo.replace(/_/g, ' ')}. Revision in progress.`,
        timestamp: new Date(),
      }])
    },
  })

  const handleSend = () => {
    if (!input.trim()) return
    const text = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text, timestamp: new Date() }])

    // If pipeline is complete, treat as feedback; otherwise as intake message
    if (status?.health.hasActiveWork === false && (status?.pipeline.completedSteps ?? 0) > 0) {
      feedbackMutation.mutate({ feedback: text })
    } else {
      messageMutation.mutate(text)
    }
  }

  const handleDownload = async () => {
    try {
      const result = await artifactsApi.download(id!)
      window.open(result.downloadUrl, '_blank')
    } catch {
      alert('No artifact available yet.')
    }
  }

  if (isLoading || !status) {
    return (
      <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#475569' }}>Loading…</div>
      </div>
    )
  }

  const { engagement, pipeline, jobs, gates, latestVersion, recentActivity, health } = status

  return (
    <div style={pageStyle}>
      {/* Top bar */}
      <div style={{
        padding: '14px 24px', borderBottom: '1px solid #0f172a',
        backgroundColor: '#0a0f1e', display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <button onClick={() => navigate('/dashboard')} style={{ ...linkBtn, fontSize: 16 }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#f1f5f9', marginBottom: 2 }}>
            {engagement.clientName}
          </div>
          <div style={{ fontSize: 12, color: '#475569' }}>
            {engagement.domain} · {engagement.collateralType.replace(/_/g, ' ')} · {engagement.stage.replace('_', ' ')}
          </div>
        </div>
        <StatusBadge status={engagement.status} />
        {latestVersion && (
          <button onClick={handleDownload} style={primaryBtn}>
            ⬇ Download v{latestVersion.version}
          </button>
        )}
      </div>

      {/* Cascade banner */}
      <div style={{ padding: '0 24px' }}>
        <CascadeBanner
          engagementId={id!}
          onRestart={() => messageMutation.mutate('restart pipeline')}
        />
      </div>

      {/* Pipeline progress bar */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid #0f172a' }}>
        <PipelineProgress pipeline={pipeline} hasActiveWork={health.hasActiveWork} />
      </div>

      {/* Main layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Left — Chat + Agent Feed */}
        <div style={{
          flex: '0 0 420px', display: 'flex', flexDirection: 'column',
          borderRight: '1px solid #0f172a',
        }}>
          {/* Agent Feed */}
          {(jobs.active.length > 0 || jobs.failed.length > 0) && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #0f172a' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Agents
              </div>
              <AgentFeed
                active={jobs.active}
                failed={jobs.failed}
                completedCount={jobs.completed}
              />
            </div>
          )}

          {/* Chat messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 && (
              <div style={{ color: '#334155', fontSize: 13, padding: '16px 0', textAlign: 'center' }}>
                Send a message to start working on this engagement.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '10px 14px', borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                backgroundColor: m.role === 'user' ? '#1e40af' : '#0f172a',
                fontSize: 13, lineHeight: 1.5,
                color: m.role === 'user' ? '#f1f5f9' : '#cbd5e1',
              }}>
                {m.text}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid #0f172a', display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={
                pipeline.completedSteps > 0 && !health.hasActiveWork
                  ? 'Give feedback on the output…'
                  : 'Describe the client, domain, requirements…'
              }
              style={{
                flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid #1e293b',
                backgroundColor: '#030712', color: '#f1f5f9', fontSize: 13, outline: 'none',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || messageMutation.isPending || feedbackMutation.isPending}
              style={{
                padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                backgroundColor: '#1e40af', color: '#f1f5f9', fontWeight: 600, fontSize: 13,
                opacity: !input.trim() ? 0.5 : 1,
              }}
            >
              Send
            </button>
          </div>
        </div>

        {/* Right — Tabs: Gates / Versions / Audit */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Tab bar */}
          <div style={{ padding: '0 24px', borderBottom: '1px solid #0f172a', display: 'flex', gap: 0 }}>
            {(['chat', 'gates', 'versions', 'audit'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, color: activeTab === tab ? '#60a5fa' : '#475569',
                  borderBottom: activeTab === tab ? '2px solid #1e40af' : '2px solid transparent',
                  textTransform: 'capitalize',
                }}
              >
                {tab === 'gates' && gates.length > 0 ? `Gates (${gates.length})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {activeTab === 'gates' && (
              <div>
                <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Gate Reviews
                </h3>
                {gates.length === 0 ? (
                  <div style={{ color: '#334155', fontSize: 13 }}>No gates triggered yet.</div>
                ) : (
                  <GatePanel
                    gates={gates}
                    engagementId={id!}
                    userId={user?.id ?? ''}
                    onAction={() => queryClient.invalidateQueries({ queryKey: ['engagement-status', id] })}
                  />
                )}
              </div>
            )}

            {activeTab === 'versions' && (
              <div>
                <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Version History
                </h3>
                {!latestVersion ? (
                  <div style={{ color: '#334155', fontSize: 13 }}>No versions yet.</div>
                ) : (
                  <VersionCard version={latestVersion} engagementId={id!} />
                )}
              </div>
            )}

            {activeTab === 'audit' && (
              <div>
                <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Activity Log
                </h3>
                <AuditTimeline logs={recentActivity} />
              </div>
            )}

            {activeTab === 'chat' && (
              <div style={{ color: '#334155', fontSize: 13, padding: '16px 0' }}>
                Use the chat panel on the left to communicate with the orchestrator.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function VersionCard({ version, engagementId }: { version: import('../../services/api').EngagementVersion; engagementId: string }) {
  const handleDownload = async () => {
    try {
      const result = await artifactsApi.download(engagementId)
      window.open(result.downloadUrl, '_blank')
    } catch { alert('Download failed.') }
  }

  return (
    <div style={{
      padding: 16, borderRadius: 10, backgroundColor: '#0d1526', border: '1px solid #1e293b',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, color: '#f1f5f9' }}>Version {version.version}</span>
        {version.isLatest && <span style={{ fontSize: 11, color: '#34d399', fontWeight: 600 }}>● Latest</span>}
      </div>
      {version.changeReason && (
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{version.changeReason}</div>
      )}
      {version.diffSummary && (
        <div style={{ fontSize: 12, color: '#94a3b8', backgroundColor: '#0f172a', padding: '8px 12px', borderRadius: 6, marginBottom: 10 }}>
          {version.diffSummary}
        </div>
      )}
      <button onClick={handleDownload} style={primaryBtn}>⬇ Download</button>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh', maxHeight: '100vh', display: 'flex', flexDirection: 'column',
  backgroundColor: '#030712', fontFamily: 'system-ui, sans-serif', color: '#f9fafb',
  overflow: 'hidden',
}

const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#475569', fontSize: 13, padding: 0,
}

const primaryBtn: React.CSSProperties = {
  padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
  backgroundColor: '#1e3a5f', color: '#93c5fd', fontWeight: 600, fontSize: 12,
}
