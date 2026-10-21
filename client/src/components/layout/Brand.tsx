import { lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { LogoMark, Wordmark } from '../brand'
import '../brand/brand.css'

// Dev-only logo gallery at /?brand=1. Stripped from production builds.
const BrandExplorations = import.meta.env.DEV ? lazy(() => import('../brand/explorations').then((m) => ({ default: m.BrandExplorations }))) : null
const showExplorations = Boolean(BrandExplorations) && typeof location !== 'undefined' && new URLSearchParams(location.search).has('brand')

export type BrandSize = 'sm' | 'md' | 'lg'

type BrandProps = {
  /** Logotype size. sm: 18 px, md: 24 px (default), lg: 32 px. Compact mark: 22, 28, 36 px. */
  size?: BrandSize
  /** Tiled mark only, no logotype. The mark then carries the accessible name. */
  compact?: boolean
  className?: string
}

/**
 * Full brand: the green tiled mark next to the logotype, where the same
 * bracket-u glyph is the "u" of "upskill". Compact: the tiled mark alone.
 */
export function Brand({ size = 'md', compact = false, className }: BrandProps) {
  const classes = ['brand', 'brand-lockup', `brand-${size}`, compact ? 'brand-compact' : '', className ?? ''].filter(Boolean).join(' ')
  return <div className={classes}>
    {compact ? <LogoMark title="Upskill" /> : <><LogoMark /><Wordmark /></>}
    {showExplorations && BrandExplorations && createPortal(<div className="brand-explorations-overlay"><Suspense fallback={null}><BrandExplorations /></Suspense></div>, document.body)}
  </div>
}

export default Brand
