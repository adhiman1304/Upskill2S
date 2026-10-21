import { ExternalLink } from 'lucide-react'
import type { ChecklistItem } from '../../lib/contracts'
import { useBriefView } from './brief-context'
import { formatMinutes, groupChecklist, phaseLabels, safeUrl } from './brief-utils'
import { FeedbackControl, SourceChips } from './FeedbackControl'

/** Checklist grouped by phase with check-off and completion percentage. */
export function ChecklistSection({ items, completedItemIds, onToggle }: { items: ChecklistItem[]; completedItemIds: string[]; onToggle: (itemId: string, completed: boolean) => void }) {
  const { readOnly } = useBriefView()
  const completed = new Set(completedItemIds)
  const done = items.filter((item) => completed.has(item.id)).length
  const percent = items.length ? Math.round((done / items.length) * 100) : 0
  return <section className="brief-section brief-checklist" aria-labelledby="brief-checklist-heading">
    <div className="section-heading">
      <div><h2 id="brief-checklist-heading">Study checklist</h2><p>{readOnly ? 'Older version (read only).' : 'Check items off as you go; progress is saved to your account.'}</p></div>
      <div className="brief-progress" aria-label={`${percent} percent complete`}>
        <strong>{percent}%</strong><span>{done} of {items.length}</span>
        <span className="brief-progress-bar"><span style={{ width: `${percent}%` }} /></span>
      </div>
    </div>
    {groupChecklist(items).map((group) => <div className="brief-phase" key={group.phase}>
      <h3>{phaseLabels[group.phase]}</h3>
      <ul>
        {group.items.map((item) => {
          const checked = completed.has(item.id)
          return <li key={item.id} className={checked ? 'is-done' : ''}>
            <label className="brief-check">
              <input type="checkbox" aria-label={item.title} checked={checked} disabled={readOnly} onChange={(event) => onToggle(item.id, event.target.checked)} />
              <span className="brief-check-text">
                <span className="brief-item-title">{item.title}</span>
                <span className="brief-item-detail">{item.detail}</span>
              </span>
            </label>
            <div className="brief-item-meta">
              {item.estimatedMinutes !== null && <span>{formatMinutes(item.estimatedMinutes)}</span>}
              {item.links.map((link) => {
                const href = safeUrl(link.url)
                return href ? <a key={href} href={href} target="_blank" rel="noopener noreferrer">{link.label} <ExternalLink size={10} /></a> : null
              })}
              <SourceChips ids={item.sourceIds} />
              <FeedbackControl itemType="checklist" itemId={item.id} />
            </div>
          </li>
        })}
      </ul>
    </div>)}
  </section>
}
