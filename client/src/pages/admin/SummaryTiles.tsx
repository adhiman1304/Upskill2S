import type { OpsSummary } from '../../lib/api/adminOps'
import { formatNumber } from './format'

function Tile({ label, value, hint, tone }: { label: string; value: number | null | undefined; hint?: string; tone?: 'good' | 'warn' | 'bad' }) {
  return <div className={`ops-tile${tone ? ` ops-tile-${tone}` : ''}`}><span className="ops-tile-label">{label}</span><strong>{formatNumber(value)}</strong>{hint && <small>{hint}</small>}</div>
}

export function SummaryTiles({ summary }: { summary: OpsSummary | null }) {
  const briefs = summary?.briefs
  const jobs = summary?.jobs.last24h
  const tokens = summary?.tokens.last7Days
  return <div className="ops-summary">
    <section className="ops-tile-group" aria-label="Study briefs">
      <h3>Study briefs</h3>
      <div className="ops-tiles">
        <Tile label="Current briefs" value={briefs?.total} />
        <Tile label="Fresh" value={briefs?.fresh} tone="good" hint={briefs ? `< ${briefs.staleAfterDays} days old` : undefined} />
        <Tile label="Stale" value={briefs?.stale} tone={briefs?.stale ? 'warn' : undefined} />
        <Tile label="Without brief" value={briefs?.certificationsWithoutBrief} hint={briefs ? `${formatNumber(briefs.followedWithoutBrief)} followed` : undefined} />
      </div>
    </section>
    <section className="ops-tile-group" aria-label="Jobs in the last 24 hours">
      <h3>Jobs, last 24 hours</h3>
      <div className="ops-tiles">
        <Tile label="Queued" value={jobs?.QUEUED} />
        <Tile label="Running" value={jobs?.RUNNING} />
        <Tile label="Succeeded" value={jobs?.SUCCEEDED} tone="good" />
        <Tile label="Failed" value={jobs?.FAILED} tone={jobs?.FAILED ? 'bad' : undefined} />
        <Tile label="Cancelled" value={jobs?.CANCELLED} />
      </div>
    </section>
    <section className="ops-tile-group" aria-label="Tokens in the last 7 days">
      <h3>Tokens, last 7 days</h3>
      <div className="ops-tiles">
        <Tile label="Input" value={tokens?.input} hint={tokens ? `${formatNumber(tokens.jobs)} finished jobs` : undefined} />
        <Tile label="Output" value={tokens?.output} />
        {summary && Object.entries(summary.tokens.byKind).map(([kind, totals]) => <Tile key={kind} label={kind.toLowerCase()} value={totals.input + totals.output} hint={`${formatNumber(totals.jobs)} jobs`} />)}
      </div>
    </section>
  </div>
}
