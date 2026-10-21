/**
 * The Upskill mark: a lowercase "u" drawn as one path whose right stem keeps
 * rising past the x-height and resolves into an arrowhead. Scattered material
 * goes in at the left stem, comes out as one path that points up.
 *
 * Construction (24-unit grid): tile 24 x 24, corner radius 6. Glyph stroke 3,
 * round caps and joins. Stems at x = 6.5 and 14.5, bowl radius 4 centred at
 * (10.5, 13.5). The left stem starts at y = 9, the same line as the arrow's
 * wings; the right stem runs to the tip at y = 6. Arrow wings are 45 degrees,
 * 3 units each side. Optical box of the glyph: x 5 to 19, y 4.5 to 19.
 */
export const MARK_GLYPH_PATHS = ['M6.5 9V13.5a4 4 0 0 0 8 0V6', 'M11.5 9 14.5 6 17.5 9'] as const
