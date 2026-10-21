import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { useSession } from '../../session'
import { Brand } from './Brand'

function NavItem({ to, end, onNavigate, children }: { to: string; end?: boolean; onNavigate: () => void; children: ReactNode }) {
  return <NavLink to={to} end={end} onClick={onNavigate} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>{children}</NavLink>
}

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const session = useSession()
  const mobile = useIsMobile()
  return <aside id="main-menu" className={`sidebar${open ? ' is-open' : ''}`}>
    <Brand />
    <nav className="sidebar-nav" aria-label="Main navigation">
      <div className="sidebar-section-label">Study</div>
      <NavItem to="/" end onNavigate={onNavigate}>Find a certification</NavItem>
      <NavItem to="/intake" onNavigate={onNavigate}>Help me choose</NavItem>
      {/* Not a separate route: Home renders "My certifications" as a section (anchor id "mine") on desktop and as a tab on mobile. */}
      <Link to={mobile ? { pathname: '/', search: '?tab=mine' } : { pathname: '/', hash: 'mine' }} className="nav-link" onClick={onNavigate}>My certifications</Link>
      <div className="sidebar-section-label">Community</div>
      <NavItem to="/library" onNavigate={onNavigate}>Browse library</NavItem>
      <NavItem to="/saved" onNavigate={onNavigate}>Saved resources</NavItem>
      <NavItem to="/community" onNavigate={onNavigate}>Ideas &amp; questions</NavItem>
      <NavItem to="/contributions" onNavigate={onNavigate}>My contributions</NavItem>
      <NavItem to="/leaderboard" onNavigate={onNavigate}>Leaderboard</NavItem>
      {session.isAdmin && <>
        <div className="sidebar-section-label">Admin</div>
        <NavItem to="/admin/reports" onNavigate={onNavigate}>Review queue</NavItem>
        <NavItem to="/admin/ops" onNavigate={onNavigate}>Operations</NavItem>
      </>}
    </nav>
    <div className="sidebar-bottom">
      <NavItem to="/settings" onNavigate={onNavigate}>Settings</NavItem>
      <div className="account-row">
        <span className="avatar" aria-hidden="true">{session.displayName.slice(0, 1).toUpperCase()}</span>
        <span className="account-details"><strong>{session.displayName}</strong><small>{session.isLocal ? 'Local mode' : 'Signed in'}</small></span>
        <button type="button" className="icon-button" aria-label="Sign out" title="Sign out" onClick={() => void session.signOut()}><LogOut size={16} /></button>
      </div>
    </div>
  </aside>
}
