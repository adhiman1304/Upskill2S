import type { FreshnessStatus } from '../../lib/contracts'

const labels: Record<FreshnessStatus, string> = { fresh: 'Fresh', stale: 'Stale', missing: 'No brief yet' }
const titles: Record<FreshnessStatus, string> = {
  fresh: 'The study brief was researched recently.',
  stale: 'The study brief is older than the freshness window; refresh it before relying on it.',
  missing: 'No study brief has been researched yet.',
}

export function FreshnessChip({ status }: { status: FreshnessStatus }) {
  return <span className={`chip is-${status}`} title={titles[status]}><span className="chip-dot" aria-hidden="true" />{labels[status]}</span>
}
