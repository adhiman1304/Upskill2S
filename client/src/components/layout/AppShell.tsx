import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { routeTitle } from '../../hooks/useDocumentTitle'
import { ApiKeyBanner } from './ApiKeyBanner'
import { Brand } from './Brand'
import { Sidebar } from './Sidebar'

export function AppShell() {
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])
  return <div className="app-shell">
    <header className="mobile-bar">
      <Brand />
      <span className="mobile-bar-title">{routeTitle(pathname)}</span>
      <button type="button" className="icon-button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="main-menu" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
    </header>
    <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
    <main className="main-area"><ApiKeyBanner /><Outlet /></main>
  </div>
}
