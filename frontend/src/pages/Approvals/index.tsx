/**
 * Approvals page — accessed via email token link.
 *
 * NOTE: The token-based external reviewer flow is a Sprint 8 backend feature.
 * Until POST /api/approvals/token/:token is built, we redirect authenticated
 * users to their dashboard with instructions to approve via the Gates tab.
 * Unauthenticated visitors get a clear message.
 */
import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function ApprovalsPage() {
  const { token } = useParams<{ token: string }>()
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  // B-01 fix: redirect authenticated users to dashboard with context
  // Token-based approval endpoint (POST /api/approvals/token/:token) is Sprint 8.
  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true, state: { approvalToken: token, message: 'Please open the relevant engagement and approve via the Gates tab.' } })
    }
  }, [loading, user, navigate, token])

  if (loading) {
    return (
      <div style={centeredPage}>
        <div style={{ color: '#475569' }}>Loading…</div>
      </div>
    )
  }

  if (user) return null // redirect in progress

  // Not logged in — show sign-in prompt
  return (
    <div style={centeredPage}>
      <div style={{
        width: 440, padding: 36, borderRadius: 16,
        backgroundColor: '#0a0f1e', border: '1px solid #1e293b',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: '0 0 8px' }}>
          Gate Review Required
        </h1>
        <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 24px', lineHeight: 1.6 }}>
          You've been invited to review a presales deliverable.
          Please sign in with your Webknot Google account to access the review.
        </p>
        <a
          href={`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/auth/google?returnTo=/approvals/${token}`}
          style={{
            display: 'block', padding: '11px 0', borderRadius: 8, textDecoration: 'none',
            backgroundColor: '#1e40af', color: '#f1f5f9', fontWeight: 600, fontSize: 14,
          }}
        >
          Sign in with Google
        </a>
      </div>
    </div>
  )
}

const centeredPage: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  backgroundColor: '#030712', fontFamily: 'system-ui, sans-serif', color: '#f9fafb',
}
