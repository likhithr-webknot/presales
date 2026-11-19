import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import AppShell from './components/layout/AppShell'
import LoginPage from './pages/Login'
import OverviewPage from './pages/Overview'
import OpportunitiesPage from './pages/Opportunities'
import RequirementsPage from './pages/Requirements'
import EngagementPage from './pages/Engagement'
import ApprovalsPage from './pages/Approvals'
import EstimationPage from './pages/Estimation'
import ProposalPage from './pages/Proposal'
import ApprovalsInboxPage from './pages/ApprovalsInbox'
import CopilotPage from './pages/Copilot'
import FoundationsPage from './pages/Foundations'
import AdminPage from './pages/Admin'

function AuthGuard() {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ padding: 32 }}>Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/approvals/:token" element={<ApprovalsPage />} />
      <Route element={<AuthGuard />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<OverviewPage />} />
          <Route path="/opportunities" element={<OpportunitiesPage />} />
          <Route path="/requirements" element={<RequirementsPage />} />
          <Route path="/engagements/:id" element={<EngagementPage />} />
          <Route path="/estimations" element={<EstimationPage />} />
          <Route path="/proposals" element={<ProposalPage />} />
          <Route path="/approvals" element={<ApprovalsInboxPage />} />
          <Route path="/copilot" element={<CopilotPage />} />
          <Route path="/foundations" element={<FoundationsPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
