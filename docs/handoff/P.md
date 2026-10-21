# P handoff: sidebar hierarchy and hub pages

Status: done. `npm --prefix client run build` passes. `npm --prefix client run lint` reports 0 errors and 1 warning (the existing `react-hooks/exhaustive-deps` warning in `LibraryPage.tsx`). No server files changed. Dev servers were not restarted. Nothing is committed.

## Sidebar (`components/layout/Sidebar.tsx`, styles in `styles/layout.css`)

| Group | Items | Style |
|---|---|---|
| Brand | `<Brand />`, unchanged | |
| Primary (no label) | Find a certification (`/`, Search), Help me choose (`/intake`, Compass; also active on `/intake/:id`), My certifications (`/my-certifications`, BookmarkCheck) | 44 px tall, 15 px, weight 500, text color, 18 px icons. Active: `--color-accent-soft` background, accent text and icon, 3 px accent bar on the left edge (`::before`). Hover: `--color-surface-muted`. |
| Hairline divider | `<hr class="sidebar-divider">` | `--color-border` |
| Secondary | Community (`/community`, Users; also active on `/library/:id`), Admin (`/admin`, ShieldCheck; admins only) | 36 px, 14 px, muted text, 16 px subtle icons. Active: accent-soft background, accent text, weight 500, no bar. |
| Bottom | Settings (secondary style, Settings icon), account row as before | |

- `NavItem` takes `tier` (`primary` / `secondary`), `icon` (a Lucide component) and an optional `match(pathname)` to widen the active state.
- The old section labels (`.sidebar-section-label`) and the five community and two admin links are gone.
- Mobile (below 900 px): the same `Sidebar` is the menu overlay, so it has the same structure. Every item is 44 px there (tap target); hierarchy comes from size, weight, color and the divider. The menu still closes on navigation and on Escape.
- One literal size: 14 px for secondary items (as specified; there is no 14 px token). Everything else uses tokens.

## Hub pages

### Community `/community` (`pages/community/CommunityHubPage.tsx`)

- Header "Community", description "Shared library, saved resources, ideas and feedback, and recognition for contributors." Title "Community | Upskill".
- `Tabs mode="tabs"` at every width, `?tab=` synced (default `library` is written as no param), each tab with a 16 px icon:

| id | Desktop label | Mobile label | Content |
|---|---|---|---|
| `library` | Library | Library | `<LibraryPage embedded />` |
| `saved` | Saved | Saved | `<SavedResourcesPage embedded />` |
| `ideas` | Ideas & feedback | Ideas | `<CommunityPage embedded />` (heading "Ideas & feedback") |
| `contributions` | Contributions | Mine | `<ContributionsPage embedded />` |
| `leaderboard` | Leaderboard | Top | `<LeaderboardPage embedded />` |

- At 390 px the five tabs fit without scrolling (icon above a short label, 48 px tall, from the existing `Tabs` styles). No horizontal scroll exception was needed.
- The Library's selected provider is now in the URL (`?provider=Microsoft`), so the certification page's back link can return to it and browser back steps from a provider to the directory. `useScopedParam` (`pages/community/useScopedParam.ts`) drops `provider` when another tab is opened.

### Admin `/admin` (`pages/admin/AdminHubPage.tsx`)

- Header "Admin", description "Research operations and the review queue for shared resources." Title "Admin | Upskill". Wrapped in `RequireAdmin` (non-admins see "Not authorized").
- Tabs **Operations** (`operations`, default) | **Review queue** (`review`, "Review" on mobile).
- Operations keeps its own Summary | Stale | Jobs tabs on mobile. Inside the hub they use `?section=` (the hub owns `?tab=`), and `section` is dropped when you switch to Review. On mobile the nested row is not sticky (`.hub-panel .tabs` in layout.css), so only the hub row sticks under the top bar.

## Routes (`Portal.tsx`)

| Path | Now |
|---|---|
| `/community` | Community hub (was the Ideas & questions page) |
| `/library` | redirect to `/community?tab=library` |
| `/saved` | redirect to `/community?tab=saved` |
| `/contributions` | redirect to `/community?tab=contributions` |
| `/leaderboard` | redirect to `/community?tab=leaderboard` |
| `/library/:id` | standalone certification detail, unchanged route; back link "Library" goes to `/community?tab=library&provider=<provider>` |
| `/admin` | Admin hub |
| `/admin/ops` | redirect to `/admin?tab=operations` |
| `/admin/reports` | redirect to `/admin?tab=review` |

Redirects use `RedirectToTab`, which keeps other search params (so `/library?provider=AWS` lands on the AWS list). `routeTitle` (mobile top bar) now returns "Community", "Admin" and "Library" (for `/library/:id`); the old per-page names were removed.

## Legacy component changes

- New `pages/legacy/embed.tsx`: `PageFrame` (`.page-content` standalone, `.hub-panel` embedded) and `PageHeading` (`page-header` + `h1` standalone, `section-heading` + `h2` embedded, with an optional action button).
- `LibraryPage`, `SavedResourcesPage`, `CommunityPage`, `ContributionsPage`, `LeaderboardPage`, `AdminReportsPage` and `AdminOpsPage` take `embedded?: boolean` (default `false`, so standalone rendering still works). Embedded: the hub `h1` is the only `h1`, the page's header becomes an `h2` section heading, and the page does not set the document title.
- `useDocumentTitle(title, enabled = true)`: the new second argument lets embedded pages skip setting the title.
- `SavedResourcesPage` hides its "Certification library" back link when embedded. `CertificationDetailPage` back link label is now "Library".
- `LibraryPage`: provider state moved from `useState` to `?provider=` (see above). Flows are otherwise unchanged; admins still see the review panel under a provider's list.
- New styles in `layout.css`: nav tiers, divider, `.hub-panel-heading`, nested-tabs override. No new colors, no gradients.

## Verified

In the in-app browser against the running dev server (http://localhost:5174, local bypass, admin):

- **1280 px:** the sidebar shows the trio, divider, Community and Admin, then Settings. Measured heights 44 / 36 px and sizes 15 / 14 px. Clicking each item navigates and highlights only that item (`/`, `/intake`, `/my-certifications`, `/community`, `/admin`, `/settings`), and titles are correct.
- **Community:** every tab switches and updates `?tab=`; exactly one `h1` on every tab; title stays "Community | Upskill". Library: Microsoft opens (`?provider=Microsoft`), a certification opens `/library/:id` (Community highlighted in the sidebar), and its back link returns to the Microsoft list. Switching to Saved removes `provider`.
- **Redirects:** `/library`, `/saved`, `/contributions`, `/leaderboard`, `/admin/ops`, `/admin/reports` all land on the right hub tab.
- **Admin:** Operations (stacked Summary, Nightly refresh, Stale, Jobs on desktop) and Review queue switch and sync to the URL.
- **390 px:** no horizontal scroll (`scrollWidth === 390`) on every Community tab, the Microsoft list, `/library/:id`, both Admin tabs and `?section=jobs`. The hub row is sticky; the nested Operations row is static. The mobile menu shows the same structure and closes on navigation (picked Community: menu closed, `aria-expanded="false"`, top bar "Community").
- Screenshots in `docs/screenshots/` (headless Chrome over CDP, 1280×900 at DPR 1 and 390×844 at DPR 2): `sidebar-desktop.png`, `community-hub-desktop.png`, `community-hub-mobile.png`, `mobile-menu.png`.

## Left / not verified

- A non-admin session was not exercised live (the local user is admin); the Admin link is gated by `session.isAdmin` and `/admin` by `RequireAdmin`, as before.
- Library, posts, contributions and leaderboard are still mostly empty locally, so populated states inside the hub were checked for markup only.
- Inside the Library tab, a provider list shows "Community library"/provider `h2` and then the existing "Providers" `h2`; left as is.
- The Home page link "Community library" still points at `/library` (redirects fine; Home is not in P's scope).
