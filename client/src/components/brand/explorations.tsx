/**
 * Logo explorations (dev only). Not rendered in the app; open
 * http://localhost:5174/?brand=1 in development to see this gallery.
 * Each direction is drawn on the 24-unit grid with a 3-unit stroke.
 */
import type { ReactNode } from 'react'
import { MARK_GLYPH_PATHS } from './geometry'
import { Wordmark } from './Wordmark'
import './explorations.css'

type Direction = { id: string; name: string; idea: string; verdict: string; glyph: ReactNode }

const stroke = { fill: 'none', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const directions: Direction[] = [
  {
    id: 'u-arrow', name: 'A. Rising u (chosen)',
    idea: 'A lowercase u whose right stem keeps rising into an arrowhead: material goes in on the left, one path comes out pointing up.',
    verdict: 'Ties the mark to the name, one continuous stroke, reads at 16 px.',
    glyph: <g {...stroke}>{MARK_GLYPH_PATHS.map((d) => <path key={d} d={d} />)}</g>,
  },
  {
    id: 'step-check', name: 'B. Steps into a check',
    idea: 'Two steps climb from the lower left and resolve into a checkmark.',
    verdict: 'Says "checklist", but the steps turn to noise below 20 px.',
    glyph: <path {...stroke} d="M5 17h3.5v-3.5H12l2.5 2.5L19.5 8" />,
  },
  {
    id: 'bookmark', name: 'C. Bookmark with an up notch',
    idea: 'A bookmark (the saved study material) whose notch is an upward chevron.',
    verdict: 'Clean, but reads as a generic bookmark/save icon.',
    glyph: <path fill="currentColor" d="M7 4.5h10a1 1 0 0 1 1 1V19.5l-6-5-6 5V5.5a1 1 0 0 1 1-1Z" />,
  },
  {
    id: 'distill', name: 'D. Three bars narrowing to a point',
    idea: 'Wide material at the bottom narrows upward into a single point.',
    verdict: 'Good story, but looks like a tree or a stats glyph.',
    glyph: <g fill="currentColor"><rect x="4" y="16" width="16" height="3" rx="1.5" /><rect x="7" y="11" width="10" height="3" rx="1.5" /><path d="M12 4.5 15.5 9h-7Z" /></g>,
  },
  {
    id: 'exam-path', name: 'E. Path through the exam',
    idea: 'A circle (the exam) with one path entering low and leaving high.',
    verdict: 'At small sizes the ring and diagonal read as a "no entry" sign. Rejected.',
    glyph: <g {...stroke}><circle cx="12" cy="12" r="7" strokeWidth="2" /><path d="M6 18 18 6M12.5 6H18v5.5" /></g>,
  },
]

function Tile({ size, children, inverse }: { size: number; children: ReactNode; inverse?: boolean }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <rect width="24" height="24" rx="6" fill={inverse ? 'var(--color-surface)' : 'var(--color-accent)'} />
    <g color={inverse ? 'var(--color-accent)' : 'var(--color-surface)'} stroke="currentColor">{children}</g>
  </svg>
}

export function BrandExplorations() {
  return <div className="brand-explorations">
    <h1>Upskill mark explorations</h1>
    <p className="muted">Each direction at 16, 28 and 64 px, then inverted, then as a bare glyph. Dev only.</p>
    {directions.map((d) => <section key={d.id} className="brand-exploration">
      <div className="brand-exploration-sizes">
        <Tile size={16}>{d.glyph}</Tile>
        <Tile size={28}>{d.glyph}</Tile>
        <Tile size={64}>{d.glyph}</Tile>
        <span className="brand-exploration-dark"><Tile size={28} inverse>{d.glyph}</Tile></span>
        <svg width={28} height={28} viewBox="0 0 24 24" aria-hidden="true" color="var(--color-text)" stroke="currentColor">{d.glyph}</svg>
      </div>
      <div><strong>{d.name}</strong><p>{d.idea}</p><p className="muted">{d.verdict}</p></div>
    </section>)}
    <section className="brand-exploration">
      <div className="brand-exploration-sizes"><span style={{ fontSize: 26 }}><Wordmark /></span></div>
      <div><strong>Wordmark</strong><p>DM Sans 600, lowercase, -0.02 em; the tittle on the i carries the accent instead of a trailing period.</p></div>
    </section>
  </div>
}
