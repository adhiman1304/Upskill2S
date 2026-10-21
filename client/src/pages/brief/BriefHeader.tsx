import { useId, type ReactNode } from 'react'
import { ExternalLink, LoaderCircle, RefreshCw, Sparkles } from 'lucide-react'
import type { Following } from '../../lib/api/briefs'
import type { BriefPageDto, FollowStatus } from '../../lib/contracts'
import { DateField } from '../../components/ui/DateField'
import { Select, type SelectOption } from '../../components/ui/Select'
import { ProviderLogo } from '../legacy/providers'
import { freshnessLabel, safeUrl } from './brief-utils'

const UPDATE_EXPLANATION = 'Runs the research agent again to pick up exam changes and new sources.'
const GENERATE_EXPLANATION = 'Runs the research agent to read the official exam page and community sources and write a cited study brief.'

interface BriefHeaderProps {
  page: BriefPageDto
  fixture: boolean
  starting: boolean
  /** Replaces the controls row while research runs (the job progress panel). */
  jobPanel: ReactNode
  onRefresh: () => void
  onFollowChange: (next: Following) => Promise<void>
}

/** Hero: title line, freshness and official page line, then status, target date and the brief action. */
export function BriefHeader({ page, fixture, starting, jobPanel, onRefresh, onFollowChange }: BriefHeaderProps) {
  const { certification, freshness, brief } = page
  const officialUrl = safeUrl(certification.officialUrl ?? brief?.content.certification.officialUrl)
  return <header className="brief-header">
    <div className="brief-title-row">
      <span className="provider-logo" title={certification.provider}><ProviderLogo name={certification.provider} /></span>
      <h1><span className="brief-code">{certification.code}</span> <span className="brief-title-text">{certification.title}</span></h1>
    </div>
    <div className="brief-header-meta">
      <span className="sr-only">{certification.provider}</span>
      <FreshnessChip freshness={freshness} />
      {certification.status === 'RETIRED' && <span className="chip chip-warning">Retired</span>}
      {fixture && <span className="chip chip-warning">Sample data</span>}
      {officialUrl && <a href={officialUrl} target="_blank" rel="noopener noreferrer">Official exam page <ExternalLink size={12} aria-hidden="true" /></a>}
    </div>
    {jobPanel ?? <div className="brief-controls">
      <FollowControl following={page.following} onChange={onFollowChange} />
      <BriefAction hasBrief={Boolean(brief)} starting={starting} onRun={onRefresh} />
    </div>}
  </header>
}

/** "Update brief" (quiet, secondary) or, with no brief yet, "Generate study brief" (primary), with a one-line explanation. */
function BriefAction({ hasBrief, starting, onRun }: { hasBrief: boolean; starting: boolean; onRun: () => void }) {
  const hintId = useId()
  const explanation = hasBrief ? UPDATE_EXPLANATION : GENERATE_EXPLANATION
  return <div className={`brief-action-wrap${hasBrief ? '' : ' is-generate'}`}>
    <button type="button" className={`button ${hasBrief ? 'button-secondary' : 'button-primary'} brief-run`} aria-describedby={hintId} onClick={onRun} disabled={starting}>
      {starting ? <LoaderCircle className="spin" size={15} aria-hidden="true" /> : hasBrief ? <RefreshCw size={15} aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />}
      {hasBrief ? 'Update brief' : 'Generate study brief'}
    </button>
    <span id={hintId} className="brief-run-hint" role="tooltip">{explanation}</span>
  </div>
}

export function FreshnessChip({ freshness }: { freshness: BriefPageDto['freshness'] }) {
  const title = freshness.status === 'missing' ? 'No study brief has been generated yet.' : `Briefs older than ${freshness.staleAfterDays} days are marked stale.`
  return <span className={`chip is-${freshness.status}`} title={title}><span className="chip-dot" aria-hidden="true" />{freshnessLabel(freshness)}</span>
}

type FollowValue = FollowStatus | 'NONE'
const followOptions: SelectOption<FollowValue>[] = [
  { value: 'NONE', label: 'Not following', description: 'Not on My certifications' },
  { value: 'PLANNING', label: 'Planning', description: 'Want to take it later' },
  { value: 'STUDYING', label: 'Studying', description: 'Working through the checklist' },
  { value: 'PASSED', label: 'Passed', description: 'Already hold it' },
]

function FollowControl({ following, onChange }: { following: Following; onChange: (next: Following) => Promise<void> }) {
  const save = (next: Following) => onChange(next)
  return <div className="brief-follow">
    <Select<FollowValue> className="brief-status" label="Status" value={following?.status ?? 'NONE'} options={followOptions}
      onChange={(value) => void save(value === 'NONE' ? null : { status: value, targetDate: following?.targetDate ?? null })} />
    {following && following.status !== 'PASSED' && <DateField className="brief-target" label="Target date" value={following.targetDate}
      onChange={(value) => void save({ status: following.status, targetDate: value })} />}
  </div>
}
