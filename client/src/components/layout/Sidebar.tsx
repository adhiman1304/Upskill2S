import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Activity, Award, Bookmark, BookOpen, Compass, Flag, LibraryBig, LogOut, MessagesSquare, Search, Settings, Sparkles, Trophy } from 'lucide-react'
import { useSession } from '../../session'
import { Brand } from './Brand'

function NavItem({ to, end, icon, children }: { to: string; end?: boolean; icon: ReactNode; children: ReactNode }) {
  return <NavLink to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>{icon} {children}</NavLink>
}

export function Sidebar() {
  const session = useSession()
  return <aside className="sidebar">
    <Brand />
    <nav className="sidebar-nav" aria-label="Main navigation">
      <div className="sidebar-section-label">STUDY</div>
      <NavItem to="/" end icon={<Search size={17} />}>Find a certification</NavItem>
      <NavItem to="/intake" icon={<Compass size={17} />}>Help me choose</NavItem>
      {/* Not a separate route: Home renders the "My certifications" section (anchor id "mine"). */}
      <Link to={{ pathname: '/', hash: 'mine' }} className="nav-link"><BookOpen size={17} /> My certifications</Link>
      <div className="sidebar-section-label">COMMUNITY</div>
      <NavItem to="/library" icon={<LibraryBig size={17} />}>Browse library</NavItem>
      <NavItem to="/saved" icon={<Bookmark size={17} />}>Saved resources</NavItem>
      <NavItem to="/community" icon={<MessagesSquare size={17} />}>Ideas &amp; questions</NavItem>
      <NavItem to="/contributions" icon={<Award size={17} />}>My contributions</NavItem>
      <NavItem to="/leaderboard" icon={<Trophy size={17} />}>Leaderboard</NavItem>
      {session.isAdmin && <>
        <div className="sidebar-section-label">ADMIN</div>
        <NavItem to="/admin/reports" icon={<Flag size={17} />}>Review queue</NavItem>
        <NavItem to="/admin/ops" icon={<Activity size={17} />}>Operations</NavItem>
      </>}
    </nav>
    <div className="sidebar-bottom">
      <NavItem to="/settings" icon={<Settings size={17} />}>Settings</NavItem>
      <div className="sidebar-note"><Sparkles size={15} /><span>{session.isLocal ? 'Local development mode' : 'Build your next skill path'}</span></div>
      <button className="account-button" onClick={() => void session.signOut()}><span className="avatar">{session.displayName.slice(0, 1).toUpperCase()}</span><span className="account-details"><strong>{session.displayName}</strong><small>{session.isLocal ? 'Authentication disabled' : 'Signed in'}</small></span><LogOut size={15} /></button>
    </div>
  </aside>
}
