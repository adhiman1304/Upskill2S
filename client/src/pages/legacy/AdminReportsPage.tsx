import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, Check, Eye, EyeOff, Flag, LoaderCircle, XCircle } from 'lucide-react'
import { getOpenReports, moderateResource, resolveReport } from '../../lib/api'
import type { Resource, ResourceReport } from '../../lib/api'
import { useApi } from '../../session'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import './legacy.css'
import { formatDate, message } from './utils'

export function AdminReportsPage() {
  useDocumentTitle('Review queue')
  return <div className="page-content"><header className="page-header"><div><h1>Review queue</h1><p className="page-desc">Review reports, mark checked resources, or hide material from the shared library.</p></div></header><AdminReviewPanel /></div>
}

export function AdminReviewPanel() {
  const request = useApi()
  const [reports, setReports] = useState<ResourceReport[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => {
    try { setReports(await getOpenReports(request)); setError('') }
    catch (reason) { setError(message(reason, 'Could not load the review queue.')) }
    finally { setLoading(false) }
  }, [request])
  useEffect(() => {
    let active = true
    getOpenReports(request).then((data) => { if (active) { setReports(data); setError('') } }).catch((reason: unknown) => { if (active) setError(message(reason, 'Could not load the review queue.')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [request])
  async function moderate(resource: Resource, change: { isVisible?: boolean; reviewed?: boolean }) {
    try { await moderateResource(request, resource.id, change); await refresh() }
    catch (reason) { setError(message(reason, 'Could not update resource review state.')) }
  }
  async function closeReport(id: string, status: 'RESOLVED' | 'DISMISSED') {
    try { await resolveReport(request, id, status); await refresh() }
    catch (reason) { setError(message(reason, 'Could not update report.')) }
  }
  return <section className="admin-review" aria-label="Resource review queue"><div className="section-heading"><div><h2>Open reports</h2></div><span className="result-count">{loading ? 'Loading' : `${reports.length} open reports`}</span></div>{error && <div className="alert error">{error}</div>}{loading ? <div className="loading-state"><LoaderCircle className="spin" size={18} /> Loading queue</div> : reports.length ? <div className="list report-list">{reports.map((report) => <article className="report-row" key={report.id}><div className="report-info"><span className="report-category"><Flag size={14} /> {report.category.replaceAll('_', ' ')}</span><strong>{report.resource.title}</strong><span>{report.resource.certification?.title} · Reported by {report.reporterName} · {formatDate(report.createdAt)}</span>{report.message && <p>{report.message}</p>}</div><div className="report-actions"><button className="button button-secondary button-small" onClick={() => void moderate(report.resource, { reviewed: true })}><BadgeCheck size={15} /> Mark reviewed</button><button className="button button-secondary button-small" onClick={() => void moderate(report.resource, { isVisible: !report.resource.isVisible })}>{report.resource.isVisible ? <EyeOff size={15} /> : <Eye size={15} />}{report.resource.isVisible ? 'Hide resource' : 'Restore resource'}</button><button className="button button-quiet button-small" onClick={() => void closeReport(report.id, 'RESOLVED')}><Check size={15} /> Resolve</button><button className="icon-button" title="Dismiss report" aria-label="Dismiss report" onClick={() => void closeReport(report.id, 'DISMISSED')}><XCircle size={16} /></button></div></article>)}</div> : <div className="empty-state"><BadgeCheck className="empty-icon" size={20} aria-hidden="true" /><p>No open reports</p></div>}</section>
}
