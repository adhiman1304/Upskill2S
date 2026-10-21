/**
 * The Upskill mark, round 2: a lowercase "u" drawn as a square bracket whose
 * right stem rises one module above the left. One filled shape, straight
 * edges, square corners. The u is the name; the taller right stem is the one
 * path out of the material, going up.
 *
 * Construction: 24-unit grid on a 3-unit module (an 8 x 8 module grid). Every
 * edge is a multiple of 3 units, so it lands on whole device pixels at 16, 24,
 * 32, 48 and 64 px, and at 28 and 36 px on 2x screens.
 * - Tile: 24 x 24, corner radius 3.
 * - Glyph box: x 6 to 18, y 6 to 18 (12 x 12, centred, 6-unit margins).
 * - Left stem: x 6 to 9, y 9 to 18 (three modules).
 * - Right stem: x 15 to 18, y 6 to 18 (four modules: one above the left).
 * - Bowl: x 6 to 18, y 15 to 18.
 * - Counter: x 9 to 15, y 9 to 15 (a 6 x 6 square, two modules).
 * Stem and bowl weight 3 units: 2 px at 16 px, 3 px at 24 px, 4 px at 32 px.
 */
export const MARK_TILE_RADIUS = 3

export const MARK_GLYPH_PATHS = ['M6 9H9V15H15V6H18V18H6Z'] as const

/**
 * The same bracket u tuned to stand in for the "u" of DM Sans 600 inside the
 * wordmark. Units are 1/1000 em, measured from DM Sans 600's own "u":
 * - Advance 604 (the font's u), ink x 60 to 538 (its side bearings).
 * - Stems 120 wide (the font's stem), bowl 100 thick (the font's thinner
 *   bottom stroke, so the stroke contrast matches).
 * - Right stem runs from the x-height (505) to the baseline, so the top of
 *   the u lines up with the top of the p that follows. The left stem starts
 *   one quarter lower (y 126), the same 3 : 4 ratio as the tiled mark, so the
 *   wordmark keeps the mark's shape without rising above the x-height.
 * The viewBox runs from the x-height (y 0) to the baseline (y 505), so the
 * SVG sits on the text baseline with vertical-align: baseline.
 */
export const WORDMARK_U = {
  width: 604,
  height: 505,
  path: 'M60 126H180V405H418V0H538V505H60Z',
} as const
