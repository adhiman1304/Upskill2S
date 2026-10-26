import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { ExternalLink, Flag, Link2, LoaderCircle, Star } from 'lucide-react'
import type { BriefSource, FeedbackItemType, FeedbackReportReason } from '../../lib/contracts'
import { Select } from '../../components/ui/Select'
import { usePopover } from '../../components/ui/usePopover'
import { formatDate } from '../legacy/utils'
import { useBriefView } from './brief-context'
import { emptyFeedback, reportReasons, safeUrl } from './brief-utils'

const COMMENT_MIN = 3
const COMMENT_MAX = 500

/**
 * One compact meta row for an item: `info` (type, duration, links) on the left; on the right the sources button,
 * a quiet star (recommend; filled when it is yours, with the count above zero) and a flag that opens a compact
 * inline report form (reason, comment, Send) under the row. Star and flag are hidden when viewing an older version.
 */
export function ItemMeta({ itemType, itemId, title, sourceIds, children }: { itemType: FeedbackItemType; itemId: string; title: string; sourceIds: string[]; children?: ReactNode }) {
  return <div className="brief-item-meta">
    <span className="brief-meta-info">{children}</span>
    <ItemActions itemType={itemType} itemId={itemId} title={title} sourceIds={sourceIds} />
  </div>
}

function ItemActions({ itemType, itemId, title, sourceIds }: { itemType: FeedbackItemType; itemId: string; title: string; sourceIds: string[] }) {
  const { feedback, readOnly, pendingVotes, onStar, onReport } = useBriefView()
  const [reporting, setReporting] = useState(false)
  const [reported, setReported] = useState(false)
  if (readOnly) return <span className="brief-actions"><SourcesButton ids={sourceIds} /></span>
  const key = `${itemType}:${itemId}`
  const summary = feedback[key] ?? emptyFeedback()
  const pending = pendingVotes.has(key)
  const starred = summary.mine === 'star'
  const flagged = summary.mine === 'report'
  return <>
    <span className="brief-actions">
      <SourcesButton ids={sourceIds} />
      <button type="button" className={`brief-action${starred ? ' is-starred' : ''}`} aria-pressed={starred} disabled={pending}
        aria-label={starred ? `Remove your recommendation of ${title}` : `Recommend ${title}`} title={starred ? 'You recommend this. Click to undo.' : 'Recommend this'}
        onClick={() => onStar(itemType, itemId)}>
        <Star size={15} aria-hidden="true" fill={starred ? 'currentColor' : 'none'} />
        {summary.stars > 0 && <span className="brief-action-count">{summary.stars}</span>}
      </button>
      <button type="button" className={`brief-action${flagged || reporting ? ' is-flagged' : ''}`} aria-expanded={reporting} disabled={pending}
        aria-label={flagged ? `You reported a problem with ${title}. Report again` : `Report a problem with ${title}`} title={flagged ? 'You reported a problem' : 'Report a problem'}
        onClick={() => { setReporting((value) => !value); setReported(false) }}>
        <Flag size={15} aria-hidden="true" fill={flagged ? 'currentColor' : 'none'} />
      </button>
    </span>
    {reported && !reporting && <span className="brief-report-thanks" role="status">Thanks, we will look at it.</span>}
    {reporting && <ReportForm onCancel={() => setReporting(false)} onSend={async (reason, comment) => {
      const ok = await onReport(itemType, itemId, reason, comment)
      if (ok) { setReporting(false); setReported(true) }
      return ok
    }} />}
  </>
}

function ReportForm({ onCancel, onSend }: { onCancel: () => void; onSend: (reason: FeedbackReportReason, comment: string) => Promise<boolean> }) {
  const [reason, setReason] = useState<FeedbackReportReason>('wrong')
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const commentId = useId()
  const reasonId = useId()
  const trimmed = comment.trim()
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (trimmed.length < COMMENT_MIN) return
    setSending(true)
    try { await onSend(reason, trimmed) } finally { setSending(false) }
  }
  return <form className="brief-report-form" onSubmit={(event) => void submit(event)}>
    <span id={reasonId} className="sr-only">Reason</span>
    <Select<FeedbackReportReason> size="sm" labelledBy={reasonId} value={reason} options={reportReasons} onChange={setReason} />
    <label className="sr-only" htmlFor={commentId}>What is wrong?</label>
    <input id={commentId} type="text" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="What is wrong? (required)" minLength={COMMENT_MIN} maxLength={COMMENT_MAX} required autoFocus />
    <span className="brief-report-buttons">
      <button type="button" className="button button-quiet button-small" onClick={onCancel}>Cancel</button>
      <button type="submit" className="button button-secondary button-small" disabled={sending || trimmed.length < COMMENT_MIN}>{sending && <LoaderCircle className="spin" size={14} aria-hidden="true" />}Send</button>
    </span>
  </form>
}

/** "Recommended by N" once at least two people starred the item. */
export function Recommended({ itemType, itemId }: { itemType: FeedbackItemType; itemId: string }) {
  const { feedback, readOnly } = useBriefView()
  const stars = feedback[`${itemType}:${itemId}`]?.stars ?? 0
  if (readOnly || stars < 2) return null
  return <span className="brief-recommended"><Star size={12} aria-hidden="true" fill="currentColor" />Recommended by {stars}</span>
}

function sourceName(source: BriefSource) {
  if (source.publisher) return source.publisher
  try { return new URL(source.url).hostname.replace(/^www\./, '') } catch { return source.title }
}

/** Quiet icon-only button (aria-label "1 source" / "N sources", tooltip names them); opens a popover listing each source (publisher or hostname, title, retrieved date, link). */
export function SourcesButton({ ids }: { ids: string[] }) {
  const { sources } = useBriefView()
  const { open, setOpen, rootRef, panelRef, triggerRef } = usePopover<HTMLButtonElement, HTMLSpanElement>()
  const titleId = useId()
  const hintId = useId()
  const list = ids.map((id) => sources.get(id)?.source).filter((entry) => entry !== undefined)
  if (!list.length) return null
  const label = list.length === 1 ? '1 source' : `${list.length} sources`
  return <span ref={rootRef} className="brief-source">
    <button ref={triggerRef} type="button" className={`brief-action brief-source-button${open ? ' is-open' : ''}`} aria-expanded={open} aria-label={label} aria-describedby={hintId} onClick={() => setOpen(!open)}>
      <Link2 size={15} aria-hidden="true" />
    </button>
    {!open && <span id={hintId} role="tooltip" className="brief-action-tip">{list.length === 1 ? `Source: ${sourceName(list[0])}` : `Sources: ${[...new Set(list.map(sourceName))].join(', ')}`}</span>}
    {open && <div ref={panelRef} className="popover-panel is-end brief-source-popover" role="dialog" aria-labelledby={titleId}>
      <strong id={titleId} className="brief-source-popover-title">{label}</strong>
      <ul>
        {list.map((source) => {
          const href = safeUrl(source.url)
          return <li key={source.id}>
            <span className="brief-source-name">{sourceName(source)}</span>
            <span className="brief-source-title">{source.title}</span>
            <span className="brief-link-kind">Retrieved {formatDate(source.retrievedAt)}</span>
            {href && <a href={href} target="_blank" rel="noopener noreferrer">Open source <ExternalLink size={12} aria-hidden="true" /></a>}
          </li>
        })}
      </ul>
    </div>}
  </span>
}
