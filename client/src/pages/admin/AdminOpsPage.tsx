import { useEffect, useState } from 'react'
import { usePolling } from '../../hooks/usePolling'
import { Tabs } from '../../components/ui/Tabs'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { ApiError } from '../../lib/api/client'
import { cancelAdminJob, getOpsSummary, getStaleCertifications, listAdminJobs, refreshStale, type AdminJobDto, type JobKind, type JobStatus, type RefreshStaleResult } from '../../lib/api/adminOps'
import { useApi } from '../../session'
import { JobsTable } from './JobsTable'
import { SchedulerCard } from './SchedulerCard'
import { StaleTable } from './StaleTable'
import { SummaryTiles } from './SummaryTiles'
import { PageFrame, PageHeading } from '../legacy/embed'
import './admin-ops.css'

function errorText(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.code === 'SERVER_KEY_MISSING') return 'The server has no OPENAI_SERVER_API_KEY, so briefs cannot be refreshed with the company key.'
  return error instanceof Error ? error.message : fallback
}

function describeRefresh(result: RefreshStaleResult) {
  const parts = [`Enqueued ${result.enqueued.length} refresh job${result.enqueued.length === 1 ? '' : 's'}.`]
  const active = result.skipped.filter((item) => item.reason === 'job_active').length
  const missing = result.skipped.filter((item) => item.reason === 'not_found').length
  if (active) parts.push(`${active} skipped because a job is already active.`)
  if (missing) parts.push(`${missing} not found.`)
  return parts.join(' ')
}

export function AdminOpsPage({ embedded = false }: { embedded?: boolean }) {
  useDocumentTitle('Operations', !embedded)
  const request = useApi()
  const mobile = useIsMobile()
  const [status, setStatus] = useState<JobStatus | ''>('')
  const [kind, setKind] = useState<JobKind | ''>('')
  const [onlyFollowed, setOnlyFollowed] = useState(true)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [refreshingAll, setRefreshingAll] = useState(false)
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set())
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const summary = usePolling(() => getOpsSummary(request), 15_000, true)
  const jobs = usePolling(() => listAdminJobs(request, { status, kind, limit: 100 }), 5_000, true)
  const stale = usePolling(() => getStaleCertifications(request, { onlyFollowed }), 60_000, true)
  const refreshJobs = jobs.refresh
  const refreshStaleList = stale.refresh
  useEffect(() => { void refreshJobs() }, [status, kind, refreshJobs])
  useEffect(() => { void refreshStaleList() }, [onlyFollowed, refreshStaleList])

  const scheduler = summary.data?.scheduler ?? null
  const blockedReason = !scheduler
    ? (summary.error ? 'Scheduler status is unavailable.' : 'Loading scheduler status.')
    : !scheduler.serverKeyAvailable ? 'Disabled: OPENAI_SERVER_API_KEY is not configured on the server.' : null

  async function reloadAll() {
    await Promise.all([summary.refresh(), jobs.refresh(), stale.refresh()])
  }

  async function runRefresh(input: { certificationIds?: string[]; onlyFollowed?: boolean; limit?: number }) {
    try {
      const result = await refreshStale(request, input)
      setNotice({ tone: 'ok', text: describeRefresh(result) })
    } catch (error) {
      setNotice({ tone: 'error', text: errorText(error, 'Could not enqueue refresh jobs.') })
    }
    await reloadAll()
  }

  async function refreshAll() {
    if (blockedReason) return
    const count = stale.data?.items.length ?? 0
    const scope = onlyFollowed ? 'followed certifications' : 'certifications'
    if (!window.confirm(`Enqueue refresh jobs for up to 10 stale ${scope} (${count} currently listed)? They run with the company OpenAI key and cost money.`)) return
    setRefreshingAll(true)
    try { await runRefresh({ onlyFollowed, limit: 10 }) } finally { setRefreshingAll(false) }
  }

  async function refreshOne(certificationId: string) {
    if (blockedReason) return
    setPendingIds((current) => new Set(current).add(certificationId))
    try { await runRefresh({ certificationIds: [certificationId] }) }
    finally { setPendingIds((current) => { const next = new Set(current); next.delete(certificationId); return next }) }
  }

  async function cancel(job: AdminJobDto) {
    if (!window.confirm(`Cancel this queued ${job.kind.toLowerCase()} job${job.certification ? ` for ${job.certification.code}` : ''}?`)) return
    setCancellingId(job.id)
    try {
      await cancelAdminJob(request, job.id)
      setNotice({ tone: 'ok', text: 'Job cancelled.' })
    } catch (error) {
      setNotice({ tone: 'error', text: errorText(error, 'Could not cancel the job.') })
    } finally {
      setCancellingId(null)
    }
    await reloadAll()
  }

  return <PageFrame embedded={embedded} className="ops-page">
    <PageHeading embedded={embedded} title="Operations" description="Research jobs, brief freshness and the nightly refresh." />
    {summary.error && <div className="alert error">{errorText(summary.error, 'Could not load the operations summary.')}</div>}
    {notice && <div className={`alert ${notice.tone === 'error' ? 'error' : 'success'}`} role="status"><span>{notice.text}</span><button className="icon-button ops-dismiss" onClick={() => setNotice(null)} aria-label="Dismiss">×</button></div>}
    {/* Mobile: Summary | Stale | Jobs tabs. Desktop: the same panels stacked in this order. */}
    {/* Inside the Admin hub, `?tab=` belongs to the hub, so these tabs use `?section=`. */}
    <Tabs mode={mobile ? 'tabs' : 'stacked'} label="Operations sections" param={embedded ? 'section' : 'tab'} tabs={[
      { id: 'summary', label: 'Summary', content: <>
        <SummaryTiles summary={summary.data} />
        <SchedulerCard scheduler={scheduler} blockedReason={blockedReason} refreshing={refreshingAll} onRefreshAll={() => void refreshAll()} onlyFollowed={onlyFollowed} />
      </> },
      { id: 'stale', label: 'Stale', content: <>
        {stale.error && <div className="alert error">{errorText(stale.error, 'Could not load stale certifications.')}</div>}
        <StaleTable data={stale.data} loading={!stale.data && !stale.error} onlyFollowed={onlyFollowed} onToggleFollowed={setOnlyFollowed} blockedReason={blockedReason} pendingIds={pendingIds} onRefresh={(id) => void refreshOne(id)} />
      </> },
      { id: 'jobs', label: 'Jobs', content: <JobsTable jobs={jobs.data} error={jobs.error ? errorText(jobs.error, 'Could not load jobs.') : null} status={status} kind={kind} onStatus={setStatus} onKind={setKind} cancellingId={cancellingId} onCancel={(job) => void cancel(job)} /> },
    ]} />
  </PageFrame>
}
