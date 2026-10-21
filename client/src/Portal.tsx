import { useState, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { SessionProvider, useSession } from './session'
import { useDocumentTitle } from './hooks/useDocumentTitle'
import { AppShell } from './components/layout/AppShell'
import { LoginScreen } from './components/layout/LoginScreen'
import { HomePage } from './pages/home/HomePage'
import { IntakePage } from './pages/intake/IntakePage'
import { IntakeResultPage } from './pages/intake/IntakeResultPage'
import { BriefPage } from './pages/brief/BriefPage'
import { MyCertificationsPage } from './pages/my/MyCertificationsPage'
import { SettingsPage } from './pages/settings/SettingsPage'
import { AdminHubPage } from './pages/admin/AdminHubPage'
import { CommunityHubPage } from './pages/community/CommunityHubPage'
import { CertificationDetailPage } from './pages/legacy/CertificationDetailPage'

export default function Portal() {
  return <BrowserRouter><SessionProvider><Routes>
    <Route element={<RequireAuth><AppShell /></RequireAuth>}>
      <Route index element={<HomePage />} />
      <Route path="intake" element={<IntakePage />} />
      <Route path="intake/:id" element={<IntakeResultPage />} />
      <Route path="certifications/:id" element={<BriefPage />} />
      <Route path="my-certifications" element={<MyCertificationsPage />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="community" element={<CommunityHubPage />} />
      <Route path="library/:id" element={<CertificationDetailPage />} />
      <Route path="admin" element={<RequireAdmin><AdminHubPage /></RequireAdmin>} />
      {/* Older standalone pages now live as hub tabs. */}
      <Route path="library" element={<RedirectToTab to="/community" tab="library" />} />
      <Route path="saved" element={<RedirectToTab to="/community" tab="saved" />} />
      <Route path="contributions" element={<RedirectToTab to="/community" tab="contributions" />} />
      <Route path="leaderboard" element={<RedirectToTab to="/community" tab="leaderboard" />} />
      <Route path="admin/ops" element={<RedirectToTab to="/admin" tab="operations" />} />
      <Route path="admin/reports" element={<RedirectToTab to="/admin" tab="review" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes></SessionProvider></BrowserRouter>
}

/** Redirects an old route to a hub tab, keeping any other search params (for example `?provider=`). */
function RedirectToTab({ to, tab }: { to: string; tab: string }) {
  const { search } = useLocation()
  const params = new URLSearchParams(search)
  params.set('tab', tab)
  return <Navigate to={`${to}?${params.toString()}`} replace />
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
  if (!isAdmin) return <NotAuthorized />
  return children
}

function NotAuthorized() {
  useDocumentTitle('Not authorized')
  return <div className="page-content"><div className="empty-state"><ShieldCheck className="empty-icon" size={20} aria-hidden="true" /><h3>Not authorized</h3><p>This page is available to administrators only.</p></div></div>
}
