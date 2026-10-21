import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Menu, X } from 'lucide-react'
import { routeTitle } from '../../hooks/useDocumentTitle'
import { ApiKeyBanner } from './ApiKeyBanner'
import { Brand } from './Brand'
import { Sidebar } from './Sidebar'

export function AppShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  // Detail pages get a back arrow in the mobile top bar.
  const showBack = pathname.startsWith('/certifications/') || pathname.startsWith('/intake/')
  function goBack() {
    setMenuOpen(false)
    // React Router stores the entry index in history.state; idx 0 means this app was opened on this page.
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (index > 0) navigate(-1)
    else navigate('/')
  }
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])
  return <div className="app-shell">
    <header className={`mobile-bar${showBack ? ' has-back' : ''}`}>
      {showBack && <button type="button" className="icon-button mobile-bar-back" aria-label="Back" onClick={goBack}><ArrowLeft size={22} /></button>}
      <Brand />
      <span className="mobile-bar-title">{routeTitle(pathname)}</span>
      <button type="button" className="icon-button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="main-menu" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
    </header>
    <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
    <main className="main-area"><ApiKeyBanner /><Outlet /></main>
  </div>
}
