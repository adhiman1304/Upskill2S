import { WORDMARK_U } from './geometry'

type WordmarkProps = {
  className?: string
  /** Plain text "upskill" instead of the bracket-u logotype (fallback, comparisons). */
  text?: boolean
}

/**
 * The logotype: the bracket-u mark, in the text colour and without a tile,
 * stands in for the "u", followed by "pskill" in DM Sans 600, lowercase,
 * -0.02 em. The glyph is sized in em from DM Sans's own u metrics (see
 * WORDMARK_U), so it scales with font-size and sits on the baseline.
 */
export function Wordmark({ className, text = false }: WordmarkProps) {
  return <span className={['wordmark', text ? 'wordmark-text' : '', className].filter(Boolean).join(' ')} aria-label="Upskill" role="img">
    {text
      ? <span aria-hidden="true">upskill</span>
      : <span aria-hidden="true"><svg className="wordmark-u" viewBox={`0 0 ${WORDMARK_U.width} ${WORDMARK_U.height}`} focusable="false"><path d={WORDMARK_U.path} fill="currentColor" /></svg>pskill</span>}
  </span>
}
