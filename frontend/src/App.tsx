import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/Login'
import DashboardPage from './pages/Dashboard'
import EngagementPage from './pages/Engagement'
import ApprovalsPage from './pages/Approvals'
import AdminPage from './pages/Admin'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ padding: 32 }}>Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/approvals/:token" element={<ApprovalsPage />} />
      <Route
        path="/dashboard"
        element={<AuthGuard><DashboardPage /></AuthGuard>}
      />
      <Route
        path="/engagements/:id"
        element={<AuthGuard><EngagementPage /></AuthGuard>}
      />
      <Route
        path="/admin"
        element={<AuthGuard><AdminPage /></AuthGuard>}
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
