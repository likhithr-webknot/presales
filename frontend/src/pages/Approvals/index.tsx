import { useParams } from 'react-router-dom'

export default function ApprovalsPage() {
  const { token } = useParams<{ token: string }>()
  return (
    <div style={{ padding: 32, fontFamily: 'system-ui, sans-serif', color: '#f9fafb', backgroundColor: '#0a0f1e', minHeight: '100vh' }}>
      <h1>Gate Review</h1>
      <p style={{ color: '#6b7280' }}>Reviewer token: {token} — Gate approval UI coming in Sprint 7.</p>
    </div>
  )
}
