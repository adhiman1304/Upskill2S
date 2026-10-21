import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import type { OpenAiKeyStatusDto } from '../../lib/contracts'
import { useApi } from '../../session'

/** One-line, dismissible prompt to add a BYO OpenAI key. Renders nothing on any error (endpoint may be missing or 501). */
export function ApiKeyBanner() {
  const request = useApi()
  const onSettings = useLocation().pathname === '/settings'
  const [missing, setMissing] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  // Checked on mount and again after leaving /settings, so saving a key there clears the banner.
  useEffect(() => {
    if (onSettings) return
    let active = true
    request<OpenAiKeyStatusDto>('/api/settings/openai-key').then((status) => { if (active) setMissing(status?.configured === false) }).catch(() => { if (active) setMissing(false) })
    return () => { active = false }
  }, [onSettings, request])
  if (onSettings || !missing || dismissed) return null
  return <div className="api-key-banner" role="status">
    <span className="api-key-banner-text">Add your OpenAI key in <Link to="/settings">Settings</Link> to generate briefs</span>
    <button type="button" className="icon-button" aria-label="Dismiss" onClick={() => setDismissed(true)}><X size={16} /></button>
  </div>
}
