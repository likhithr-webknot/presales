import { useAuth } from '../../hooks/useAuth'

export default function DashboardPage() {
  const { user } = useAuth()
  return (
    <div style={{ padding: 32, fontFamily: 'system-ui, sans-serif', backgroundColor: '#0a0f1e', minHeight: '100vh', color: '#f9fafb' }}>
      <h1 style={{ color: '#f9fafb' }}>Presales Dashboard</h1>
      <p style={{ color: '#6b7280' }}>Welcome, {user?.name}. Engagement list coming in Sprint 7.</p>
    </div>
  )
}
