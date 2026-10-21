import { useState, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import './Portal.css'
import './ProviderDirectory.css'
import './Features.css'
import './Community.css'
import { SessionProvider, useSession } from './session'
import { AppShell } from './components/layout/AppShell'
import { LoginScreen } from './components/layout/LoginScreen'
import { HomePage } from './pages/home/HomePage'
import { IntakePage } from './pages/intake/IntakePage'
import { IntakeResultPage } from './pages/intake/IntakeResultPage'
import { BriefPage } from './pages/brief/BriefPage'
import { SettingsPage } from './pages/settings/SettingsPage'
import { AdminOpsPage } from './pages/admin/AdminOpsPage'
import { LibraryPage } from './pages/legacy/LibraryPage'
import { CertificationDetailPage } from './pages/legacy/CertificationDetailPage'
import { SavedResourcesPage } from './pages/legacy/SavedResourcesPage'
import { CommunityPage } from './pages/legacy/CommunityPage'
import { ContributionsPage } from './pages/legacy/ContributionsPage'
import { LeaderboardPage } from './pages/legacy/LeaderboardPage'
import { AdminReportsPage } from './pages/legacy/AdminReportsPage'

export default function Portal() {
  return <BrowserRouter><SessionProvider><Routes>
    <Route element={<RequireAuth><AppShell /></RequireAuth>}>
      <Route index element={<HomePage />} />
      <Route path="intake" element={<IntakePage />} />
      <Route path="intake/:id" element={<IntakeResultPage />} />
      <Route path="certifications/:id" element={<BriefPage />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="library" element={<LibraryPage />} />
      <Route path="library/:id" element={<CertificationDetailPage />} />
      <Route path="saved" element={<SavedResourcesPage />} />
      <Route path="community" element={<CommunityPage />} />
      <Route path="contributions" element={<ContributionsPage />} />
      <Route path="leaderboard" element={<LeaderboardPage />} />
      <Route path="admin/reports" element={<RequireAdmin><AdminReportsPage /></RequireAdmin>} />
      <Route path="admin/ops" element={<RequireAdmin><AdminOpsPage /></RequireAdmin>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes></SessionProvider></BrowserRouter>
}

function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession()
  const [signInError, setSignInError] = useState('')
  async function signIn() {
    setSignInError('')
    try { await session.signIn() }
    catch { setSignInError('Sign-in did not complete. Check your company account and app registration.') }
  }
  if (!session.authenticated) return <LoginScreen onSignIn={() => void signIn()} error={signInError} />
  return children
}

// UI gate only; the API enforces admin access server-side.
function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useSession()
  if (!isAdmin) return <div className="page-content"><div className="empty-state"><div className="empty-icon"><ShieldCheck size={22} /></div><h3>Not authorized</h3><p>This page is available to administrators only.</p></div></div>
  return children
}
