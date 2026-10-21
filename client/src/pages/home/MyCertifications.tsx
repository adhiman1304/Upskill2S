import { Link } from 'react-router-dom'
import { ArrowRight, BookmarkCheck, LoaderCircle } from 'lucide-react'
import { ProviderLogo } from '../legacy/providers'
import { formatDate } from '../legacy/utils'
import { FreshnessChip } from './FreshnessChip'
import type { MyCertificationsState } from './useMyCertifications'

const followLabels = { PLANNING: 'Planning', STUDYING: 'Studying', PASSED: 'Passed' } as const

/** Followed certifications first, then recently researched ones (empty-query search). */
export function MyCertifications({ state }: { state: MyCertificationsState }) {
  return <section id="mine" className="section home-anchor" aria-labelledby="mine-heading">
    <div className="section-heading"><div><h2 id="mine-heading">My certifications</h2><p>Followed first, then recently researched on Upskill.</p></div>{!state.loading && <span className="result-count">{state.items.length} {state.items.length === 1 ? 'certification' : 'certifications'}</span>}</div>
    {state.error && <div className="alert error" role="alert">{state.error}</div>}
    {state.loading ? <div className="loading-state"><LoaderCircle className="spin" size={20} /> Loading your certifications</div>
      : state.items.length ? <ul className="list mine-list">{state.items.map((item) => <li key={item.certificationId ?? `${item.provider}:${item.code}`}>
        <Link className="mine-row" to={`/certifications/${encodeURIComponent(item.certificationId ?? '')}`}>
          <span className="provider-logo"><ProviderLogo name={item.provider} /></span>
          <span className="mine-text"><strong>{item.code} <span className="mine-provider">{item.provider}</span></strong><span>{item.title}</span></span>
          <span className="mine-meta">{item.following && <span className={`chip chip-${item.following.status.toLowerCase()}`}>{followLabels[item.following.status]}</span>}<FreshnessChip status={item.briefStatus} /><small>{item.lastResearchedAt ? `Researched ${formatDate(item.lastResearchedAt)}` : 'Not researched yet'}</small></span>
        </Link>
      </li>)}</ul>
      : !state.error && <div className="empty-state"><BookmarkCheck className="empty-icon" size={20} aria-hidden="true" /><h3>No certifications yet</h3><p>Search for an exam, or let us suggest one that fits your goals. Certifications you follow will show up here.</p><Link className="button button-secondary" to="/intake">Help me choose</Link></div>}
  </section>
}

/** Compact "Continue" card for the most relevant certification: the first followed one still in progress, else the most recent. */
export function ContinueCard({ state }: { state: MyCertificationsState }) {
  const withId = state.items.filter((item) => item.certificationId)
  const item = withId.find((entry) => entry.following && entry.following.status !== 'PASSED') ?? withId[0]
  if (state.loading || !item) return null
  return <Link className="card home-continue" to={`/certifications/${encodeURIComponent(item.certificationId ?? '')}`}>
    <span className="provider-logo"><ProviderLogo name={item.provider} /></span>
    <span className="home-continue-text">
      <small>Continue</small>
      <strong>{item.code} <span className="home-continue-title">{item.title}</span></strong>
    </span>
    {item.following ? <span className={`chip chip-${item.following.status.toLowerCase()}`}>{followLabels[item.following.status]}</span> : <FreshnessChip status={item.briefStatus} />}
    <ArrowRight className="home-continue-arrow" size={16} aria-hidden="true" />
  </Link>
}
