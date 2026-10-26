import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { ProviderLogo } from '../legacy/providers'
import { FreshnessChip } from './FreshnessChip'
import type { ContinueState } from './useContinueCertification'

/** Compact "Continue" card for the most recently updated Studying certification. Hidden while loading or when there is none. */
export function ContinueCard({ state }: { state: ContinueState }) {
  const item = state.item
  if (state.loading || !item) return null
  const progress = item.brief && item.brief.checklistTotal > 0 ? `${item.brief.checklistDone} of ${item.brief.checklistTotal}` : null
  return <Link className="card home-continue" to={`/certifications/${encodeURIComponent(item.certificationId)}`}>
    <span className="provider-logo"><ProviderLogo name={item.provider} /></span>
    <span className="home-continue-text">
      <small>Continue{progress && <> · {progress} done</>}</small>
      <strong>{item.code} <span className="home-continue-title">{item.title}</span></strong>
    </span>
    <FreshnessChip status={item.brief?.freshness ?? 'missing'} />
    <ArrowRight className="home-continue-arrow" size={16} aria-hidden="true" />
  </Link>
}
