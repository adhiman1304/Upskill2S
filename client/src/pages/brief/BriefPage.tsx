import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, FlaskConical, LoaderCircle, Search } from 'lucide-react'
import { useApi } from '../../session'
import { ApiError } from '../../lib/api/client'
import { followCertification, getBriefPage, getBriefVersion, listBriefVersions, refreshBrief, sendBriefFeedback, setChecklistProgress, unfollowCertification, type Following } from '../../lib/api/briefs'
import { getJob } from '../../lib/api/jobs'
import type { BriefPageDto, BriefVersionSummary, FeedbackItemType, FeedbackReportReason, FeedbackSummary, JobDto, StudyBriefDto } from '../../lib/contracts'
import { usePolling } from '../../hooks/usePolling'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { formatDate, message } from '../legacy/utils'
import { BriefViewContext, type BriefViewContextValue } from './brief-context'
import { advanceFixtureJob, applyReport, applyStar, createFixtureJob, isTerminal, sourceIndex } from './brief-utils'
import { BriefBody } from './BriefBody'
import { BriefHeader } from './BriefHeader'
import { JobPanel, RefreshIssueCallout, type RefreshIssue } from './JobPanel'
import { VersionsDrawer } from './VersionsDrawer'
import './brief.css'

const POLL_INTERVAL_MS = 2000

/** Development-only sample data; the dynamic import is dropped from production builds. */
async function loadFixture() {
  if (!import.meta.env.DEV) throw new Error('Sample data is only available in development.')
  return import('./fixtures/fixture-page')
}

export function BriefPage() {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const fixture = import.meta.env.DEV && searchParams.get('fixture') === '1'
  return <BriefView key={`${id}:${fixture}`} id={id} fixture={fixture} />
}

function BriefView({ id, fixture }: { id: string; fixture: boolean }) {
  const request = useApi()
  const [page, setPage] = useState<BriefPageDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [job, setJob] = useState<JobDto | null>(null)
  const [starting, setStarting] = useState(false)
  const [refreshIssue, setRefreshIssue] = useState<RefreshIssue | null>(null)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [viewing, setViewing] = useState<StudyBriefDto | null>(null)
  const [pendingVotes, setPendingVotes] = useState<ReadonlySet<string>>(new Set())

  const fetchPage = useCallback(async () => fixture ? (await loadFixture()).fixtureBriefPage(id) : getBriefPage(request, id), [fixture, id, request])

  useEffect(() => {
    let active = true
    fetchPage()
      .then((data) => { if (active) { setPage(data); setJob(data.activeJob); setLoadError('') } })
      .catch((reason: unknown) => { if (active) setLoadError(message(reason, 'Could not load the study brief.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [fetchPage])

  const reload = useCallback(async () => {
    const data = await fetchPage()
    setPage(data)
    return data
  }, [fetchPage])

  // Poll the job every 2 s until it reaches a terminal status; on success reload the page data.
  const jobActive = Boolean(job) && !isTerminal(job)
  usePolling(async () => {
    if (!job) return null
    const next = fixture ? advanceFixtureJob(job) : await getJob(request, job.id)
    if (next.status === 'SUCCEEDED') {
      try { await reload(); setViewing(null); setJob(null); setNotice('The study brief is up to date.') }
      catch (reason) { setJob(next); setActionError(message(reason, 'Research finished, but the page could not reload.')) }
      return next
    }
    setJob(next)
    return next
  }, POLL_INTERVAL_MS, jobActive)

  const startRefresh = useCallback(async () => {
    setStarting(true); setRefreshIssue(null); setActionError(''); setNotice('')
    try {
      if (fixture) { setJob(createFixtureJob(id)); return }
      setJob(await refreshBrief(request, id))
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === 'OPENAI_KEY_MISSING') setRefreshIssue({ kind: 'key', message: reason.message })
      else if (reason instanceof ApiError && reason.code === 'RATE_LIMITED') setRefreshIssue({ kind: 'rate', message: reason.message })
      else if (reason instanceof ApiError && reason.code === 'JOB_ALREADY_RUNNING') {
        try { const data = await reload(); if (data.activeJob) setJob(data.activeJob) } catch (inner) { setRefreshIssue({ kind: 'error', message: message(inner, 'Research is already running.') }) }
      } else setRefreshIssue({ kind: 'error', message: message(reason, 'Could not start research.') })
    } finally { setStarting(false) }
  }, [fixture, id, reload, request])

  const toggleItem = useCallback(async (itemId: string, completed: boolean) => {
    const apply = (value: boolean) => setPage((current) => current && { ...current, progress: { completedItemIds: value ? [...new Set([...current.progress.completedItemIds, itemId])] : current.progress.completedItemIds.filter((entry) => entry !== itemId) } })
    apply(completed)
    if (fixture) return
    try {
      const result = await setChecklistProgress(request, id, itemId, completed)
      setPage((current) => current && { ...current, progress: result })
    } catch (reason) {
      apply(!completed)
      setActionError(message(reason, 'Could not save your progress.'))
    }
  }, [fixture, id, request])

  const setFeedback = useCallback((key: string, summary: FeedbackSummary | undefined) => setPage((current) => current && {
    ...current,
    feedback: summary ? { ...current.feedback, [key]: summary } : Object.fromEntries(Object.entries(current.feedback).filter(([entry]) => entry !== key)),
  }), [])

  const markPending = useCallback((key: string, pending: boolean) => setPendingVotes((current) => {
    const next = new Set(current)
    if (pending) next.add(key); else next.delete(key)
    return next
  }), [])

  const star = useCallback(async (itemType: FeedbackItemType, itemId: string) => {
    if (!page?.brief) return
    const briefId = page.brief.id
    const key = `${itemType}:${itemId}`
    const previous = page.feedback[key]
    setFeedback(key, applyStar(previous))
    if (fixture) return
    markPending(key, true)
    try {
      const result = await sendBriefFeedback(request, briefId, { itemType, itemId, verdict: 'star' })
      setFeedback(key, result.summary)
    } catch (reason) {
      setFeedback(key, previous)
      setActionError(message(reason, 'Could not save your recommendation.'))
    } finally {
      markPending(key, false)
    }
  }, [fixture, markPending, page, request, setFeedback])

  const report = useCallback(async (itemType: FeedbackItemType, itemId: string, reason: FeedbackReportReason, comment: string) => {
    if (!page?.brief) return false
    const key = `${itemType}:${itemId}`
    if (fixture) { setFeedback(key, applyReport(page.feedback[key])); return true }
    markPending(key, true)
    try {
      const result = await sendBriefFeedback(request, page.brief.id, { itemType, itemId, verdict: 'report', reason, comment })
      setFeedback(key, result.summary)
      return true
    } catch (error) {
      setActionError(message(error, 'Could not send your report.'))
      return false
    } finally {
      markPending(key, false)
    }
  }, [fixture, markPending, page, request, setFeedback])

  const changeFollow = useCallback(async (next: Following) => {
    setActionError('')
    try {
      const following = fixture ? next : next ? await followCertification(request, id, next) : (await unfollowCertification(request, id), null)
      setPage((current) => current && { ...current, following })
    } catch (reason) {
      setActionError(message(reason, 'Could not update your study status.'))
    }
  }, [fixture, id, request])

  const loadVersions = useCallback(async () => fixture ? (await loadFixture()).fixtureVersions(id) : listBriefVersions(request, id), [fixture, id, request])

  const currentBrief = page?.brief ?? null
  const selectVersion = useCallback(async (version: BriefVersionSummary) => {
    setVersionsOpen(false)
    if (version.status === 'CURRENT' && version.id === currentBrief?.id) { setViewing(null); return }
    try {
      if (fixture) {
        if (currentBrief) setViewing({ ...currentBrief, id: version.id, version: version.version, status: version.status, generatedAt: version.generatedAt, sourceCount: version.sourceCount })
        return
      }
      setViewing(await getBriefVersion(request, id, version.id))
    } catch (reason) {
      setActionError(message(reason, 'Could not load that version.'))
    }
  }, [currentBrief, fixture, id, request])

  const shownBrief = viewing ?? currentBrief
  useDocumentTitle(page ? `Study Brief: ${page.certification.code}` : 'Study Brief')
  const contextValue = useMemo<BriefViewContextValue>(() => ({
    sources: sourceIndex(shownBrief?.content.sources ?? []),
    feedback: viewing ? {} : page?.feedback ?? {},
    readOnly: Boolean(viewing),
    pendingVotes,
    onStar: (itemType, itemId) => void star(itemType, itemId),
    onReport: report,
  }), [page?.feedback, pendingVotes, report, shownBrief, star, viewing])

  if (!page) return <div className="page-content page-wide brief-page">
    <Link className="back-link" to="/"><ArrowLeft size={16} /> Find a certification</Link>
    {loading ? <div className="loading-state"><LoaderCircle className="spin" size={20} /> Loading study brief</div> : <div className="alert error" role="alert">{loadError || 'Certification not found.'}</div>}
  </div>

  return <div className="page-content page-wide brief-page">
    <Link className="back-link" to="/"><ArrowLeft size={16} /> Find a certification</Link>
    {fixture && <div className="alert warning"><FlaskConical size={15} /> Sample data: a hand-written DP-700 fixture for development. Nothing on this page is saved.</div>}
    <BriefHeader page={page} fixture={fixture} starting={starting} onRefresh={() => void startRefresh()} onFollowChange={changeFollow}
      jobPanel={job ? <JobPanel job={job} onRetry={() => void startRefresh()} onDismiss={() => setJob(null)} /> : null} />
    {refreshIssue && <RefreshIssueCallout issue={refreshIssue} onDismiss={() => setRefreshIssue(null)} />}
    {notice && <div className="alert success" role="status"><CheckCircle2 size={15} /> {notice}<button type="button" className="text-button" onClick={() => setNotice('')}>Dismiss</button></div>}
    {actionError && <div className="alert error" role="alert">{actionError}</div>}
    {viewing && <div className="alert">Viewing version {viewing.version} from {formatDate(viewing.generatedAt)} (read only).<button type="button" className="text-button" onClick={() => setViewing(null)}>Back to the current brief</button></div>}
    <BriefViewContext.Provider value={contextValue}>
      {shownBrief
        ? <BriefBody brief={shownBrief} completedItemIds={viewing ? [] : page.progress.completedItemIds} onToggle={(itemId, completed) => void toggleItem(itemId, completed)} onOpenVersions={() => setVersionsOpen(true)} />
        : !job && <EmptyBrief code={page.certification.code} />}
    </BriefViewContext.Provider>
    {versionsOpen && <VersionsDrawer load={loadVersions} viewingId={viewing?.id ?? null} onSelect={(version) => void selectVersion(version)} onClose={() => setVersionsOpen(false)} />}
  </div>
}

/** No brief yet: explains what "Generate study brief" in the hero does (the hero holds the one primary action). */
function EmptyBrief({ code }: { code: string }) {
  return <section className="empty-state brief-empty">
    <Search className="empty-icon" size={20} aria-hidden="true" />
    <h3>No study brief for {code} yet</h3>
    <p>The research agent reads the official exam page and skills outline, the official learning path and practice assessment, and community discussions (forums, videos and blogs). It then writes a cited study brief with a step-by-step checklist. It runs with your OpenAI API key and usually takes a few minutes.</p>
  </section>
}
