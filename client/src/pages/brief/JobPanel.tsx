import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock, KeyRound, LoaderCircle, RefreshCw } from 'lucide-react'
import type { JobDto } from '../../lib/contracts'

export type RefreshIssue = { kind: 'key' | 'rate' | 'error'; message: string }

/** Slim live progress log for a research job. */
export function JobPanel({ job, onRetry, onDismiss }: { job: JobDto; onRetry: () => void; onDismiss: () => void }) {
  const failed = job.status === 'FAILED' || job.status === 'CANCELLED'
  const done = job.status === 'SUCCEEDED'
  const entries = job.progress.slice(-8)
  return <section className={`brief-job${failed ? ' is-failed' : ''}`} aria-live="polite">
    <div className="brief-job-head">
      {failed ? <AlertTriangle size={16} /> : done ? <CheckCircle2 size={16} /> : <LoaderCircle className="spin" size={16} />}
      <strong>{failed ? 'Research failed' : done ? 'Research finished' : job.status === 'QUEUED' ? 'Waiting for a research slot' : 'Researching this certification'}</strong>
      <span className="chip">{job.kind === 'BRIEF' ? 'New brief' : 'Refresh'}</span>
      {failed && <span className="brief-job-actions"><button type="button" className="button button-secondary button-small" onClick={onRetry}><RefreshCw size={14} /> Try again</button><button type="button" className="button button-quiet button-small" onClick={onDismiss}>Dismiss</button></span>}
    </div>
    {failed && job.error && <p className="brief-job-error">{job.error}</p>}
    <ol className="brief-job-log">
      {entries.map((entry, index) => <li key={`${entry.at}-${index}`}><time dateTime={entry.at}>{new Date(entry.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time><span>{entry.message}</span></li>)}
    </ol>
    {!failed && !done && <p className="brief-job-hint">This usually takes a few minutes. You can leave this page; the job keeps running.</p>}
  </section>
}

export function RefreshIssueCallout({ issue, onDismiss }: { issue: RefreshIssue; onDismiss: () => void }) {
  return <div className={`alert ${issue.kind === 'error' ? 'error' : 'warning'} brief-callout`} role="alert">
    {issue.kind === 'key' ? <KeyRound size={16} /> : issue.kind === 'rate' ? <Clock size={16} /> : <AlertTriangle size={16} />}
    <div>
      <strong>{issue.kind === 'key' ? 'Add your OpenAI API key first' : issue.kind === 'rate' ? 'Refresh limit reached' : 'Could not start research'}</strong>
      <p>{issue.message}</p>
    </div>
    {issue.kind === 'key' ? <Link className="button button-secondary button-small" to="/settings">Open settings</Link> : <button type="button" className="text-button" onClick={onDismiss}>Dismiss</button>}
  </div>
}
