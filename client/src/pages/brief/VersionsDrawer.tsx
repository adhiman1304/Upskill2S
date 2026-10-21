import { useEffect, useState } from 'react'
import { LoaderCircle, X } from 'lucide-react'
import type { BriefVersionSummary } from '../../lib/contracts'
import { formatDate, message } from '../legacy/utils'

interface VersionsDrawerProps {
  load: () => Promise<BriefVersionSummary[]>
  viewingId: string | null
  onSelect: (version: BriefVersionSummary) => void
  onClose: () => void
}

/** Side drawer listing brief versions, newest first. Selecting an older one shows it read only. */
export function VersionsDrawer({ load, viewingId, onSelect, onClose }: VersionsDrawerProps) {
  const [versions, setVersions] = useState<BriefVersionSummary[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    load().then((data) => { if (active) setVersions(data) }).catch((reason: unknown) => { if (active) setError(message(reason, 'Could not load versions.')) })
    return () => { active = false }
  }, [load])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return <div className="brief-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <aside className="brief-drawer" role="dialog" aria-modal="true" aria-labelledby="brief-versions-title">
      <div className="brief-drawer-head"><h2 id="brief-versions-title">Brief versions</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Close versions"><X size={16} /></button></div>
      {error && <div className="alert error">{error}</div>}
      {!versions && !error && <div className="loading-state"><LoaderCircle className="spin" size={18} /> Loading versions</div>}
      {versions && <ol className="brief-version-list">
        {versions.map((version) => {
          const active = viewingId ? viewingId === version.id : version.status === 'CURRENT'
          return <li key={version.id}>
            <button type="button" className={active ? 'is-active' : ''} onClick={() => onSelect(version)}>
              <strong>Version {version.version}</strong>
              {version.status === 'CURRENT' && <span className="chip chip-accent">Current</span>}
              <span>{formatDate(version.generatedAt)} · {version.sourceCount} sources · {version.model}</span>
            </button>
          </li>
        })}
      </ol>}
    </aside>
  </div>
}
