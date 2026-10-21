# H handoff: mobile redesign

Status: done. `npm --prefix client run build` passes. `npm --prefix client run lint` reports 0 errors and 1 warning (the existing `react-hooks/exhaustive-deps` warning in `LibraryPage.tsx`). No server files changed. No features were removed, and behavior changed only in layout and navigation. Nothing is committed.

Mobile means below 900 px, the same breakpoint the top bar uses. The breakpoint is `MOBILE_QUERY` in `client/src/hooks/useMediaQuery.ts`.

## Tabs component

`client/src/components/ui/Tabs.tsx`. Styles are in `client/src/styles/base.css` (`.tabs`, `.tabs-list`, `.tab`).

```tsx
<Tabs
  mode={mobile ? 'tabs' : 'stacked'}   // 'tabs': tab row + active panel. 'stacked': every panel in order, no row.
  label="Study brief sections"         // aria-label of the tablist
  defaultTab="checklist"               // optional; defaults to the first tab
  param="tab"                          // optional; URL search param name
  tabs={[{ id: 'checklist', label: 'Checklist', content: <ChecklistSection … /> }, …]}
/>
```

- **Row:** 2 to 5 equal-width text tabs, 40 px tall, with no horizontal scroll. With 4 or 5 tabs the label is 13 px. The active tab has a surface background, a border and accent text.
- **Accessibility:** `role="tablist"`, `tab` and `tabpanel`, with `aria-selected`, `aria-controls` and `aria-labelledby`. Focus uses a roving `tabIndex`. ArrowLeft and ArrowRight move between tabs (wrapping at the ends), and Home and End jump to the first and last tab. Activation is automatic.
- **URL:** the active tab is read from and written to `?tab=` by `useTabParam` (`client/src/hooks/useTabParam.ts`). The default tab is written as no param, and unknown values fall back to the default. Other params, such as `?fixture=1`, are kept.
- **History:** switching tabs **replaces** the history entry. Refresh keeps the tab. Browser back, and the top-bar back arrow, leave the page instead of stepping through tabs. When you return to a page, it opens on the tab you left it on (for example, Home Mine → brief → back opens Home Mine). This was a deliberate choice; to make tab changes push history entries instead, change `replace: true` in `useTabParam`.
- **Sticky row:** below 900 px the row is sticky directly under the 52 px top bar. It runs full bleed on the page background with a hairline border underneath.
- **Scroll on switch:** if you switch tabs while scrolled down past the row, the page scrolls so the new panel starts directly under the row.
- **Panels:** only the active panel is mounted in `tabs` mode.
- **`useIsMobile()`:** pages choose the mode with this hook, from `hooks/useMediaQuery.ts`. It is built on `useSyncExternalStore` over `matchMedia`, so the layout switches live when the window is resized.

## Which page uses what

| Page | Below 900 px | 900 px and up |
|---|---|---|
| Home `/` | `h1` question, then tabs **Search** \| **Mine** \| **Providers**. Search holds the search box, "Help me choose", a compact **Continue** card, and a collapsible "What happens next" (How it works plus the library note). | Unchanged stacked page (hero, My certifications, providers, How it works). Rendered without `Tabs`. |
| Study Brief `/certifications/:id` | Compact header, then tabs **Checklist** (default) \| **Overview** (summary, warnings, exam facts, skills measured) \| **Gaps** \| **Resources** (official learning path, community resources) \| **Sources** (numbered list, not collapsible). Alerts, the refresh-issue callout and the job progress panel sit above the tabs. Empty Gaps and Resources tabs show a one-line empty state. | Unchanged. `BriefBody` renders the original layout, with the right column at 1100 px and up. |
| Intake `/intake` | Stepper (3 bars plus "Step N of 3" and a title): 1 "Tell us about you" (textarea, dictation, examples), 2 "Add documents (optional)" (Next, or Skip when no files are attached), 3 "Review and send" (summary with Edit links, privacy note, errors, submit). Previous intakes sit behind a "Previous intakes" disclosure at the bottom. | Unchanged single form and history section. |
| Intake result `/intake/:id` | Recommendations first. The profile (summary, skills, goals) is collapsed under "What we understood", below the recommendations and above follow-ups. | Unchanged (profile first). |
| Admin ops `/admin/ops` | Tabs **Summary** (stat groups plus nightly refresh) \| **Stale** \| **Jobs**. The page header and notices stay above the tabs. | `Tabs mode="stacked"`, the same order as before. |
| Settings, legacy pages | Unchanged. No overflow at 390 px. | Unchanged. |

### Details

- **Home, Continue card:** shows the first followed certification that is not Passed, otherwise the most recently researched one. It is hidden while loading or when the list is empty.
- **Home, shared data:** the My certifications data is now fetched once by `useMyCertifications` (`pages/home/useMyCertifications.ts`) and shared by the list and the card.
- **Home, provider tiles:** picking a provider on the Providers tab switches to Search, fills in the provider and focuses the box, so the results popover opens.
- **Home, section headings:** inside mobile tab panels the section `h2`s ("My certifications", "Browse by provider") are visually hidden because the tab label already says it. Each section's one-line description still shows.
- **"My certifications" link:** in the sidebar and the mobile menu, it goes to `/?tab=mine` on mobile and `/#mine` on desktop.
  - Home also accepts the other form at each width. `/#mine` on mobile redirects to `?tab=mine`, and `?tab=mine` on desktop scrolls to `#mine`.
- **Brief header on mobile:**
  - Row 1: the provider logo, then code and title on one line with an ellipsis, then the **checklist %** in accent. It is computed for the shown version and is visible on every tab.
  - Row 2: one nowrap line with the freshness chip, "Exam page" (shortened from "Official exam page"), and "Version N", plus a "Retired" chip when relevant.
  - Row 3: the Status select and Target date with visually hidden labels, then Refresh as the only primary button. The Refresh icon is hidden on mobile to make room for the date field.
- **Top bar on mobile:** shows the current page title (unchanged). The brief (`/certifications/*`) and intake result (`/intake/*`) pages add a 44 px back arrow before the brand. It calls `navigate(-1)` when there is in-app history (`history.state.idx > 0`); otherwise it goes to `/`.
- **Brand:** `<Brand />` is rendered unchanged. **No `size` or `compact` prop is needed** for the top bar; the back arrow fits next to the full brand at 390 px.
- **New shared style:** `.disclosure` in base.css is a `<details>` whose summary reads as a quiet link with a chevron, at least 40 px tall. It is used by "What happens next", "Previous intakes" and "What we understood".

## Screenshots (`docs/screenshots/`)

They were captured with headless Chrome over CDP, using real device-metrics emulation: 390×844 at DPR 2, and 1280×900 at DPR 1. The Chrome profile was kept in the session scratchpad, not the repo.

- `mobile-home-search.png`, `mobile-home-mine.png`, `mobile-brief-checklist.png`, `mobile-brief-overview.png`, `mobile-intake-step1.png` (390 px)
- `desktop-home.png`, `desktop-brief.png` (1280 px)

## Verified

I tested in the in-app browser against the running dev servers at http://localhost:5174, which I did not restart.

**At 390 px:**

- **Home:**
  - `/`, `/?tab=mine` and `/?tab=providers` all render the right tab.
  - Clicking a tab updates the URL.
  - ArrowRight on the last tab wraps to the first.
  - Tabs are 40 px tall.
  - Picking a provider switches to Search with results open.
  - The sidebar link points at `/?tab=mine`.
- **Brief (DP-700):**
  - All five tabs render their content: Gaps shows "Known gaps"; Resources shows "Official learning path" and "Community resources"; Sources lists 22 sources.
  - Each tab updates `?tab=`, and reloading `?tab=sources` keeps Sources.
  - The sticky row sits at `top: 52px` when scrolled.
  - Switching tabs while scrolled down scrolls back up to the panel.
  - **Checklist check-off persists:** I checked item 1, the header showed 6%, and after a reload it was still checked. I then unchecked it to restore the state (0%).
- **Back:** I went Home Mine → brief → Gaps tab → top-bar back arrow, and landed on `/?tab=mine` with Mine selected.
- **Intake:** I walked step 1 (filled in an example), Next, step 2 (Skip), step 3 (the review shows the text; submit is enabled), and Back to step 2. I did **not** submit. "Previous intakes" opens.
- **Admin ops:** Summary, Stale and Jobs each show their sections, and the URL updates (`?tab=stale`, `?tab=jobs`, and none for Summary).
- **Settings and Library:** render without overflow.
- **No horizontal scroll** (`scrollWidth === innerWidth === 390`) on every route above and on every brief tab.
- **No console errors.**

**At 1280 px:**

- Home renders stacked with no tabs. `?tab=mine` scrolls to My certifications.
- The brief has no tabs, the right column is present, and the header % is hidden, even with `?tab=sources` in the URL.
- Intake shows the single form and the history section, with no stepper.
- Admin ops is stacked (Nightly stale refresh, Stale certifications, Jobs) with no tabs.

## Left / not verified

- **Intake result page:** not exercised live. The local database has no intakes, and creating one needs an OpenAI key. The mobile reorder and the "What we understood" disclosure were checked only by reading the code and running the build.
- **Job progress panel:** not exercised with a running job. It renders above the tabs because it comes before `BriefBody` in `BriefPage`.
- **Header progress while scrolling:** on the brief, the header (and its %) scrolls away with the page; only the tab row is sticky. If the % should stay visible while scrolling, it could move into the sticky tab row.
- **Intake step state:** not kept in the URL. Refresh returns to step 1, and the typed text is lost on refresh, as it was before.
