# G handoff: design pass

Status: done. `npm --prefix client run build` passes. `npm --prefix client run lint` reports 0 errors and 1 warning: the existing `react-hooks/exhaustive-deps` warning on `items` in `LibraryPage.tsx`. No server files were changed, and no flows were added or removed.

> **Integrator, read first.** Commit `0baf423` ("Export gathered certification knowledge…") was made while this pass was running.
> - It swept in all of G's client changes and the 1280 px screenshots.
> - It also swept in an `undefined/` directory (442 files). That directory is a headless Chrome profile that G's screenshot script created by mistake: a zsh word-splitting bug passed the profile path as `undefined`.
> - G deleted the directory from disk, so `git status` now shows those files as deleted. Run `git rm -r --cached undefined` (or `git add -A undefined`) and commit. Consider adding `undefined/` to `.gitignore`.
> - The two `docs/screenshots/*-390.png` files are modified again (re-captured with real 390 px emulation) and are not committed.

## Token set (`client/src/styles/tokens.css`)

| Group | Tokens |
|---|---|
| Neutrals | `--color-bg #f7f7f5`, `--color-surface #fff`, `--color-surface-muted #f2f3f0`, `--color-border #e2e4df` (the only border color), `--color-text #1d211c`, `--color-text-muted #5f665d`, `--color-text-subtle #868c84` |
| Accent (one) | `--color-accent #3b5a2a`, `--color-accent-hover #2e4720`, `--color-accent-soft #edf2e8`, `--color-focus #86a36b` |
| Semantic (fresh / stale / error only) | `--color-fresh #2f6a35` / `--color-fresh-bg`, `--color-stale #87590a` / `--color-stale-bg`, `--color-error #a43a28` / `--color-error-bg` |
| Spacing | `--space-1..7` = 4, 8, 12, 16, 24, 32, 48 px |
| Radius | `--radius-sm 4px`, `--radius 6px`, `--radius-pill` |
| Shadow (one) | `--shadow`, used only for floating layers: search popover, dialog, versions drawer |
| Type | `--font` DM Sans; `--text-sm 13`, `--text-base 15`, `--text-md 17`, `--text-lg 22`, `--text-display 30` (Home hero only); weights 400 (body), 500 (buttons, nav, emphasis), 600 (headings); `--leading 1.45` |
| Layout | `--sidebar-width 220px`, `--topbar-height 52px`, `--page-max 960px`, `--page-max-wide 1200px` (brief page only), `--control-height 40px` |

## Style file map

| File | Holds |
|---|---|
| `styles/tokens.css` | Every color, size, radius and shadow. |
| `styles/base.css` | Reset, body and typography, links, `code`, `.sr-only`. Page header: `.page-header`, `.page-desc`, `.breadcrumb`, `.back-link`. `.section` and `.section-heading`, `.card`. Buttons: `.button-primary`, `.button-secondary`, `.button-quiet`, `.button-small`, `.text-button`, `.icon-button`. Form controls: `.field`, `.inline-field`, `.check`, `.form-grid`, `.form-actions`, `.form-heading`. `.chip` with variants `is-fresh`, `is-stale`, `is-missing`, `chip-planning`, `chip-studying`, `chip-passed`, `chip-accent`, `chip-warning`. `.alert` (default, `error`, `success`, `warning`), `.empty-state`, `.loading-state`, `.list` (hairline rows), `.table`, `.facts`, the dialog (`.modal-*`) and `.provider-logo`. |
| `styles/layout.css` | `.app-shell`, sidebar, mobile top bar and menu, `.page-content` container, the API key notice, and the sign-in and setup screens. |
| `pages/home/home.css` | Hero, typeahead search, My certifications rows, provider tiles, "How it works". |
| `pages/brief/brief.css` | Compact header, job log, body sections, checklist, skills, gaps, link lists, source chips, vote buttons, collapsible sources, versions drawer, the right column at 1100 px and above. |
| `pages/intake/intake.css` | Intake form, history, the result page, recommendation cards. |
| `pages/settings/settings.css` | Key form and model list. |
| `pages/admin/admin-ops.css` | Stat groups, ops sections, job table details, status chip colors. |
| `pages/legacy/legacy.css` | Library (provider tiles, cert list, filters), certification detail, resource cards and dialogs, review queue, Ideas & questions, contributions, leaderboard. |

Deleted: `index.css` (leftover Vite starter), `Portal.css`, `Features.css`, `Community.css`, `ProviderDirectory.css`, `components/layout/layout.css`. `main.tsx` imports the three shared files once. Each page imports its own slim file. I checked for dead classes: no class in the CSS lacks a user in the TSX, apart from ones built dynamically such as `is-${status}` and `ops-status-${x}`.

New helper: `hooks/useDocumentTitle.ts`. `useDocumentTitle(title)` sets the title to "<title> | Upskill". `routeTitle(pathname)` gives the mobile top bar its page name.

## Before → after decisions

- **Type**:
  - Before: DM Sans plus Space Grotesk, in sizes from 8 to 34 px (many 9 to 11 px labels in uppercase with letter spacing).
  - After: DM Sans only, including the brand mark. The `@fontsource/space-grotesk` imports are removed from `main.tsx`; the package is still in `client/package.json` and can be removed.
  - Four sizes plus the display size. The smallest is 13 px, with one exception: source-number chips and ops hints are 12 px.
  - Uppercase eyebrows ("SUMMARY", "QUEUE", "YOUR PROFILE", …) are now sentence-case headings or were removed where redundant.
- **Chrome**:
  - Removed the gradients (hero, overview strip, provider cards, profile panel, score guide, leaderboard medals and avatars), glows, card shadows, entry animations (cert rows, intake recommendations), colored icon boxes (settings, home steps, contribution stats, empty states), the decorative sidebar note and the library page footer.
  - One border color. One shadow, on floating layers only.
- **Density**:
  - Page padding is 24 px on desktop and 16 px on mobile; cards are 16 px.
  - Brief sections, ops sections, settings, intake profile and gaps are now plain sections with text titles instead of boxed cards.
  - Lists use hairline dividers: My certifications, intake history, gaps, link lists, posts, activity, leaderboard, review queue, versions.
  - Cards remain only where an item is a card: resource cards, intake recommendations, the community composer.
- **Page grammar**:
  - Every page uses `.page-header`: an `h1`, an optional one-line `.page-desc`, and at most one primary button on the right.
  - Breadcrumbs are kept only where there is real hierarchy: intake result, library detail.
- **Navigation**:
  - The desktop sidebar is 220 px with text links (no icons), section labels and an account row at the bottom.
  - Below 900 px, a sticky top bar shows the brand, the page name and a menu button. The menu is a full-width overlay with all links and labels; links are 44 px tall.
  - The menu closes when you pick a link or press Escape. The button has `aria-expanded` and `aria-controls`.
  - The old bottom bar (icon-only, scrolling sideways) is gone.
- **API key notice**: one line, "Add your OpenAI key in Settings to generate briefs", with "Settings" as the link. It has a dismiss button (dismissal lasts for the session, in component state) and truncates with an ellipsis instead of wrapping.
- **Brief header**:
  - Before: logo glyph, breadcrumb, a two-line title, then chip, link and version, then two labelled selects, then two buttons.
  - After, three rows:
    1. Provider logo, then code and title in one `h1`.
    2. The freshness chip, "Official exam page", and "Version N · X sources". The version text is now the button that opens the Versions drawer.
    3. An inline "Status" select (plus "Target date" when following), with Refresh as the single primary button on the right.
  - On mobile the back link is hidden, the `h1` is 17 px and the source count is hidden. The first content (Summary) starts at 216 px from the top without the API key notice (256 px with it).
  - The skills, learning path, community resources and **Sources** column sits on the right only at 1100 px and above; below that everything is one column. Sources is a collapsible `<details>` at every width.
- **Components**:
  - The checklist uses native, visible checkboxes with `aria-label={item.title}`. This fixes the accessible name "on".
  - Feedback votes are text buttons with counts ("Accurate 3", "Inaccurate", "Outdated"). Your own vote is highlighted in fresh, error or stale color.
  - Freshness uses a `.chip` with a dot (fresh, stale, none). Follow status on Home uses `chip-planning`, `chip-studying` and `chip-passed`.
  - Library provider tiles have `aria-label="Microsoft, 22 certifications"`. Resource-kind buttons have `aria-pressed` and `aria-label`.
  - Selects, inputs and buttons are plain and native; filter selects no longer have icon wrappers.
- **Home**:
  - The search placeholder is now "Exam code or name, e.g. AZ-104" and fits at 390 px.
  - The result count is hidden on mobile.
  - My certifications rows move the follow status, chip and "Researched" date to a second line on mobile instead of hiding them.
  - Provider subtitles wrap on desktop and are hidden on mobile instead of being truncated.
- **Anthropic tile**: removed from `featuredProviders`. It appears on `/library` only if the database has Anthropic certifications (it then comes in as an "additional" provider). The Home filter for it was removed as no longer needed.
- **Page titles**: every route sets `document.title`, for example "Find a certification | Upskill", "Study Brief: DP-700 | Upskill", "Library: Microsoft | Upskill", "DP-700 resources | Upskill", "Operations | Upskill". The sign-in screen is "Sign in | Upskill", and `index.html` defaults to "Upskill".
- **Legacy pages**: same tokens and components, flows unchanged.
  - The library provider banner is replaced by a page description with the count. The filtered count now shows under the filters.
  - Glyph avatars in rows are removed.
  - The resource quality block is plain text inside the card instead of a box inside a card.

## Verified

- Build and lint as above.
- The API ran on 4010 (local bypass) and the client on 5174. I walked every route at 1280 px and at 390 px: `/`, `/intake`, `/certifications/<DP-700 id>`, `/settings`, `/admin/ops`, `/library` (plus the Microsoft provider view), `/library/:id`, `/community`, `/saved`, `/contributions`, `/leaderboard`, `/admin/reports`.
  - No horizontal scroll on any route at 390 px (`scrollWidth <= innerWidth`, and no element extends past the viewport except inside `.table-wrap`).
  - No console errors.
  - Titles are correct on every route.
- The mobile menu opens, lists every link, closes when you pick a link (checked by going to Leaderboard), and the top bar title updates.
- Checklist check-off persists: I checked an item, reloaded and it was still checked (1 of 18), then unchecked it to restore the state. The checkbox's accessible name is the item title.
- Search still navigates: typing "dp-700" and pressing Enter opens the brief.
- Screenshots in `docs/screenshots/`: `home-1280.png`, `home-390.png`, `brief-1280.png`, `brief-390.png`. They were captured with headless Chrome over CDP, with real device-metrics emulation for 390 px.
- Both servers are stopped; ports 4010 and 5174 are free.

## Left / not verified

- No certification has resources, posts or contributions in the local database, so these were checked only for markup and CSS, not with live data:
  - resource cards and the resource detail dialog
  - the add-resource and certification dialogs
  - populated leaderboard, activity and community posts
- Not exercised: the job progress panel (needs a running job), the versions drawer and the intake result page.
- `@fontsource/space-grotesk` is still a dependency in `client/package.json` (unused). Remove it with `npm --prefix client uninstall @fontsource/space-grotesk`.
- The bundle is still over 500 kB (no route splitting; out of scope).
