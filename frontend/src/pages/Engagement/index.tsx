import { useParams } from 'react-router-dom'

export default function EngagementPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <div style={{ padding: 32, fontFamily: 'system-ui, sans-serif', color: '#f9fafb', backgroundColor: '#0a0f1e', minHeight: '100vh' }}>
      <h1>Engagement</h1>
      <p style={{ color: '#6b7280' }}>Engagement ID: {id} — Full UI coming in Sprint 7.</p>
    </div>
  )
}
