import { useState } from 'react'
import { ExternalLink, History, LoaderCircle, RefreshCw } from 'lucide-react'
import type { Following } from '../../lib/api/briefs'
import type { BriefPageDto, FollowStatus } from '../../lib/contracts'
import { freshnessLabel, safeUrl } from './brief-utils'

interface BriefHeaderProps {
  page: BriefPageDto
  fixture: boolean
  refreshing: boolean
  jobRunning: boolean
  onRefresh: () => void
  onOpenVersions: () => void
  onFollowChange: (next: Following) => Promise<void>
}

export function BriefHeader({ page, fixture, refreshing, jobRunning, onRefresh, onOpenVersions, onFollowChange }: BriefHeaderProps) {
  const { certification, freshness, brief } = page
  const officialUrl = safeUrl(certification.officialUrl ?? brief?.content.certification.officialUrl)
  return <header className="brief-header">
    <div className="detail-title">
      <span className="provider-glyph glyph-1 large-glyph">{certification.provider.slice(0, 1).toUpperCase()}</span>
      <div>
        <p className="breadcrumb">{certification.provider.toUpperCase()} <span>/</span> {certification.code}{fixture && <span className="brief-sample-tag">Sample data</span>}</p>
        <h1>{certification.title}{certification.status === 'RETIRED' && <span className="status-label retired">Retired</span>}</h1>
        <div className="brief-header-meta">
          <FreshnessChip freshness={freshness} />
          {officialUrl && <a className="brief-official-link" href={officialUrl} target="_blank" rel="noopener noreferrer">Official exam page <ExternalLink size={12} /></a>}
          {brief && <span className="brief-version-meta">Version {brief.version} · {brief.sourceCount} sources</span>}
        </div>
      </div>
    </div>
    <div className="brief-header-actions">
      <FollowControl following={page.following} onChange={onFollowChange} />
      <div className="brief-header-buttons">
        {brief && <button type="button" className="button button-secondary" onClick={onOpenVersions}><History size={15} /> Versions</button>}
        <button type="button" className="button button-primary" onClick={onRefresh} disabled={refreshing || jobRunning}>
          {refreshing || jobRunning ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />} {jobRunning ? 'Researching' : brief ? 'Refresh' : 'Generate'}
        </button>
      </div>
    </div>
  </header>
}

export function FreshnessChip({ freshness }: { freshness: BriefPageDto['freshness'] }) {
  const title = freshness.status === 'missing' ? 'No study brief has been generated yet.' : `Briefs older than ${freshness.staleAfterDays} days are marked stale.`
  return <span className={`brief-freshness is-${freshness.status}`} title={title}><span className="status-dot" aria-hidden="true" />{freshnessLabel(freshness)}</span>
}

const followOptions: { value: FollowStatus; label: string }[] = [
  { value: 'PLANNING', label: 'Planning' },
  { value: 'STUDYING', label: 'Studying' },
  { value: 'PASSED', label: 'Passed' },
]

function FollowControl({ following, onChange }: { following: Following; onChange: (next: Following) => Promise<void> }) {
  const [saving, setSaving] = useState(false)
  async function save(next: Following) {
    setSaving(true)
    try { await onChange(next) } finally { setSaving(false) }
  }
  return <div className="brief-follow">
    <label className="brief-follow-field">
      <span>My status</span>
      <select value={following?.status ?? ''} disabled={saving} onChange={(event) => {
        const value = event.target.value as FollowStatus | ''
        void save(value ? { status: value, targetDate: following?.targetDate ?? null } : null)
      }}>
        <option value="">Not following</option>
        {followOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
    {following && following.status !== 'PASSED' && <label className="brief-follow-field">
      <span>Target date</span>
      <input type="date" value={following.targetDate ?? ''} disabled={saving} onChange={(event) => void save({ status: following.status, targetDate: event.target.value || null })} />
    </label>}
  </div>
}
