import { Check, Clock, X } from 'lucide-react'
import type { FeedbackItemType, FeedbackVerdict } from '../../lib/api/briefs'
import { useBriefView } from './brief-context'
import { emptyFeedback, safeUrl } from './brief-utils'

const verdicts: { verdict: FeedbackVerdict; label: string; Icon: typeof Check }[] = [
  { verdict: 'accurate', label: 'Accurate', Icon: Check },
  { verdict: 'inaccurate', label: 'Inaccurate', Icon: X },
  { verdict: 'outdated', label: 'Outdated', Icon: Clock },
]

/** Compact accurate / inaccurate / outdated vote with counts; highlights the user's own verdict. */
export function FeedbackControl({ itemType, itemId }: { itemType: FeedbackItemType; itemId: string }) {
  const { feedback, readOnly, pendingVotes, onVote } = useBriefView()
  const key = `${itemType}:${itemId}`
  const summary = feedback[key] ?? emptyFeedback()
  const pending = pendingVotes.has(key)
  return <div className="brief-feedback" role="group" aria-label="Is this accurate?">
    {verdicts.map(({ verdict, label, Icon }) => {
      const mine = summary.mine === verdict
      return <button key={verdict} type="button" className={`brief-vote vote-${verdict}${mine ? ' is-mine' : ''}`} aria-pressed={mine} title={mine ? `You marked this ${label.toLowerCase()}` : `Mark as ${label.toLowerCase()}`} disabled={readOnly || pending} onClick={() => onVote(itemType, itemId, verdict)}>
        <Icon size={11} aria-hidden="true" /><span className="sr-only">{label}</span>{summary[verdict] > 0 && <span className="brief-vote-count">{summary[verdict]}</span>}
      </button>
    })}
  </div>
}

/** Small numbered chips linking to the cited sources. */
export function SourceChips({ ids }: { ids: string[] }) {
  const { sources } = useBriefView()
  const chips = ids.map((id) => sources.get(id)).filter((entry) => entry !== undefined)
  if (!chips.length) return null
  return <span className="brief-source-chips">
    {chips.map(({ n, source }) => {
      const href = safeUrl(source.url)
      return href
        ? <a key={source.id} className="brief-source-chip" href={href} target="_blank" rel="noopener noreferrer" title={`${source.title}${source.publisher ? ` (${source.publisher})` : ''}`}>{n}</a>
        : <span key={source.id} className="brief-source-chip" title={source.title}>{n}</span>
    })}
  </span>
}
