import { useState } from 'react'
import { ExternalLink, History, LoaderCircle, RefreshCw } from 'lucide-react'
import type { Following } from '../../lib/api/briefs'
import type { BriefPageDto, FollowStatus } from '../../lib/contracts'
import { ProviderLogo } from '../legacy/providers'
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
    <div className="brief-title-row">
      <span className="provider-logo" title={certification.provider}><ProviderLogo name={certification.provider} /></span>
      <h1><span className="brief-code">{certification.code}</span> {certification.title}{certification.status === 'RETIRED' && <span className="chip chip-warning">Retired</span>}{fixture && <span className="chip chip-warning">Sample data</span>}</h1>
    </div>
    <div className="brief-header-meta">
      <span className="sr-only">{certification.provider}</span>
      <FreshnessChip freshness={freshness} />
      {officialUrl && <a href={officialUrl} target="_blank" rel="noopener noreferrer">Official exam page <ExternalLink size={12} aria-hidden="true" /></a>}
      {brief && <button type="button" className="text-button brief-versions-button" onClick={onOpenVersions}><History size={14} aria-hidden="true" /> Version {brief.version}<span className="brief-source-count"> · {brief.sourceCount} sources</span></button>}
    </div>
    <div className="brief-controls">
      <FollowControl following={page.following} onChange={onFollowChange} />
      <button type="button" className="button button-primary brief-refresh" onClick={onRefresh} disabled={refreshing || jobRunning}>
        {refreshing || jobRunning ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />} {jobRunning ? 'Researching' : brief ? 'Refresh' : 'Generate'}
      </button>
    </div>
  </header>
}

export function FreshnessChip({ freshness }: { freshness: BriefPageDto['freshness'] }) {
  const title = freshness.status === 'missing' ? 'No study brief has been generated yet.' : `Briefs older than ${freshness.staleAfterDays} days are marked stale.`
  return <span className={`chip is-${freshness.status}`} title={title}><span className="chip-dot" aria-hidden="true" />{freshnessLabel(freshness)}</span>
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
    <label className="inline-field">
      <span>Status</span>
      <select value={following?.status ?? ''} disabled={saving} onChange={(event) => {
        const value = event.target.value as FollowStatus | ''
        void save(value ? { status: value, targetDate: following?.targetDate ?? null } : null)
      }}>
        <option value="">Not following</option>
        {followOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
    {following && following.status !== 'PASSED' && <label className="inline-field">
      <span>Target date</span>
      <input type="date" value={following.targetDate ?? ''} disabled={saving} onChange={(event) => void save({ status: following.status, targetDate: event.target.value || null })} />
    </label>}
  </div>
}
