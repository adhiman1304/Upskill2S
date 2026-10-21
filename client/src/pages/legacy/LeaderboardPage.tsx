import { useEffect, useState } from 'react'
import { LoaderCircle, Trophy } from 'lucide-react'
import { getContributorLeaderboard } from '../../lib/api'
import type { ContributorCounts, ContributorLeaderboard } from '../../lib/api'
import { useApi } from '../../session'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import './legacy.css'
import { PageFrame, PageHeading } from './embed'
import { message } from './utils'

const contributionLabels: { key: keyof ContributorCounts; label: string }[] = [
  { key: 'certifications', label: 'Certifications' },
  { key: 'resources', label: 'Resources' },
  { key: 'ideas', label: 'Ideas' },
  { key: 'questions', label: 'Questions' },
  { key: 'comments', label: 'Comments' },
  { key: 'helpfulReceived', label: 'Helpful votes' },
]

export function LeaderboardPage({ embedded = false }: { embedded?: boolean }) {
  useDocumentTitle('Leaderboard', !embedded)
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

  return <PageFrame embedded={embedded} className="community-page">
    <PageHeading embedded={embedded} title="Contributor leaderboard" description="Earn points for every contribution and helpful vote." />
    {error && <div className="alert error" role="alert">{error}</div>}
    {loading ? <div className="loading-state"><LoaderCircle className="spin" size={20} /> Loading the leaderboard</div> : board && <>
      <div className="contribution-stats">
        <div className="contribution-stat"><strong>{contributors.length}</strong><small>Ranked contributors</small></div>
        <div className="contribution-stat"><strong>{contributors[0]?.score ?? 0}</strong><small>Top score</small></div>
        <div className="contribution-stat"><strong>{me ? `#${me.rank}` : '–'}</strong><small>Your rank</small></div>
        <div className="contribution-stat"><strong>{me?.score ?? 0}</strong><small>Your score</small></div>
      </div>
      <section className="score-guide" aria-label="How leaderboard points are calculated">
        <strong className="score-guide-title">How points work</strong>
        <div className="score-guide-chips">{contributionLabels.map((item) => <span key={item.key} className="chip">{item.label} +{board.weights[item.key]}</span>)}</div>
      </section>
      {contributors.length ? <ol className="list leaderboard-list">{contributors.map((item) => <li key={item.userId} className={`leaderboard-row ${item.isCurrentUser ? 'is-me' : ''}`}>
        <span className="leaderboard-rank" aria-label={`Rank ${item.rank}`}>{item.rank}</span>
        <span className="avatar" aria-hidden="true">{item.displayName.slice(0, 1).toUpperCase()}</span>
        <div className="leaderboard-name"><strong>{item.displayName}{item.isCurrentUser && <span className="chip chip-accent">You</span>}</strong><div className="leaderboard-breakdown">{contributionLabels.filter((label) => item.counts[label.key] > 0).map((label) => <span key={label.key}>{item.counts[label.key]} {label.label.toLowerCase()}</span>)}</div></div>
        <strong className="leaderboard-score">{item.score}<small>points</small></strong>
      </li>)}</ol> : <div className="empty-state"><Trophy className="empty-icon" size={20} aria-hidden="true" /><h3>No contributions yet</h3><p>Scores appear once people add certifications, share resources, post ideas or questions, comment, or receive helpful votes.</p></div>}
    </>}
  </PageFrame>
}
