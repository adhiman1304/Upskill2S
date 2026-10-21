import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import type { OpenAiKeyStatusDto } from '../../lib/contracts'
import { useApi } from '../../session'

/** Slim prompt to add a BYO OpenAI key. Renders nothing on any error (endpoint may be missing or 501). */
export function ApiKeyBanner() {
  const request = useApi()
  const onSettings = useLocation().pathname === '/settings'
  const [missing, setMissing] = useState(false)
  // Checked on mount and again after leaving /settings, so saving a key there clears the banner.
  useEffect(() => {
    if (onSettings) return
    let active = true
    request<OpenAiKeyStatusDto>('/api/settings/openai-key').then((status) => { if (active) setMissing(status?.configured === false) }).catch(() => { if (active) setMissing(false) })
    return () => { active = false }
  }, [onSettings, request])
  if (onSettings || !missing) return null
  return <div className="api-key-banner" role="status"><KeyRound size={15} aria-hidden="true" /><span>Add your OpenAI API key to generate study briefs</span><Link to="/settings">Open settings</Link></div>
}
