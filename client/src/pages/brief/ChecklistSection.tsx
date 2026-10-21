import { Clock, ExternalLink } from 'lucide-react'
import type { ChecklistItem } from '../../lib/contracts'
import { useBriefView } from './brief-context'
import { formatMinutes, groupChecklist, phaseLabels, safeUrl } from './brief-utils'
import { ItemMeta, Recommended } from './FeedbackControl'

/** Checklist tab: progress on top, phases as sections, the first unchecked item highlighted as "Next up". */
export function ChecklistSection({ items, completedItemIds, onToggle }: { items: ChecklistItem[]; completedItemIds: string[]; onToggle: (itemId: string, completed: boolean) => void }) {
  const { readOnly } = useBriefView()
  const completed = new Set(completedItemIds)
  const done = items.filter((item) => completed.has(item.id)).length
  const percent = items.length ? Math.round((done / items.length) * 100) : 0
  const groups = groupChecklist(items)
  const nextId = readOnly ? null : groups.flatMap((group) => group.items).find((item) => !completed.has(item.id))?.id ?? null
  if (!items.length) return <p className="brief-tab-empty">This brief has no checklist.</p>
  return <section className="brief-section brief-checklist" aria-labelledby="brief-checklist-heading">
    <h2 id="brief-checklist-heading" className="sr-only">Study checklist</h2>
    <div className="brief-progress">
      <div className="brief-progress-text">
        <strong>{done} of {items.length} done</strong>
        <span>{readOnly ? 'Older version (read only).' : done === items.length ? 'All done. Good luck on exam day.' : 'Progress is saved to your account.'}</span>
      </div>
      <span className="brief-progress-bar" role="progressbar" aria-label="Checklist progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></span>
    </div>
    {groups.map((group) => <section className="brief-phase" key={group.phase} aria-labelledby={`phase-${group.phase}`}>
      <h3 id={`phase-${group.phase}`}>{phaseLabels[group.phase]}<span className="muted-inline"> {group.items.filter((item) => completed.has(item.id)).length}/{group.items.length}</span></h3>
      <ul>
        {group.items.map((item) => {
          const checked = completed.has(item.id)
          const next = item.id === nextId
          return <li key={item.id} id={`item-${item.id}`} className={`${checked ? 'is-done' : ''}${next ? ' is-next' : ''}`}>
            {next && <span className="brief-next-label">Next up</span>}
            <label className="brief-check">
              <input type="checkbox" checked={checked} disabled={readOnly} onChange={(event) => onToggle(item.id, event.target.checked)} />
              <span className="brief-check-text">
                <span className="brief-item-title">{item.title}</span>
                <span className="brief-item-detail">{item.detail}</span>
              </span>
            </label>
            <ItemMeta itemType="checklist" itemId={item.id} title={item.title} sourceIds={item.sourceIds}>
              <Recommended itemType="checklist" itemId={item.id} />
              {item.estimatedMinutes !== null && <span className="brief-meta-time"><Clock size={13} aria-hidden="true" />{formatMinutes(item.estimatedMinutes)}</span>}
              {item.links.map((link) => {
                const href = safeUrl(link.url)
                return href ? <a key={href} href={href} target="_blank" rel="noopener noreferrer">{link.label} <ExternalLink size={11} aria-hidden="true" /></a> : null
              })}
            </ItemMeta>
          </li>
        })}
      </ul>
    </section>)}
  </section>
}
