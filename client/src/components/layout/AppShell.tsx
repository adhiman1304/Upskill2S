import { Outlet } from 'react-router-dom'
import { ApiKeyBanner } from './ApiKeyBanner'
import { Sidebar } from './Sidebar'
import './layout.css'

export function AppShell() {
  return <div className="app-shell"><Sidebar /><main className="main-area"><ApiKeyBanner /><Outlet /></main></div>
}
