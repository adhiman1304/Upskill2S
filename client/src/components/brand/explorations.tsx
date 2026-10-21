/**
 * Logo explorations (dev only). Not rendered in the app; open
 * http://localhost:5174/?brand=1 in development to see this gallery.
 *
 * Round 2: every direction is drawn on the 24-unit grid with filled, straight
 * edged shapes or square-capped, mitered 3-unit strokes. Tile radius 3.
 */
import type { ReactNode } from 'react'
import { MARK_GLYPH_PATHS, MARK_TILE_RADIUS } from './geometry'
import { Wordmark } from './Wordmark'
import './explorations.css'

type Direction = { id: string; name: string; idea: string; verdict: string; glyph: ReactNode; radius?: number; chosen?: boolean }

const sharp = { fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'butt', strokeLinejoin: 'miter', strokeMiterlimit: 10 } as const
const solid = { fill: 'currentColor', stroke: 'none' } as const

const directions: Direction[] = [
  {
    id: 'bracket-u', name: 'E. Rising bracket u (chosen; also the u of the logotype)', chosen: true,
    idea: 'The "u" of upskill drawn as a square bracket, its right stem rising one module above the left. One filled shape, straight edges, square corners.',
    verdict: 'Reads as a letter, not an icon; owns the name; every edge is on the 3-unit module, so it renders with zero anti-aliased edge pixels at 16, 24 and 32 px, and at 28 and 36 px on 2x screens. In the logotype the same u, in the text colour, replaces the "u" of upskill.',
    glyph: <g {...solid}>{MARK_GLYPH_PATHS.map((d) => <path key={d} d={d} />)}</g>,
  },
  {
    id: 'bracket-u-nib', name: 'E2. Bracket u with a cut nib',
    idea: 'The same u with the top of the rising stem cut at 45 degrees, so it points up like a nib or an arrow.',
    verdict: 'More directional, but the one diagonal edge is the only soft edge in the mark and it reads as a pencil. Kept as a variant.',
    glyph: <path {...solid} d="M6 9H9V15H15V9L18 6V18H6Z" />,
  },
  {
    id: 'bars', name: 'A. Three ascending bars',
    idea: 'Three bars whose top edges climb on a diagonal: a staircase, and three items in a list. A square notch on the last bar fills in below 24 px, so it was dropped.',
    verdict: 'Crisp at every size, but it is the phone signal-strength icon and a generic analytics glyph. Not ownable.',
    glyph: <path {...solid} d="M4.5 15h3v4.5h-3ZM10.5 10.5h3v9h-3ZM16.5 4.5h3v15h-3Z" />,
  },
  {
    id: 'step-check', name: 'B. Stepped checkmark',
    idea: 'A checkmark from straight segments only: a level run, a 90 degree drop, then a 45 degree climb. Square caps, miter joins.',
    verdict: 'Says "checked", but the long diagonal cannot sit on the pixel grid and at 16 px it is a todo-app tick.',
    glyph: <path {...sharp} d="M4.5 12H9V16.5L19.5 6" />,
  },
  {
    id: 'chevrons', name: 'C. Chevron stack',
    idea: 'Two nested hard chevrons pointing up: two levels climbed.',
    verdict: 'Sharp and simple, but reads as a military rank, an upvote or a "scroll to top" button.',
    glyph: <path {...sharp} d="M6 13.5 12 7.5l6 6M6 19.5l6-6 6 6" />,
  },
  {
    id: 'diagonal', name: 'D. Diagonal cut',
    idea: 'A solid square split by one channel from lower left to upper right; the negative space is the way up.',
    verdict: 'Confident at 64 px, but the 45 degree channel blurs at 16 px and the shape reads as a slash or a "no" sign.',
    glyph: <path {...solid} fillRule="evenodd" d="M6 6h12v12H6ZM6 15.9 15.9 6H18v2.1L8.1 18H6Z" />,
  },
]


function Tile({ size, children, inverse, radius = MARK_TILE_RADIUS, crisp }: { size: number; children: ReactNode; inverse?: boolean; radius?: number; crisp?: boolean }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" shapeRendering={crisp ? 'crispEdges' : 'geometricPrecision'}>
    <rect width="24" height="24" rx={radius} fill={inverse ? 'var(--color-surface)' : 'var(--color-accent)'} />
    <g color={inverse ? 'var(--color-accent)' : 'var(--color-surface)'}>{children}</g>
  </svg>
}

function Row({ d }: { d: Direction }) {
  return <section className={['brand-exploration', d.chosen ? 'is-chosen' : ''].filter(Boolean).join(' ')}>
    <div className="brand-exploration-sizes">
      <Tile size={16} radius={d.radius}>{d.glyph}</Tile>
      <Tile size={28} radius={d.radius}>{d.glyph}</Tile>
      <Tile size={64} radius={d.radius}>{d.glyph}</Tile>
      <span className="brand-exploration-dark"><Tile size={28} inverse radius={d.radius}>{d.glyph}</Tile></span>
      <svg width={28} height={28} viewBox="0 0 24 24" aria-hidden="true" color="var(--color-accent)">{d.glyph}</svg>
    </div>
    <div><strong>{d.name}</strong><p>{d.idea}</p><p className="muted">{d.verdict}</p></div>
  </section>
}

const roundOne: Direction = {
  id: 'round-1', name: 'Round 1, rejected: too round',
  idea: 'The rising u from round 1: round caps, a radius-4 bowl and a radius-6 tile.',
  verdict: 'Soft and low definition at small sizes; did not match the plain, hairline UI.',
  radius: 6,
  glyph: <g fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 9V13.5a4 4 0 0 0 8 0V6" /><path d="M11.5 9 14.5 6 17.5 9" /></g>,
}

export function BrandExplorations() {
  const chosen = directions[0]
  return <div className="brand-explorations">
    <h1>Upskill mark explorations, round 2</h1>
    <p className="muted">Each direction at 16, 28 and 64 px, then inverted, then as a bare glyph in the accent. 24-unit grid, square caps and miter joins, tile radius 3. Dev only.</p>
    {directions.map((d) => <Row key={d.id} d={d} />)}
    <section className="brand-exploration">
      <div className="brand-exploration-sizes brand-exploration-render">
        {[16, 24, 28, 32].map((s) => <span key={s}><Tile size={s} crisp>{chosen.glyph}</Tile><Tile size={s}>{chosen.glyph}</Tile><small>{s}</small></span>)}
      </div>
      <div><strong>Rendering check</strong><p>Chosen mark at 16, 24, 28 and 32 px: left <code>crispEdges</code>, right <code>geometricPrecision</code>.</p><p className="muted">Every glyph edge is on the 3-unit module, so both modes give identical hard edges; the glyph ships with <code>crispEdges</code> as a guard, the tile keeps <code>geometricPrecision</code> so its radius-3 corners stay smooth.</p></div>
    </section>
    <section className="brand-exploration brand-exploration-wide">
      <div className="brand-exploration-type">
        {[16, 28, 40].map((px) => <div key={px} style={{ fontSize: px }}>
          <Wordmark /><Wordmark text className="brand-exploration-plain" /><small>{px}</small>
        </div>)}
      </div>
      <div><strong>Logotype: the mark is the u</strong><p>At 16, 28 and 40 px, the bracket u in the text colour followed by "pskill" in DM Sans 600, -0.02 em; plain-text "upskill" beside it for comparison.</p><p className="muted">The glyph uses DM Sans 600's own u metrics: 0.604 em advance, 0.06 em left bearing, 0.12 em stems, 0.10 em bowl, x-height 0.505 em. The right stem rises to 0.673 em, a third of the x-height, below the 0.72 em ascender of k and l, so it reads as u and not d. No accent dot on the i: the mark carries the idea alone.</p></div>
    </section>
    <Row d={roundOne} />
  </div>
}
