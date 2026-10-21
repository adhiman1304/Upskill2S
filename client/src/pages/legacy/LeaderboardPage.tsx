import { useEffect, useState } from 'react'
import { Award, LoaderCircle, Sparkles, Trophy, Users } from 'lucide-react'
import { getContributorLeaderboard } from '../../lib/api'
import type { ContributorCounts, ContributorLeaderboard } from '../../lib/api'
import { useApi } from '../../session'
import { message } from './utils'

const contributionLabels: { key: keyof ContributorCounts; label: string }[] = [
  { key: 'certifications', label: 'Certifications' },
  { key: 'resources', label: 'Resources' },
  { key: 'ideas', label: 'Ideas' },
  { key: 'questions', label: 'Questions' },
  { key: 'comments', label: 'Comments' },
  { key: 'helpfulReceived', label: 'Helpful votes' },
]

export function LeaderboardPage() {
  const request = useApi()
  const [board, setBoard] = useState<ContributorLeaderboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getContributorLeaderboard(request).then((data) => { if (active) { setBoard(data); setError('') } }).catch((reason: unknown) => { if (active) setError(message(reason, 'Could not load the leaderboard.')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [request])

  const contributors = board?.contributors ?? []
  const me = contributors.find((item) => item.isCurrentUser)

  return <div className="page-content community-page">
    <header className="topbar"><div><p className="breadcrumb">COMMUNITY <span>/</span> LEADERBOARD</p><h1>Contributor leaderboard</h1></div></header>
    {error && <div className="alert error" role="alert">{error}</div>}
    {loading ? <div className="loading-state"><LoaderCircle className="spin" size={20} /> Loading the leaderboard</div> : board && <>
      <div className="contribution-stats">
        <div className="contribution-stat"><span className="contribution-stat-icon"><Users size={16} /></span><strong>{contributors.length}</strong><small>Ranked contributors</small></div>
        <div className="contribution-stat"><span className="contribution-stat-icon"><Trophy size={16} /></span><strong>{contributors[0]?.score ?? 0}</strong><small>Top score</small></div>
        <div className="contribution-stat"><span className="contribution-stat-icon"><Award size={16} /></span><strong>{me ? `#${me.rank}` : '–'}</strong><small>Your rank</small></div>
        <div className="contribution-stat"><span className="contribution-stat-icon"><Sparkles size={16} /></span><strong>{me?.score ?? 0}</strong><small>Your score</small></div>
      </div>
      <section className="score-guide" aria-label="How leaderboard points are calculated">
        <div className="score-guide-copy"><strong>How points work</strong><span>Earn points for every contribution and helpful vote.</span></div>
        <div className="score-guide-chips">{contributionLabels.map((item) => <span key={item.key} className={`score-guide-chip ${item.key}`}><span>{item.label}</span><strong>+{board.weights[item.key]}</strong></span>)}</div>
      </section>
      {contributors.length ? <ol className="leaderboard-list">{contributors.map((item) => <li key={item.userId} className={`leaderboard-row ${item.isCurrentUser ? 'is-me' : ''}`}>
        <span className={`leaderboard-rank ${item.rank <= 3 ? `top-${item.rank}` : ''}`} aria-label={`Rank ${item.rank}`}>{item.rank}</span>
        <span className={`leaderboard-avatar ${item.rank <= 3 ? `top-${item.rank}` : ''}`}>{item.displayName.slice(0, 1).toUpperCase()}</span>
        <div className="leaderboard-name"><strong>{item.displayName}{item.isCurrentUser && <em>You</em>}</strong><div className="leaderboard-breakdown">{contributionLabels.filter((label) => item.counts[label.key] > 0).map((label) => <span key={label.key} className={`contribution-chip ${label.key}`}>{item.counts[label.key]} {label.label.toLowerCase()}</span>)}</div></div>
        <strong className="leaderboard-score">{item.score}<small>points</small></strong>
      </li>)}</ol> : <div className="empty-state"><div className="empty-icon"><Trophy size={21} /></div><h3>No contributions yet</h3><p>Scores appear once people add certifications, share resources, post ideas or questions, comment, or receive helpful votes.</p></div>}
    </>}
  </div>
}
