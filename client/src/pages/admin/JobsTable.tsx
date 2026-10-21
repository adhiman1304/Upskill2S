import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight, LoaderCircle, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { jobKinds, jobStatuses, type AdminJobDto, type JobKind, type JobStatus } from '../../lib/api/adminOps'
import { formatDateTime, formatDuration, formatNumber } from './format'

export function JobsTable({ jobs, error, status, kind, onStatus, onKind, cancellingId, onCancel }: { jobs: AdminJobDto[] | null; error: string | null; status: JobStatus | ''; kind: JobKind | ''; onStatus: (value: JobStatus | '') => void; onKind: (value: JobKind | '') => void; cancellingId: string | null; onCancel: (job: AdminJobDto) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  return <section className="ops-card" aria-labelledby="ops-jobs-heading">
    <div className="ops-card-head">
      <div><h2 id="ops-jobs-heading">Jobs</h2><p className="muted">Newest first, refreshed every 5 seconds. Click a row for its progress log.</p></div>
      <div className="ops-filters">
        <label>Status<select value={status} onChange={(event) => onStatus(event.target.value as JobStatus | '')}><option value="">All</option>{jobStatuses.map((value) => <option key={value} value={value}>{value.toLowerCase()}</option>)}</select></label>
        <label>Kind<select value={kind} onChange={(event) => onKind(event.target.value as JobKind | '')}><option value="">All</option>{jobKinds.map((value) => <option key={value} value={value}>{value.toLowerCase()}</option>)}</select></label>
      </div>
    </div>
    {error && <div className="alert error">{error}</div>}
    {!jobs ? <div className="loading-state ops-loading"><LoaderCircle className="spin" size={16} /> Loading jobs</div>
      : jobs.length === 0 ? <div className="empty-state ops-empty"><p>No jobs match these filters.</p></div>
      : <div className="table-wrap"><table className="table ops-table ops-jobs">
        <thead><tr><th aria-label="Expand" /><th>Created</th><th>Kind</th><th>Status</th><th>Certification</th><th>Requested by</th><th>Duration</th><th className="num">Tokens in / out</th><th aria-label="Actions" /></tr></thead>
        <tbody>{jobs.map((job) => {
          const open = expanded === job.id
          return <Fragment key={job.id}>
            <tr className={`ops-job-row${open ? ' is-open' : ''}`} onClick={() => setExpanded(open ? null : job.id)}>
              <td>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
              <td className="nowrap">{formatDateTime(job.createdAt)}</td>
              <td className="nowrap"><span className="ops-kind">{job.kind.toLowerCase()}</span>{job.useServerKey && <span className="ops-kind ops-kind-server" title="Runs with the server OpenAI key">server</span>}</td>
              <td><span className={`chip ops-status-${job.status.toLowerCase()}`}>{job.status.toLowerCase()}</span></td>
              <td className="ops-cell-title">{job.certification ? <Link to={`/certifications/${job.certification.id}`} onClick={(event) => event.stopPropagation()}>{job.certification.code}</Link> : job.intakeSessionId ? <span className="muted">intake</span> : '—'}{job.certification && <span className="muted"> {job.certification.provider}</span>}</td>
              <td className="nowrap">{job.requestedByName}</td>
              <td className="nowrap">{formatDuration(job.startedAt, job.finishedAt)}</td>
              <td className="num nowrap">{job.inputTokens === null && job.outputTokens === null ? '—' : `${formatNumber(job.inputTokens ?? 0)} / ${formatNumber(job.outputTokens ?? 0)}`}</td>
              <td className="ops-cell-actions">{job.status === 'QUEUED' && <button className="button button-quiet ops-small-button" disabled={cancellingId === job.id} onClick={(event) => { event.stopPropagation(); onCancel(job) }}>{cancellingId === job.id ? <LoaderCircle className="spin" size={13} /> : <XCircle size={13} />} Cancel</button>}</td>
            </tr>
            {open && <tr className="ops-job-detail"><td colSpan={9}>
              <div className="ops-job-detail-grid">
                <div><h4>Progress</h4>{job.progress.length ? <ol className="ops-log">{job.progress.map((entry, index) => <li key={`${entry.at}-${index}`}><time>{formatDateTime(entry.at)}</time><span>{entry.message}</span></li>)}</ol> : <p className="muted">No progress entries.</p>}</div>
                <div><h4>Details</h4><dl className="facts ops-facts-compact">
                  <div><dt>Job id</dt><dd><code>{job.id}</code></dd></div>
                  {job.certification && <div><dt>Certification</dt><dd>{job.certification.provider} {job.certification.code}: {job.certification.title}</dd></div>}
                  <div><dt>Started</dt><dd>{formatDateTime(job.startedAt)}</dd></div>
                  <div><dt>Finished</dt><dd>{formatDateTime(job.finishedAt)}</dd></div>
                  {job.resultBriefId && <div><dt>Result brief</dt><dd><code>{job.resultBriefId}</code></dd></div>}
                  {job.error && <div><dt>Error</dt><dd className="ops-error-text">{job.error}</dd></div>}
                </dl></div>
              </div>
            </td></tr>}
          </Fragment>
        })}</tbody>
      </table></div>}
  </section>
}
