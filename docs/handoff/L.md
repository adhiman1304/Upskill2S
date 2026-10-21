# L handoff: logo and wordmark

Status: done. `npm --prefix client run build` passes. `npm --prefix client run lint` shows no problems in L's files. At the time of writing, the remaining lint error (`react-hooks/preserve-manual-memoization` in the brief page) and the `LibraryPage.tsx` warning are in files that other workstreams own. No server files, router, page files or shared stylesheets were changed.

## Directions explored

All five are drawn in `client/src/components/brand/explorations.tsx`. In development, open `http://localhost:5174/?brand=1` to see them at 16, 28 and 64 px, inverted, and as a bare glyph. Screenshot: `docs/screenshots/brand-explorations.png`.

| | Direction | Verdict |
|---|---|---|
| A | **Rising u**: a lowercase u whose right stem keeps rising into an arrowhead | **Chosen** |
| B | Steps into a check: two steps climb and turn into a checkmark | Says "checklist", but the steps become noise below 20 px |
| C | Bookmark whose notch is an upward chevron | Clean, but reads as a generic save icon |
| D | Three bars narrowing into a point | Good story, but reads as a tree or a stats glyph |
| E | Circle (the exam) with a path through it | At small sizes it reads as a "no entry" sign |

## Why A

- **Story:** scattered material goes in at the short left stem, runs through the bowl, and leaves as one path pointing up. This matches what the product does: it turns a field of material into one path you follow upward.
- **Tied to the name:** it is the "u" of "upskill", so the mark and the name support each other.
- **Simple:** one continuous stroke and one chevron, so it survives a 16 px favicon. The stems are unequal (the right one rises above the left), which keeps it from reading as a plain U-turn sign.

## Construction (24-unit grid)

The geometry is the single source in `client/src/components/brand/geometry.ts`.

- **Tile:** 24 × 24 with corner radius 6, filled `--color-accent` `#3b5a2a`.
- **Glyph stroke:** width 3 in `--color-surface` (white), with round caps and joins. That is 2 px at 16 px and 3.5 px at 28 px.
- **u:** the stems are at x 6.5 and 14.5. The bowl has radius 4, centred at (10.5, 13.5). The left stem starts at y 9, level with the arrow's wings. The right stem runs up to the tip at y 6.
- **Arrow:** wings at 45°, 3 units each side: `M11.5 9 14.5 6 17.5 9`.
- **Optical box:** x 5 to 19, y 4.5 to 19, so the side margins are 5 units each.
- **Colors:** two flat colors and no gradients.
- **Inverse tone:** a white tile with a green glyph, for dark or accent backgrounds.
- **Favicon dark mode:** in dark mode the tile is `#86a36b` (`--color-focus`) and the glyph is `#1d211c`.

## Wordmark

- **Lettering:** "upskill" in DM Sans 600, lowercase, with letter-spacing -0.02 em. Lowercase is used everywhere in the brand. Page titles keep "Upskill", which is how the name is written in a sentence.
- **Period removed:** the old trailing period is gone. The accent moved to the dot on the "i" instead, which echoes the arrow tip in the mark.
- **How the green dot works:** an accent-colored "i" sits under a text-colored dotless "ı", so only the dot shows green. Because this uses the font's own dot, it stays correct at every size. The accessible name is "Upskill".
- **Sizing:** the lockup gap is 0.32 × the mark size. The text is about 0.72 × the mark size, and its x-height is optically centred on the mark.

## Component API (`client/src/components/brand/`)

```tsx
import { LogoMark, Wordmark, MARK_GLYPH_PATHS } from '../brand'
<LogoMark size={28} tone="accent" | "inverse" | "glyph" title?="Upskill" />  // decorative unless title is set
<Wordmark className? />

import { Brand } from './Brand'           // named export, unchanged
import Brand from './Brand'               // default export, also available
<Brand size="sm" | "md" | "lg" compact? className? />
```

- `Brand` sizes (mark / text): `sm` 22 / 17 px, `md` 28 / 20 px (the default, used in the sidebar), `lg` 36 / 26 px.
- `compact` renders the mark only, labelled "Upskill".
- The root element keeps the `.brand` class, so `.sidebar > .brand` and `.sidebar.is-open > .brand` in `layout.css` still apply. It also gets `.brand-lockup` and `.brand-{size}`.
- The mobile top bar (below 900 px) gets 24 / 18 px through `brand.css`.
- The sign-in screen (`.login-copy > .brand`) and the setup screen (`.setup-panel > .brand`) render the plain `<Brand />`. `brand.css` gives them the `lg` sizes by context, so those screen files did not need edits. The sign-in left panel is `--color-surface-muted` (light), so no inverted lockup is needed there.
- `docs/handoff/H.md` did not exist while L worked. If H needs a prop, `size`, `compact` and `className` are available.

## Files

- `client/src/components/brand/geometry.ts`: mark geometry (`MARK_GLYPH_PATHS`).
- `client/src/components/brand/LogoMark.tsx`
- `client/src/components/brand/Wordmark.tsx`
- `client/src/components/brand/index.ts`
- `client/src/components/brand/brand.css`: lockup sizes and wordmark styles.
- `client/src/components/brand/explorations.tsx` and `explorations.css`: the dev-only gallery.
- `client/src/components/layout/Brand.tsx`: composes the mark and the wordmark. It also holds the dev-only `?brand=1` hook. The hook is guarded by `import.meta.env.DEV` and lazy-loaded, so neither the gallery JS nor its CSS ends up in the production bundle. Every `Brand` instance portals the gallery, and CSS shows only the first.
- `client/public/favicon.svg`: the mark, with a dark-mode media query. It replaces the Vite starter favicon.
- `client/public/logo.svg`: the horizontal lockup, 126 × 36. It embeds DM Sans 600 (woff2, SIL OFL) so it renders without the app. The file is about 20 KB.
- `client/index.html`: already referenced `/favicon.svg` with the title "Upskill", so no change was needed.
- `client/public/icons.svg` is an unused Vite starter sprite. It was left in place; it can be deleted.
- Screenshots: `docs/screenshots/brand-sidebar.png` (1280 px), `brand-mobile.png` (390 px top bar), `brand-explorations.png`. All are at 2× scale.
