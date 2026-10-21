# M handoff: My certifications, held certifications from a resume, simpler intake

Status: done. Server `tsc --noEmit` and `npm --prefix server run lint` pass. `npm --prefix client run build` passes. `npm --prefix client run lint` reports 0 errors and 1 warning (the existing `LibraryPage.tsx` exhaustive-deps warning). No Prisma schema change and no migration. Nothing is committed.

## Server

### Routes (`server/src/routes/my-certifications.ts`)

The router is root-mounted in `routes/api.ts` with full paths, after the intake router. Every route has `requireAuth`. All four return the grouped DTO, so the client just replaces its state.

| Route | Behavior |
|---|---|
| `GET /api/me/certifications` | `{ studying, planning, passed }`. Each group is sorted by `updatedAt`, newest first. |
| `PUT /api/me/certifications/:certificationId` `{ status, targetDate? }` | Upserts the follow row. If `targetDate` is omitted, the stored date is kept; `null` clears it. Returns 400 for a bad body and 404 if the certification does not exist. |
| `DELETE /api/me/certifications/:certificationId` | Deletes the caller's row. Deleting a row that does not exist is not an error. |
| `POST /api/me/certifications/bulk` `{ items: [{ provider, code, title, officialUrl?, status }] }` (1 to 25 items) | Validates every item first, all or nothing: the same rules as `/catalog/resolve` (code regex, HTTPS URLs), and an invalid item returns 400 `INVALID_REQUEST` with the reason. It then calls `findOrCreateCertification(..., { catalogAsSystem: true })` for each item and upserts the item's status. |

The logic is in `server/src/services/my-certifications/index.ts`: `listMyCertifications`, `setMyCertification` and `saveMyCertifications`. The intake held route reuses it.

### DTO (`server/src/lib/contracts/my-certifications.ts`, mirrored in `client/src/lib/contracts/my-certifications.ts`)

```ts
MyCertificationDto = {
  certificationId, provider, code, title, officialUrl /* HTTPS or null */,
  status: 'PLANNING' | 'STUDYING' | 'PASSED', targetDate: 'YYYY-MM-DD' | null,
  passedAt: string | null, source: 'manual' | 'resume' | 'follow',
  yearObtained: number | null,   // extra field, see below
  brief: { freshness, generatedAt, checklistTotal, checklistDone } | null,  // null = no CURRENT brief
  updatedAt,
}
```

- **`passedAt`** is the row's `updatedAt` while the status is PASSED, otherwise null. The schema has no `passedAt` column.
- **`source`** follows the second option in the spec. A row is `'resume'` when its certification id appears as `catalogMatch.certificationId` on a held certification with `saved: true` in any of the user's SUCCEEDED intake results. Every other row is `'follow'`. `'manual'` is in the type but is never returned, because the schema has no column to record it.
- **`yearObtained`** is an addition to the spec. For PASSED rows that came from a resume, it is the year the intake extracted. The Passed tab shows "Earned 2023" when it is known, and otherwise "Passed · Added <date>". I added it because `passedAt` is only the date the row was saved, not when the exam was passed.
- **`checklistDone`** counts the user's `ChecklistProgress` items that are in the CURRENT brief's checklist.

### Catalog service

`findOrCreateCertification(input, userId, options?)` takes a new option, `{ catalogAsSystem?: boolean }`. When the input matches a seed catalog entry and no row exists yet, the row is created by the system user (`system`/`system`, "Upskill"; created by the new `systemUserId()` helper if the seed has not run), so the user earns no leaderboard points. Rows that are not in the catalog are still created by the user. Note that the seed already inserts all 84 catalog rows, so in practice this only matters on a database that was not seeded.

`services/catalog/identify.ts` now also exports `clip`, `displayProvider`, `matchCatalogEntry` and `findDbCertification`, so the intake can reuse them.

### Intake contract change

`server/src/lib/contracts/intake.ts`:

- **`intakeModelOutputSchema`** (new) is the strict LLM schema used by `zodTextFormat`. It follows the S0 rules: strict objects, every key required, nullable instead of optional. It adds `heldCertifications: { provider, code, title, yearObtained: int|null, evidence }[]`.
- **`intakeResultSchema`** is now the stored and returned shape. It adds `heldCertifications: HeldCertification[]`, with a default of `[]`, so results stored before this change still parse.
  - `HeldCertification = { provider, code, title, yearObtained, evidence, catalogMatch: { certificationId, code } | null, saved: boolean }`.
  - `saved` was added so the result page can show "Saved".
- The client mirror is in `client/src/lib/contracts/intake.ts`.

Prompt (`services/intake/prompts.ts`):

- New step 2 and a "Rules for heldCertifications" block. The model extracts only certifications the person has earned, not ones they are studying for or planning.
- It uses the exam code when one is given or known, otherwise the short official identifier or the title.
- `yearObtained` is set only when stated.
- `evidence` is a short quote of at most 15 words.
- The no-recommend rule now says: never recommend anything in `heldCertifications`, or an older version of one of them.

Post-processing (`normalizeIntakeResult`, now async, in `services/intake/index.ts`), following the same steps as identify:

- normalize the provider (catalog spelling)
- make the code valid with `toCertificationCode`
- match the catalog entry, then the db row (the catalog code and title win)
- clip the evidence to 200 characters
- drop years outside 1950 to the current year
- dedupe; at most 20 held certifications

It also removes recommendations that match a held certification. If that would leave none, the original list is kept.

`POST /api/intake/:id/held` `{ indexes: number[] }`:

- Owner only. An admin viewing someone else's intake gets 404, because saving writes to the session owner's list.
- The session must be SUCCEEDED and every index must exist; otherwise 404.
- It saves the selected held certifications as PASSED through `saveMyCertifications`.
- It sets `saved: true` and `catalogMatch.certificationId` in the stored result, then returns the updated `IntakeSessionDto`.
- A code that fails validation returns 422 `INVALID_REQUEST`.

## Client

- **`/my-certifications`** (`client/src/pages/my/MyCertificationsPage.tsx`, `my-certifications.css`):
  - Page header with one primary button, "Add one I already hold".
  - `Tabs` in `tabs` mode at every width: Studying (n) | Planning (n) | Passed (n). `?tab=passed` deep-links, through H's `useTabParam`.
  - Rows show:
    - provider logo, code, provider and title, linking to the brief
    - on Studying and Planning: the freshness chip ("No brief yet" when there is no brief), "7 of 18" when the brief has a checklist, and "Target <date>"
    - on Passed: "Earned YYYY" or "Passed" plus the date it was added
  - Every row has a status select that moves it between tabs, and a quiet trash button with an inline "Remove? Remove / Keep" confirmation.
  - Each tab has its own empty state, linking to Home search or Help me choose, plus "Add one I already hold" on Passed.
  - Below 900 px, the select and trash button sit under the text.
  - The page title is "My certifications | Upskill", and the mobile top bar title is set in `routeTitle`.
- **Add one I already hold:** an inline card containing a catalog typeahead. It uses `searchCatalog`, the same data function as the Home search, with a 250 ms debounce and the top 6 hits.
  - Clicking a hit saves it as PASSED through `/bulk`, closes the card, switches to Passed and shows "Saved AZ-900 to Passed."
  - "Not listed? Enter it yourself" opens a provider / code / title form that does the same.
- **Sidebar:** "My certifications" is now a normal `NavLink` to `/my-certifications` (desktop and mobile menu), so it gets the active state. The old `/#mine` and `/?tab=mine` links redirect there from Home.
- **Home:**
  - The Mine tab and the `#mine` section are removed. Mobile tabs are now Search | Providers.
  - The compact Continue card sits under the search and the "Help me choose" link at both widths. It shows the most recently updated **Studying** certification from `/api/me/certifications`, with "Continue · 0 of 18 done" and its freshness, and is hidden when there is none.
  - Old files: `MyCertifications.tsx` and `useMyCertifications.ts` are deleted and replaced by `ContinueCard.tsx` and `useContinueCertification.ts`. The dead `.mine-*`, `.home-anchor` and `.result-count` CSS is removed.
  - "Browse by provider" has the Anthropic tile again (detail "Claude").
- **Intake** (`IntakePage.tsx`): one screen at every width.
  - The `h1` is "Tell us where you are and where you want to go".
  - One textarea, with the dictation mic as a round button in the bottom-right corner of the field. While listening, a "Listening..." line shows the interim text. If the browser does not support dictation, the mic is hidden.
  - The example is one muted button, "Try: '…'", which fills the box and focuses it.
  - Attached files are listed inline, each with a remove button.
  - A row holds the secondary "Attach resume or project brief" button and the primary "Get recommendations" button; below 900 px they stack.
  - One privacy and limits line.
  - "Previous intakes" is a disclosure at the bottom.
  - The `KeyRequiredCallout` and the follow-up hint are unchanged.
  - Removed: the stepper, the drop zone, the example chips and the character counter (`maxLength` still caps the text).
- **Intake result:** when `heldCertifications` is not empty, a "Certifications you already hold" section appears above the recommendations.
  - Each row shows a checkbox (checked by default; its accessible name is the code plus the title), the code, the title, the provider, the year when known, and the evidence as a muted italic quote.
  - "Save to My certifications" calls the held route.
  - The section then shows "Saved. View in My certifications", linking to `/my-certifications?tab=passed`, and saved rows show a check mark instead of a checkbox.
  - If some rows were left unchecked, checking one again brings the button back.
- API helpers:
  - `client/src/lib/api/myCertifications.ts`: `listMyCertifications`, `setMyCertification`, `removeMyCertification` and `saveMyCertifications`.
  - `saveHeldCertifications` in `client/src/lib/api/intake.ts`.

## Verified

curl against the running API on port 4010:

- `GET /api/me/certifications` returned the three groups, with DP-700 under `studying` (`source:"follow"`, brief fresh, 0 of 18).
- `POST /bulk` with `[{Microsoft, AZ-900, "Azure Fundamentals", PASSED}]` put AZ-900 under passed. The title came from the catalog ("Microsoft Certified: Azure Fundamentals").
- `PUT` with `STUDYING` and a target date moved it under studying with the date.
- `DELETE` removed it.
- Error cases:
  - `PUT` on an unknown id returned 404
  - a bad status returned 400
  - a bulk item with the code "bad code!" returned 400 with the code message
- `POST /api/intake` without a key still returns 412.

Held extraction post-processing, with a tsx script on a hand-written model output:

- `Microsoft Azure`/`az104` became Microsoft AZ-104 (catalog title, db match, 2023).
- `Amazon Web Services`/`N/A` "AWS Certified Cloud Practitioner" became AWS CLF-C02 (matched by title).
- `(ISC)2` CISSP became ISC2 CISSP, and the year 1800 was dropped.
- A duplicate AZ-104 was removed.
- A non-catalog "Acme Widget Pro!" became `ACME-WIDGET-PRO` with no catalog match.
- The AZ-104 recommendation was removed because it is held, and the remaining one was re-ranked to 1.

Held route, against a hand-made SUCCEEDED session:

- Saving `[0, 3]` marked both `saved` with certification ids.
- The rows appeared as PASSED with `source:"resume"`, and AZ-104 showed `yearObtained: 2023`.
- An index out of range returned 404.

Browser (in-app pane, 1280 px and 390 px):

- The sidebar link and the mobile menu link open `/my-certifications`. The tabs switch and update `?tab=`, and the counts are right.
- Add one I already hold: typing "az-900" showed the hit, and clicking it saved the certification, switched to Passed (1) and showed the notice.
- Moving Passed → Planning updated the counts. Remove → confirm emptied the tab and showed the empty state.
- Intake result held section: unchecking CISSP and saving showed "Saved 2 certifications. View in My certifications". The link opened `?tab=passed` showing CLF-C02 ("Passed · Added …") and AZ-104 ("Earned 2023").
- Home shows only the search, Help me choose and the Continue card (desktop and mobile; mobile tabs are Search | Providers). `/?tab=mine` redirects to `/my-certifications`.
- `/intake` is one screen:
  - A file attached through the hidden input (`DataTransfer`) is listed inline.
  - "Try:" fills the box.
  - The mic sits in the field corner.
  - "Previous intakes" opens and lists intakes.
  - Not submitted.
- No horizontal scroll at 390 px on `/`, `/my-certifications`, `/intake` or the intake result.

Screenshots were taken with headless Chrome over CDP (1280×900 at DPR 1, and 390×844 at DPR 2 with mobile emulation):

- `docs/screenshots/my-certifications-desktop.png`
- `docs/screenshots/my-certifications-mobile.png`
- `docs/screenshots/intake-simple-desktop.png`
- `docs/screenshots/intake-simple-mobile.png`

The intake shots show the example filled in and a fake `resume.pdf` attached in the browser only; nothing was submitted.

Cleanup:

- Deleted the test intake session, the follow rows for AZ-900, AZ-104 and CLF-C02, and the `ACME-WIDGET-PRO` certification.
- The DP-700 follow row is unchanged (STUDYING, no target date, same `updatedAt`).
- The seeded AZ-104, CLF-C02 and AZ-900 certification rows existed before and were left alone.

## Not verified / left

- **A live intake extraction:** there is no OpenAI key in this environment, so I could not test whether the model fills `heldCertifications` well, the strict-schema output, or whether the "do not recommend held" prompt rule holds. The post-processing and the route were tested with fixtures only.
- `source: 'manual'` is never returned (there is no column). If it matters, add `UserCertification.source` and `passedAt` columns in a later migration, and set them in `setMyCertification` and `saveMyCertifications`.
- Target dates can only be edited on the brief page; My certifications shows them but does not edit them.
- The brief page's follow select still uses `PUT /certifications/:id/follow` (B). Both routes write the same row.
- The real dictation flow was not exercised (it needs a microphone).
- I did not touch the brand files (`Brand.tsx`, `components/brand/`, `index.html`, `public/`).
