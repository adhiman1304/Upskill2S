import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { BookmarkCheck, Compass, LogOut, Search, Settings, ShieldCheck, Users, type LucideIcon } from 'lucide-react'
import { useSession } from '../../session'
import { Brand } from './Brand'

/**
 * Two tiers: the primary trio (the core product) as large items, then quiet secondary items.
 * `match` widens the active state to related paths (for example `/library/:id` belongs to Community).
 */
function NavItem({ to, end, match, icon: Icon, tier, onNavigate, children }: { to: string; end?: boolean; match?: (pathname: string) => boolean; icon: LucideIcon; tier: 'primary' | 'secondary'; onNavigate: () => void; children: ReactNode }) {
  const { pathname } = useLocation()
  return <NavLink to={to} end={end} onClick={onNavigate} className={({ isActive }) => `nav-link nav-link-${tier}${isActive || match?.(pathname) ? ' active' : ''}`}>
    <Icon size={tier === 'primary' ? 18 : 16} aria-hidden="true" className="nav-icon" />
    <span className="nav-label">{children}</span>
  </NavLink>
}

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const session = useSession()
  return <aside id="main-menu" className={`sidebar${open ? ' is-open' : ''}`}>
    <Brand />
    <nav className="sidebar-nav" aria-label="Main navigation">
      <div className="nav-group nav-group-primary">
        <NavItem to="/" end tier="primary" icon={Search} onNavigate={onNavigate}>Find a certification</NavItem>
        <NavItem to="/intake" tier="primary" icon={Compass} onNavigate={onNavigate}>Help me choose</NavItem>
        <NavItem to="/my-certifications" tier="primary" icon={BookmarkCheck} onNavigate={onNavigate}>My certifications</NavItem>
      </div>
      <hr className="sidebar-divider" />
      <div className="nav-group nav-group-secondary">
        <NavItem to="/community" tier="secondary" icon={Users} match={(path) => path.startsWith('/library/')} onNavigate={onNavigate}>Community</NavItem>
        {session.isAdmin && <NavItem to="/admin" tier="secondary" icon={ShieldCheck} onNavigate={onNavigate}>Admin</NavItem>}
      </div>
    </nav>
    <div className="sidebar-bottom">
      <NavItem to="/settings" tier="secondary" icon={Settings} onNavigate={onNavigate}>Settings</NavItem>
      <div className="account-row">
        <span className="avatar" aria-hidden="true">{session.displayName.slice(0, 1).toUpperCase()}</span>
        <span className="account-details"><strong>{session.displayName}</strong><small>{session.isLocal ? 'Local mode' : 'Signed in'}</small></span>
        <button type="button" className="icon-button" aria-label="Sign out" title="Sign out" onClick={() => void session.signOut()}><LogOut size={16} /></button>
      </div>
    </div>
  </aside>
}
