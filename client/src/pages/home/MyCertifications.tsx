import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookmarkCheck, LoaderCircle } from 'lucide-react'
import { searchCatalog } from '../../lib/api/catalog'
import type { CatalogHitDto } from '../../lib/contracts'
import { useApi } from '../../session'
import { ProviderLogo } from '../legacy/providers'
import { formatDate, message } from '../legacy/utils'
import { FreshnessChip } from './FreshnessChip'

const followLabels = { PLANNING: 'Planning', STUDYING: 'Studying', PASSED: 'Passed' } as const

/** Followed certifications first, then recently researched ones (empty-query search). */
export function MyCertifications() {
  const request = useApi()
  const [state, setState] = useState<{ loading: boolean; items: CatalogHitDto[]; error: string }>({ loading: true, items: [], error: '' })

  useEffect(() => {
    let active = true
    searchCatalog(request, '')
      .then((items) => { if (active) setState({ loading: false, items, error: '' }) })
      .catch((reason: unknown) => { if (active) setState({ loading: false, items: [], error: message(reason, 'Could not load your certifications.') }) })
    return () => { active = false }
  }, [request])

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
      : !state.error && <div className="empty-state"><BookmarkCheck className="empty-icon" size={20} aria-hidden="true" /><h3>No certifications yet</h3><p>Search for an exam above, or let us suggest one that fits your goals. Certifications you follow will show up here.</p><Link className="button button-secondary" to="/intake">Help me choose</Link></div>}
  </section>
}
