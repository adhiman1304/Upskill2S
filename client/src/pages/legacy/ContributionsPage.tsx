import { useEffect, useState } from 'react'
import { Award, LoaderCircle } from 'lucide-react'
import { getContributionSummary } from '../../lib/api'
import type { ContributionSummary } from '../../lib/api'
import { useApi } from '../../session'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import './legacy.css'
import { formatDate, message } from './utils'

const activityLabels: Record<string, string> = { certification: 'Certification', resource: 'Resource', idea: 'Idea', question: 'Question', comment: 'Comment' }

export function ContributionsPage() {
  useDocumentTitle('My contributions')
  const request = useApi()
  const [summary, setSummary] = useState<ContributionSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getContributionSummary(request).then((data) => { if (active) { setSummary(data); setError('') } }).catch((reason: unknown) => { if (active) setError(message(reason, 'Could not load your contributions.')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [request])

  const stats = summary ? [
    { label: 'Certifications added', value: summary.counts.certifications },
    { label: 'Resources shared', value: summary.counts.resources },
    { label: 'Ideas posted', value: summary.counts.ideas },
    { label: 'Questions asked', value: summary.counts.questions },
    { label: 'Comments', value: summary.counts.comments },
    { label: 'Helpful votes received', value: summary.counts.helpfulReceived },
  ] : []

  return <div className="page-content community-page">
    <header className="page-header"><div><h1>My contributions</h1><p className="page-desc">What you have added to the library and community.</p></div></header>
    {error && <div className="alert error" role="alert">{error}</div>}
    {loading ? <div className="loading-state"><LoaderCircle className="spin" size={20} /> Loading your contributions</div> : summary && <>
      <div className="contribution-stats">
        {stats.map((stat) => <div key={stat.label} className="contribution-stat"><strong>{stat.value}</strong><small>{stat.label}</small></div>)}
      </div>
      <section className="section">
        <h2 className="contribution-heading">Recognition</h2>
        {summary.badges.length ? <div className="badge-list">{summary.badges.map((badge) => <div key={badge.id} className={`recognition-badge ${badge.id}`}><Award className="recognition-badge-icon" size={18} aria-hidden="true" /><div><strong>{badge.label}</strong><small>{badge.detail}</small></div></div>)}</div> : <p className="muted">Badges appear as you add certifications, join discussions, and receive helpful votes.</p>}
      </section>
      <section className="section">
        <h2 className="contribution-heading">History</h2>
        {summary.activity.length ? <ol className="list activity-list">{summary.activity.map((item) => <li key={item.id}><span className="chip activity-kind">{activityLabels[item.kind] ?? item.kind}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></li>)}</ol> : <div className="empty-state"><Award className="empty-icon" size={20} aria-hidden="true" /><h3>No contributions yet</h3><p>Add a certification, share a resource, or post an idea to start your history.</p></div>}
      </section>
    </>}
  </div>
}
