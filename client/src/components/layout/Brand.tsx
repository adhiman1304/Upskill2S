import { lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { LogoMark, Wordmark } from '../brand'
import '../brand/brand.css'

// Dev-only logo gallery at /?brand=1. Stripped from production builds.
const BrandExplorations = import.meta.env.DEV ? lazy(() => import('../brand/explorations').then((m) => ({ default: m.BrandExplorations }))) : null
const showExplorations = Boolean(BrandExplorations) && typeof location !== 'undefined' && new URLSearchParams(location.search).has('brand')

export type BrandSize = 'sm' | 'md' | 'lg'

type BrandProps = {
  /** sm: 22 px mark, md: 28 px mark (default), lg: 36 px mark. */
  size?: BrandSize
  /** Mark only, no wordmark. The mark then carries the accessible name. */
  compact?: boolean
  className?: string
}

export function Brand({ size = 'md', compact = false, className }: BrandProps) {
  const classes = ['brand', 'brand-lockup', `brand-${size}`, compact ? 'brand-compact' : '', className ?? ''].filter(Boolean).join(' ')
  return <div className={classes}>
    <LogoMark title={compact ? 'Upskill' : undefined} />
    {!compact && <Wordmark />}
    {showExplorations && BrandExplorations && createPortal(<div className="brand-explorations-overlay"><Suspense fallback={null}><BrandExplorations /></Suspense></div>, document.body)}
  </div>
}

export default Brand
