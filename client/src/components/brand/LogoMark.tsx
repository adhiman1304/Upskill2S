import { MARK_GLYPH_PATHS } from './geometry'

type LogoMarkProps = {
  /** Rendered width and height in px. */
  size?: number
  /** `accent`: green tile, white glyph (default). `inverse`: white tile, green glyph, for dark or accent backgrounds. `glyph`: no tile, glyph in currentColor. */
  tone?: 'accent' | 'inverse' | 'glyph'
  className?: string
  /** When set, the mark is announced with this label; otherwise it is decorative. */
  title?: string
}

export function LogoMark({ size = 28, tone = 'accent', className, title }: LogoMarkProps) {
  const tile = tone === 'accent' ? 'var(--color-accent)' : tone === 'inverse' ? 'var(--color-surface)' : 'none'
  const ink = tone === 'accent' ? 'var(--color-surface)' : tone === 'inverse' ? 'var(--color-accent)' : 'currentColor'
  const labelled = Boolean(title)
  return <svg className={['logo-mark', className].filter(Boolean).join(' ')} width={size} height={size} viewBox="0 0 24 24" role={labelled ? 'img' : undefined} aria-label={title} aria-hidden={labelled ? undefined : true} focusable="false">
    {tone !== 'glyph' && <rect width="24" height="24" rx="6" fill={tile} />}
    <g fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      {MARK_GLYPH_PATHS.map((d) => <path key={d} d={d} />)}
    </g>
  </svg>
}
