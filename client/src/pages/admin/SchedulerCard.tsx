import { CalendarClock, LoaderCircle, RefreshCw } from 'lucide-react'
import type { SchedulerStatus } from '../../lib/api/adminOps'
import { formatDateTime, formatRelative } from './format'

function Flag({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  return <span className={`ops-flag ${on ? 'ops-flag-on' : 'ops-flag-off'}`}>{on ? onLabel : offLabel}</span>
}

export function SchedulerCard({ scheduler, blockedReason, refreshing, onRefreshAll, onlyFollowed }: { scheduler: SchedulerStatus | null; blockedReason: string | null; refreshing: boolean; onRefreshAll: () => void; onlyFollowed: boolean }) {
  return <section className="ops-card ops-scheduler">
    <div className="ops-card-head">
      <div><p className="eyebrow">SCHEDULER</p><h2><CalendarClock size={17} /> Nightly stale refresh</h2></div>
      <div className="ops-refresh-all">
        <button className="button button-primary" disabled={Boolean(blockedReason) || refreshing} onClick={onRefreshAll} title={blockedReason ?? undefined}>
          {refreshing ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />} Refresh all stale
        </button>
        <small className="muted">{blockedReason ?? `Up to 10 ${onlyFollowed ? 'followed ' : ''}certifications, using the server key.`}</small>
      </div>
    </div>
    {scheduler ? <dl className="ops-facts">
      <div><dt>Scheduler</dt><dd><Flag on={scheduler.enabled} onLabel="Enabled" offLabel="Disabled" /> {scheduler.enabled && <Flag on={scheduler.active} onLabel="Running" offLabel="Not running" />}</dd></div>
      <div><dt>Cron</dt><dd><code>{scheduler.cron}</code></dd></div>
      <div><dt>Server key</dt><dd><Flag on={scheduler.serverKeyAvailable} onLabel="Available" offLabel="Missing" /></dd></div>
      <div><dt>Next run</dt><dd>{scheduler.nextRunAt ? `${formatDateTime(scheduler.nextRunAt)} (${formatRelative(scheduler.nextRunAt)})` : '—'}</dd></div>
      <div><dt>Last run</dt><dd>{scheduler.lastRunAt ? `${formatDateTime(scheduler.lastRunAt)} by ${scheduler.lastRunTrigger === 'schedule' ? 'schedule' : 'admin'}, ${scheduler.lastRunEnqueued ?? 0} enqueued` : 'Not since the server started'}</dd></div>
      {scheduler.inactiveReason && scheduler.enabled && <div className="ops-facts-wide"><dt>Note</dt><dd>{scheduler.inactiveReason}</dd></div>}
      {scheduler.lastRunError && <div className="ops-facts-wide"><dt>Last error</dt><dd className="ops-error-text">{scheduler.lastRunError}</dd></div>}
    </dl> : <div className="loading-state ops-loading"><LoaderCircle className="spin" size={16} /> Loading scheduler status</div>}
  </section>
}
