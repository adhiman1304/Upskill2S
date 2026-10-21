# B handoff: Study Brief experience

Status: done. Every route in the brief is implemented and checked against a running API, and the page was checked in a browser (desktop and 375 px mobile) against both real data and the `?fixture=1` sample.

## Files (all owned by B)

- `server/src/routes/briefs.ts`, `server/src/routes/jobs.ts`: replace the S0 stubs. Both are still root-mounted and use full paths. `requireAuth` runs on every route and `currentUser` supplies the identity.
- `server/src/lib/rate-limit.ts`: `consume(key, limit, windowMs) => { ok, retryAfterSeconds }`. It is an in-memory sliding window that resets on restart and only works for a single process.
- `client/src/lib/api/briefs.ts`, `client/src/lib/api/jobs.ts`: one function per route, each taking `request` first.
- `client/src/pages/brief/`:
  - `BriefPage.tsx`: route element and state.
  - `BriefHeader.tsx`: header, freshness chip, follow control, Versions and Refresh buttons.
  - `JobPanel.tsx`: live progress log and the 412 / 429 / error callouts.
  - `BriefBody.tsx`: summary and warnings, exam facts row, skills with weight bars, known gaps, learning path, community resources, collapsible sources.
  - `ChecklistSection.tsx`: checklist grouped by phase, optimistic check-off, completion percentage.
  - `FeedbackControl.tsx`: accurate / inaccurate / outdated votes and numbered source chips.
  - `VersionsDrawer.tsx`: lists versions; selecting an older one shows it read only.
  - `brief-context.ts`, `brief-utils.ts`, `brief.css`.
  - `fixtures/dp-700.sample.ts` and `fixtures/fixture-page.ts`.

## Routes (paths under `/api`)

| Route | Result |
|---|---|
| `GET /certifications/:id/brief` | `BriefPageDto`; 404 `{error}` if the certification does not exist. `freshness` is `fresh` if `ageMs <= BRIEF_STALE_DAYS`, otherwise `stale`; `ageDays` is floored. `feedback` covers the CURRENT brief only. `progress.completedItemIds` holds every completed item for the user and certification (progress is keyed by item id, so it survives a refresh). |
| `POST /certifications/:id/brief/refresh` | 202 `JobDto` (kind `BRIEF` if no brief row exists, otherwise `REFRESH`). Checks run in this order: 404, then 412 `OPENAI_KEY_MISSING`, then 409 `JOB_ALREADY_RUNNING` (the body also includes `job`), then 429 `RATE_LIMITED` (3 per user per certification per hour; the body includes `retryAfterSeconds` and a `Retry-After` header is set). A 409 does not use up a rate-limit slot. |
| `GET /certifications/:id/brief/versions` | `[{id, version, status, model, sourceCount, generatedAt}]`, newest first |
| `GET /certifications/:id/brief/versions/:briefId` | `StudyBriefDto`; 404 if the version belongs to another certification |
| `PUT /certifications/:id/brief/progress/:itemId` `{completed}` | `{completedItemIds}`. Returns 400 for a bad body or a non-slug id, 404 "This certification has no study brief yet.", and 404 if the item is not in the CURRENT checklist (checked only when `completed: true`). |
| `POST /briefs/:briefId/feedback` `{itemType, itemId, verdict, comment?}` | `{ key: "gap:kql-...", summary: {accurate, inaccurate, outdated, mine} }`. Returns 404 if the brief is missing or the item is not in that brief (`brief` requires `itemId: "brief"`). The comment is plain text of at most 1000 characters. |
| `PUT /certifications/:id/follow` `{status, targetDate?: "YYYY-MM-DD" \| null}` | `{status, targetDate}` |
| `DELETE /certifications/:id/follow` | `null` |
| `GET /jobs/:id` | `JobDto`. Returns 404 if the job is missing, and also 404 when a non-admin asks for another user's job (so job ids do not leak). |
| `GET /me/jobs` | The user's last 20 `JobDto`s |

Any other method or subpath under the brief, follow or feedback paths returns 404 JSON instead of falling through to the legacy routes. If stored brief JSON fails `studyBriefContentSchema`, the brief is logged and treated as missing on the page. For a version, the route returns 500.

Example `GET /certifications/:id/brief` for a certification with no brief:
```json
{"certification":{"id":"cmv…","provider":"Microsoft","code":"DP-700","title":"Implementing Data Engineering Solutions Using Microsoft Fabric","officialUrl":null,"status":"ACTIVE"},"brief":null,"freshness":{"status":"missing","generatedAt":null,"staleAfterDays":30,"ageDays":null},"activeJob":null,"progress":{"completedItemIds":[]},"feedback":{},"following":null}
```
`POST …/brief/refresh` with no key returns 412 `{"error":"Add your OpenAI API key in Settings to generate a study brief.","code":"OPENAI_KEY_MISSING"}`. When rate-limited it returns 429 `{"error":"You can refresh this brief 3 times per hour. Try again in about 60 minutes.","code":"RATE_LIMITED","retryAfterSeconds":3594}`.

## Client behavior

- Refresh polls `GET /jobs/:id` every 2 s through `usePolling`. On SUCCEEDED it reloads the page data and shows "The study brief is up to date." On FAILED it shows `job.error` with Try again and Dismiss.
- 412 shows a callout linking to `/settings`. 409 reloads the page and attaches to `activeJob`. 429 shows the server message with the wait. If the page loads while a job is active, it attaches automatically.
- Checklist check-off is optimistic and reverts on error. Votes are optimistic and then replaced by the server summary. Older versions are read only: checkboxes and votes are disabled and a banner offers a way back.
- Every link from brief content goes through `safeUrl` (HTTPS only, `rel="noopener noreferrer"`).
- **Fixture**: `/certifications/<any id>?fixture=1` works only when `import.meta.env.DEV` is true. It is labeled "Sample data" in a banner and a breadcrumb tag, saves nothing, and its Refresh runs a simulated job, so the progress panel can be demoed. The fixture is loaded with a DEV-guarded dynamic import, and I confirmed it is absent from `dist`. It passes `validateBriefContent`.

## Verified

- Server `tsc` passes, and `eslint` on my files passes. The full `npm --prefix server run lint` failed only on C's `services/intake/extract.ts` (`no-control-regex`, `no-irregular-whitespace`); not mine.
- `npm --prefix client run build` and `npm --prefix client run lint` pass (0 errors; the only warning is the existing LibraryPage one).
- curl against my API instance:
  - With no brief: missing state, 412, follow PUT / DELETE / 400, progress 404 and 400, versions `[]`, version 404, feedback 404 and 400, job 404, `/me/jobs`, and the legacy certification route still 200.
  - With two temporary brief rows and a dummy key, since deleted: GET brief with `fresh`, 3 days old, versions newest first, the v1 version detail, progress check and uncheck and the unknown item 404, feedback upsert that changes the verdict, the 202 refresh then 409, and a 429 on the fourth refresh. A's live pipeline ran the job and FAILED it cleanly ("OpenAI rejected your API key").
- Browser:
  - Real data: rendering, check-off and vote persisted across reload, the follow select showed the date input, the versions drawer and read-only v1, the 429 callout, and the empty state plus missing-key callout after cleanup.
  - Fixture: the simulated job went through the polling panel to success.
  - 375 px mobile: no horizontal overflow.
  - Console: only the expected 412 and 429 network errors.

## Not verified

- A real generated brief from OpenAI (no real key; the pipeline is A's).
- Non-admin access to another user's job: local bypass has only one user.

## Notes for the integrator

1. **Ports and shared DB**: another agent was already running the API on 4010 and Vite on 5174 from this worktree, so I used 4011 and 5175 (with `CLIENT_ORIGIN` and `VITE_API_BASE_URL` overrides) and stopped only my own processes. Several APIs on the same SQLite `server/dev.db` hit `SQLITE_BUSY` at startup and one crashed. Also, `npm run dev` regenerates Prisma, which restarts every other `tsx watch` on this tree.
2. **Leftover test data**: certification `cmvimifrs00017l5jbwya68qc` (Microsoft DP-700) stays in the worktree `server/dev.db`; the legacy API has no certification DELETE. Remove it, or let D's catalog reuse it. Its briefs, jobs, the follow row and the dummy key were deleted.
3. **Contract additions (non-breaking, server only)**: the 409 body carries `job` and the 429 body carries `retryAfterSeconds`. The client does not depend on either; it reloads on 409 and shows the message on 429. The client types `BriefVersionSummary`, `FeedbackItemType`, `FeedbackVerdict` and `FollowStatus` live in `client/src/lib/api/briefs.ts`. Consider moving them into `client/src/lib/contracts/brief.ts`.
4. Home (D) can reuse `FreshnessChip` from `pages/brief/BriefHeader.tsx`, or the `.brief-freshness.is-*` classes once it imports `brief.css`. `brief.css` is currently imported only by `BriefPage.tsx`.
5. No wiring is needed: the routers are already mounted by S0 and the route `/certifications/:id` already renders `BriefPage`.
