# N handoff: Study Brief page redesign

Status: done. Nothing committed. `npx --prefix server tsc -p server/tsconfig.json --noEmit` and `npm --prefix server run lint` pass. `npm --prefix client run lint` reports 0 errors and 1 warning: the existing `exhaustive-deps` warning in `LibraryPage.tsx`. `npm --prefix client run build` passes. No schema change and no migration.

## New UI components (`client/src/components/ui/`)

### `Select.tsx`

```tsx
<Select<T extends string>
  value={T}
  options={{ value: T; label: string; description?: string }[]}
  onChange={(value: T) => void}
  size="md" | "sm"          // 40 px (default) | 36 px
  label="Status"            // accessible name when there is no visible label
  labelledBy={id}           // or: id of a visible label element
  id? disabled? className? align="start" | "end"
/>
```

- It renders a button that looks like an input (border, radius, chevron). The button opens a popover containing a `role="listbox"` list. Each option can carry a description line, and the selected option shows a check mark.
- **Keyboard on the button:** ArrowDown, ArrowUp, Enter or Space opens the list. Typing a letter opens it on the matching option (type-ahead).
- **Keyboard in the list:**
  - Arrows, Home and End move between options.
  - Enter or Space chooses.
  - Escape closes the list and returns focus to the button. Tab closes it.
  - Type-ahead matches label prefixes; pressing the same letter again cycles through the matches.
- **Mouse:** an outside click closes the list.
- **Accessibility:** the active option is tracked with `aria-activedescendant`.

### `DateField.tsx`

```tsx
<DateField value={'2026-11-12' | null} onChange={(iso | null) => void}
  placeholder="Target date" label? size="md" | "sm" disabled? className? align? />
```

- **Button:** shows a calendar icon, then the formatted date ("12 Nov 2026", en-GB) or the placeholder, then a chevron.
- **Popover** (`role="dialog"`), containing:
  - a header with previous month, the month name and next month;
  - a Monday-first grid (`role="grid"`);
  - Today and Clear in the footer.
- **Keyboard in the grid:** the arrows move by a day or a week, PageUp and PageDown move by a month, and Home and End jump to the start or end of the week. Enter or Space chooses a day. Escape closes and returns focus to the button.
- **Output:** an ISO `YYYY-MM-DD` date, or null when cleared.
- **Dependencies:** none. The calendar math lives in `date-utils.ts`.

### Shared helpers

- **`usePopover.ts`:** `usePopover<TTrigger, TRoot>()` returns `{ open, setOpen, close(restoreFocus?), rootRef, panelRef, triggerRef }`.
  - It handles outside-pointer close and Escape.
  - It nudges the panel back inside the viewport using margins, not transforms. Transforms still widened `scrollWidth` at 390 px.
  - Select, DateField and the brief's sources popover all use it.
- **Styles** in `base.css`: `.select*`, `.popover-panel` (`.is-end` aligns right), `.calendar*`, and the tab icon rules.

### `Tabs.tsx` (backward compatible)

- **Icons:** `TabItem` gains an optional `icon`.
  - When any tab has an icon, the list gets `has-icons`, and each tab renders the icon followed by its label.
  - Below 900 px, icon tabs stack the icon above the label in a 48 px tall tab.
- **Scroll on switch:** the offset now comes from the sticky row's own computed `top`. That is 52 px on mobile, and 0 when a page makes the row sticky on desktop. It falls back to `--topbar-height` as before. Existing callers are unchanged.

### `MyCertificationsPage`

The native status `<select>` is now `<Select size="sm" align="end">`.

## Feedback contract: star and report

The contract is in `server/src/lib/contracts/brief.ts` and mirrored in `client/src/lib/contracts/brief.ts`.

- **Types:**
  - `FeedbackVerdict = 'star' | 'report'`
  - `FeedbackReportReason = 'wrong' | 'outdated' | 'broken_link' | 'other'`
  - `FeedbackSummary = { stars: number; reports: number; mine: 'star' | 'report' | null }`
  - `BriefPageDto.feedback` is `Record<"itemType:itemId", FeedbackSummary>`.
- **`POST /api/briefs/:briefId/feedback` body:**
  - **Star:** `{ itemType, itemId, verdict: 'star' }` toggles. Posting it while you already starred the item deletes your row.
  - **Report:** `{ itemType, itemId, verdict: 'report', reason, comment }`. The comment must be 3 to 500 characters after trimming, otherwise the route returns 400. It is stored as `"[reason] comment"` because the table has no reason column.
  - **Response:** `{ key, summary }`.
- **One row per user and item:** the unique key (user, brief, item) is unchanged. A report replaces your star, and a star replaces your report.
- **Legacy rows:** GET and the counts treat `accurate` as a star, and `inaccurate` or `outdated` as a report.
- **Client:** `sendBriefFeedback(request, briefId, FeedbackInput)` uses a discriminated `FeedbackInput`.

## Page structure

### Hero (`BriefHeader.tsx`)

- **Line 1:** the back link (desktop only), then the logo, code and title on one line, cut off with an ellipsis if too long.
- **Line 2:** the freshness chip, "Official exam page", and a Retired or Sample data chip only when relevant.
- **Line 3:** the Status `Select` (Not following / Planning / Studying / Passed, each with a description) and the Target date `DateField` (hidden when the status is Passed or Not following).
  - **Brief action on the right:** "Update brief" (secondary, with a refresh icon). With no brief, it is "Generate study brief" (primary).
  - **Explanation:** a one-line hint, linked with `aria-describedby`. On desktop it shows as a tooltip on hover or keyboard focus; below 900 px it is always visible beside the button.
- **While a job runs:** the job panel replaces line 3.
- **Moved out of the hero:** the version and source count are now in the Summary footer. The mobile checklist % in the hero is gone; the Checklist tab shows progress instead.

### Tabs (`BriefBody.tsx`)

The tabs are used at every width, synced to `?tab=`, with Summary as the default.

- **Summary:** the summary text, the warnings, and "Where to start" with three large links:
  - "Read how the exam works", which goes to the Exam tab;
  - "Start the checklist" (it reads "Continue the checklist" once progress has started), which goes to the Checklist tab and is styled as primary;
  - "See what the official material misses", which goes to the Gaps tab.
  - These are real `?tab=` links. On click they switch the tab, scroll the tab row into place and focus the selected tab.
  - The "About this brief" footer shows the generated date, the model, a "Version N" button that opens the versions drawer, and "N sources", which goes to the Resources tab.
- **Exam:** the facts grid, then Skills measured with weight bars. Each skill has a sources icon next to its %.
- **Checklist:** "N of M done" with a progress bar, then the phases, each with a per-phase count. The first unchecked item is highlighted as "Next up".
- **Gaps:** a hairline list.
- **Resources:** the official learning path, then community resources, then the collapsible "All sources" list. This is the only numbered source list.

**Layout:**

- **Desktop:** the tab row is left-aligned and auto-width, sticky at `top: 0` with a hairline underneath. The panel width is capped at 820 px.
- **Mobile:** the tab row is sticky under the top bar. The five tabs are 70×48 px each at 390 px, with no clipping and no horizontal scroll.
- **Empty brief:** the body shows an explanation only. The hero holds the single Generate action.

### Item rows

This reflects the coordinator's mid-task changes.

**Every item is laid out as:**

- the title line;
- the note;
- one compact meta row.

**The meta row:**

- **Left:** the type and duration ("Learning path · 4 h"), or the time and links for checklist items, or the confidence chip for gaps. "Recommended by N" (at 2 or more stars) is added here.
- **Right:** three quiet 40 px icon buttons:
  - **Sources** (`Link2`): icon only, with `aria-label` "1 source" or "N sources" and a tooltip such as "Source: learn.microsoft.com". Clicking it opens a popover listing each source's publisher or hostname, title, retrieved date and "Open source" link.
  - **Star:** filled when it is yours, with a count when above zero.
  - **Flag:** opens an inline report form under the row, with a reason `Select`, a required comment and Send. Send stays disabled until the comment has 3 characters. After sending, the row shows "Thanks, we will look at it."
- **Removed:** the numbered source chips are gone everywhere.
- **Not on every item:** the summary and skills have no star or flag. When you view an older version, only the sources button shows.

## Verified

I checked the behavior with curl, and with headless Chrome over CDP against the running dev servers (1280×900 and 390×844 at DPR 2). I did not restart the dev servers.

**curl:**

- A star posted twice returns `stars 1 / mine star`, then `stars 0 / mine null`.
- A report without a comment returns 400. A report with a reason and comment returns `reports 1 / mine report`.
- GET returns the new shape. A legacy `brief:brief` "accurate" row reads as `{stars:1}`.
- Afterwards I cleared my test rows: a star replaces my report, and a second star deletes it.

**Tabs and checklist:**

- Clicking every tab updates `?tab=`. Reloading `?tab=gaps` keeps Gaps.
- "Start the checklist" lands on Checklist with focus on that tab.
- Check-off: I checked item 1, it showed "1 of 18 done" with Next up moving on, and it persisted after a reload. I then unchecked it.

**Select:**

- Mouse: open, choose Planning, close, with focus back on the button.
- Keyboard: Enter, ArrowDown, Enter.
- Type-ahead, Escape, and an outside click all work.

**DateField:**

- Mouse: open (focus on today), next month, pick "12 Nov 2026". It persisted after a reload.
- Keyboard: Enter, arrows, Enter selects "21 Nov 2026"; Escape closes.
- Clear empties it.

**Update brief:** Tab focus shows the explanation tooltip. Clicking it returns the "Add your OpenAI API key first" callout.

**Star, report and sources:**

- Star toggles and persists after a reload.
- The report form opens with focus on the comment and Send disabled. Sending with "Outdated" shows the thanks text and a filled flag.
- The sources popover opens, Escape closes it, and it stays inside the viewport at 390 px (left 8 px).

**Layout and other pages:**

- No horizontal scroll on any tab at 390 px, including with the calendar and popovers open.
- The tab row's sticky `top` is 0 on desktop and 52 on mobile.
- The fixture `?fixture=1&tab=gaps` renders "Recommended by 7".
- On My certifications, the custom Select opens and closes at both widths.
- No console errors.

**Screenshots** in `docs/screenshots/`: `brief2-summary-desktop.png`, `brief2-checklist-desktop.png`, `brief2-summary-mobile.png`, `brief2-checklist-mobile.png`, and `brief2-controls.png` (Select and DateField open together, opened by keyboard).

## Left / notes

- **Live data changed during the session:** the DP-700 following target date became `2026-10-30`, and the checklist item "take-the-practice-assessment-as-a-baseline" became checked. The pattern and timing did not match my scripts, so I believe the product owner did this while reviewing live. I left both as they are.
- **Home page copy:** `client/src/pages/home/HomePage.tsx` ("How it works") still says "flag anything inaccurate or outdated". It is not my file. Suggested wording: "recommend what helped and report problems".
- **Job panel in the hero:** not exercised with a real running job, because no OpenAI key is stored. It was checked by reading the code and the fixture flow only.
- **Report moderation:** the reason exists only as a comment prefix, and nothing yet reads reports, for example in admin ops. A `reason` column would need a migration.
- **Report state is not shown back:** after a report, the user's flag is filled. The count of other users' reports is not shown in the UI; it is only in the DTO.
