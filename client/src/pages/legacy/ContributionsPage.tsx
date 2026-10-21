import { useEffect, useState } from 'react'
import { Award, CircleHelp, FileText, GraduationCap, Lightbulb, LoaderCircle, MessageCircle, ThumbsUp } from 'lucide-react'
import { getContributionSummary } from '../../lib/api'
import type { ContributionSummary } from '../../lib/api'
import { useApi } from '../../session'
import { formatDate, message } from './utils'

const activityLabels: Record<string, string> = { certification: 'Certification', resource: 'Resource', idea: 'Idea', question: 'Question', comment: 'Comment' }

export function ContributionsPage() {
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
    { label: 'Certifications added', value: summary.counts.certifications, icon: <GraduationCap size={16} /> },
    { label: 'Resources shared', value: summary.counts.resources, icon: <FileText size={16} /> },
    { label: 'Ideas posted', value: summary.counts.ideas, icon: <Lightbulb size={16} /> },
    { label: 'Questions asked', value: summary.counts.questions, icon: <CircleHelp size={16} /> },
    { label: 'Comments', value: summary.counts.comments, icon: <MessageCircle size={16} /> },
    { label: 'Helpful votes received', value: summary.counts.helpfulReceived, icon: <ThumbsUp size={16} /> },
  ] : []

  return <div className="page-content community-page">
    <header className="topbar"><div><p className="breadcrumb">COMMUNITY <span>/</span> CONTRIBUTIONS</p><h1>My contributions</h1></div></header>
    {error && <div className="alert error" role="alert">{error}</div>}
    {loading ? <div className="loading-state"><LoaderCircle className="spin" size={20} /> Loading your contributions</div> : summary && <>
      <div className="contribution-stats">
        {stats.map((stat) => <div key={stat.label} className="contribution-stat"><span className="contribution-stat-icon">{stat.icon}</span><strong>{stat.value}</strong><small>{stat.label}</small></div>)}
      </div>
      <section className="contribution-section">
        <h2>Recognition</h2>
        {summary.badges.length ? <div className="badge-list">{summary.badges.map((badge) => <div key={badge.id} className={`recognition-badge ${badge.id}`}><span className="recognition-badge-icon"><Award size={18} /></span><div><strong>{badge.label}</strong><small>{badge.detail}</small></div></div>)}</div> : <p className="muted">Badges appear as you add certifications, join discussions, and receive helpful votes.</p>}
      </section>
      <section className="contribution-section">
        <h2>History</h2>
        {summary.activity.length ? <ol className="activity-list">{summary.activity.map((item) => <li key={item.id}><span className={`activity-kind ${item.kind}`}>{activityLabels[item.kind] ?? item.kind}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></li>)}</ol> : <div className="empty-state"><div className="empty-icon"><Award size={21} /></div><h3>No contributions yet</h3><p>Add a certification, share a resource, or post an idea to start your history.</p></div>}
      </section>
    </>}
  </div>
}
