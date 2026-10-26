# I handoff: integration and verification

Date: 2026-10-21. Branch `ai-rework`, worktree `ai-cert-study-platform-67f27b`. Nothing committed.

Final gate: `npm run lint` passes (0 errors, the existing `LibraryPage` exhaustive-deps warning remains) and `npm run build` passes (exit 0; Vite still warns that the bundle is larger than 500 kB). Every server I started is stopped, and ports 4010 and 5174 are free.

## Applied

### Handoff items

| From | Change |
|---|---|
| E | `startScheduler()` moved out of `routes/admin-ops.ts` into `server/src/index.ts`, after `startJobWorker()`. SIGINT/SIGTERM now awaits `stopScheduler()` and `stopJobWorker()` together, and logs `Received SIGINT, stopping the scheduler and job worker.` |
| C, S0 | `recoverInterruptedIntakeSessions()` was a side effect of importing `routes/intake.ts`. It now runs in `index.ts` (awaited) after `recoverInterruptedJobs()` and before the worker starts. |
| E | `ApiErrorCode` now has `SERVER_KEY_MISSING`, `JOB_NOT_CANCELLABLE`, `NOT_FOUND`, `FORBIDDEN` and `INVALID_REQUEST` on both sides. The local `AdminOpsErrorCode` was removed, and the `as string` cast in `AdminOpsPage` is gone. `NOT_IMPLEMENTED` was removed because no route returns it any more. |
| C | `getIntakeJob` was removed from `lib/api/intake.ts`; `IntakeResultPage` uses B's `getJob` from `lib/api/jobs.ts`. |
| B | `BriefVersionSummary`, `FeedbackVerdict`, `FeedbackItemType`, `FollowStatus` (and `ChecklistPhase`) moved into `client/src/lib/contracts/brief.ts`; every brief page imports them from there. The server gained a matching `briefVersionSummarySchema` / `BriefVersionSummary`, and the versions route is typed against it. `lib/api/briefs.ts` keeps only `FeedbackSummary` and `Following` (derived helper aliases). |
| D | `CatalogHitDto.following: { status: 'PLANNING' \| 'STUDYING' \| 'PASSED' } \| null` on both sides. `searchCatalog` fills it, for both the empty query ("My certifications") and real searches, with one extra query per search (`followStatuses`). Catalog-only hits are always `null`. `MyCertifications.tsx` shows the label (Planning / Studying / Passed) as a plain `<small>` next to the freshness chip, with no new styling. |
| C, D | `resolveCertification` now validates its input with the same rules as `POST /catalog/resolve` (`resolveCertificationRequestSchema` / `parseResolveInput`, moved from the route into `services/catalog`) and throws `CatalogInputError`. `POST /intake/:id/select` maps that to **422** `{ error, code: 'INVALID_REQUEST' }` with a message that points to search. Before resolving, it slugifies model codes that contain spaces (for example a Google exam returned as "Professional Cloud Architect"), so they pass the code regex instead of failing. The obsolete 503 `NOT_IMPLEMENTED` branch is gone. `/catalog/resolve` 400s now carry `code: 'INVALID_REQUEST'`. |
| S0 | `let topics: unknown = []` became `let topics: unknown` in `routes/api.ts`, and the per-file `no-useless-assignment` override was removed from `server/eslint.config.js`. |
| A, E | `MaxListenersExceededWarning`: the OpenAI SDK (`fetchWithTimeout` in `openai/client.js`) adds an `abort` listener to the passed signal on every request attempt and never removes it, so the one shared shutdown signal accumulated listeners without bound. New `server/src/lib/abort.ts` `withChildSignal(parent, run)` gives `run` a child signal and removes its single parent listener when `run` settles. It is used per job in `queue.ts` (the shutdown signal has at most one listener per running job) and around every OpenAI call (`research/investigations.ts`, `research/structure.ts`, `intake/index.ts`). |
| C | The global multer error message in `index.ts` is now "The uploaded file exceeds the size limit." |

### Model defaults (verified live)

- `platform.openai.com/docs/models` now redirects (301) to `developers.openai.com/api/docs/models`, which lists:
  - `gpt-6-astra`: "start here", the most capable model, with web search among its tools.
  - `gpt-6.1-sol`: near-Astra performance at a lower cost.
  - `gpt-6-luna`: the most efficient model, for high-volume tasks.
- `developers.openai.com/api/docs/deprecations` lists `gpt-5-2025-08-07` and `gpt-5-mini-2025-08-07` for shutdown on 2026-12-11, with replacements `gpt-5.6-sol` and `gpt-5.6-terra`. None of the gpt-6 models are deprecated.
- Defaults are now `OPENAI_RESEARCH_MODEL=gpt-6-astra` and `OPENAI_FAST_MODEL=gpt-6-luna` in `server/src/config.ts` and `server/.env.example`, and `README.md` mentions both, plus `gpt-6.1-sol` as the cheaper research option. The research CLI usage example now shows `--model gpt-6.1-sol`.
- `OPENAI_FAST_MODEL` is **not used by any job** (intake uses the research tier, `INTAKE_MODEL_TIER` in `services/intake/index.ts`). The Settings page claimed the fast model was used for recommendations; I corrected the two lines of copy to say what each model is actually used for.

### Other fixes found during verification

- **Leaderboard**: the system user ("Upskill") owns the 84 seeded catalog rows, so it ranked #1 with 415 points. `/community/leaderboard` now excludes users with `tenantId = 'system'`.
- **Contracts**: client `contracts/jobs.ts` now names `JobKind`, `JobStatus` and `JobProgressEntry`. `lib/api/adminOps.ts` re-exports `JobKind` and `JobStatus` from the contracts instead of deriving them locally.

### New: `seed:sample-brief`

- Script: `server/src/scripts/seed-sample-brief.ts`, run with `npm --prefix server run seed:sample-brief`, or `-- --force` to add the sample as a new version again.
- It validates A's `__fixtures__/dp-700.sample.json` with `validateBriefContent`, upserts the system user, and finds or creates Microsoft DP-700 through `resolveCertification`.
- It saves the sample with `persistBrief` (`model: 'fixture'`, 0 tokens, requested by the system user), which also sets `lastResearchedAt` and fills empty `officialUrl` / `examVersion` / `examUpdatedAt`.
- It is idempotent: when DP-700 already has a CURRENT brief, it prints a message and exits 0.
- It reads the fixture from `../../src/services/research/__fixtures__/` relative to the script, so it also works from `dist/scripts`.

### Database tidy-up (worktree `server/dev.db`)

| Row | Action |
|---|---|
| B's DP-700 `cmvimifrs00017l5jbwya68qc` | It is the only DP-700, and D's seed already adopted it (`isCatalog = 1`). Kept. I set its title to the catalog title ("Microsoft Certified: Fabric Data Engineer Associate") and `createdById` to the system user. |
| D's AZ-140 `cmvimr9bv00025h5jz5azlawl` | Deleted (no relations). |
| CKS (recreated by D through resolve as the local developer) | `createdById` set to the system user, so it no longer counts as a contribution. |
| My own smoke rows | Deleted: ZZ-999 certification and its link resource and bookmark, a Google test certification, test intake sessions, test jobs, checklist progress, feedback and follow rows. |

Final state:
- 84 certifications, all created by the system user.
- 1 StudyBrief: DP-700 v1, `fixture`, CURRENT.
- 0 jobs, intake sessions, follows, progress, feedback, resources or stored keys.
- Migrations and catalog rows untouched.

### Docs

- `README.md`: rewritten for the new product. Covers setup, seeding, ports, the single-API-per-SQLite rule, the BYO key flow, models, the company key and scheduler, how research works, the research CLI, the sample brief, content policy, and deployment notes.
- `AGENTS.md`: new project map (client, server, contracts, services, routes, pages, scripts). It also covers the contract-change rule and error codes, states that file ownership no longer applies, says never to edit generated Prisma, and states the one-API-process-per-SQLite rule.
- `server/.env.example`: every variable is commented, with the new model defaults. `client/.env.example`: commented.

## Verified (exact steps)

All steps ran against the worktree DB with `server/.env` and `client/.env` as given (bypass on, admin `local-developer`, API 4010, web 5174).

1. **Startup and recovery**:
   - I inserted a RUNNING `ResearchJob` and a RUNNING `IntakeSession`, then ran `npx tsx src/index.ts`.
   - The log showed `Marked 1 interrupted job(s) as FAILED.` and `Marked 1 interrupted intake session(s) as FAILED.`; both rows had the expected errors. `/api/health` returned ok.
   - SIGINT logged the shutdown line, and the process exited within 2 s.
2. **Scheduler**:
   - With `SCHEDULER_ENABLED=true` and no server key: the one-line warning was logged, `/admin/ops/summary` showed `active:false` with reason "OPENAI_SERVER_API_KEY is not configured.", and SIGINT exited within 2 s.
   - With `SCHEDULER_ENABLED=true` and `OPENAI_SERVER_API_KEY=sk-fake…`: the log showed `[scheduler] Stale brief refresh scheduled with cron "0 3 * * *"`, the summary showed `active:true, nextRunAt: 2026-10-22T01:00:00.000Z`, and SIGINT stopped the cron task and exited within 2 s.
   - Without `SCHEDULER_ENABLED`: no scheduler log lines, clean boot.
3. **Abort listener fix**: a scratch `tsx` script (deleted afterwards) made 15 `models.list` calls against a closed port.
   - With a shared signal, 15 listeners were left on the parent plus the warning.
   - Through `withChildSignal`, 0 listeners were left.
   - 40 calls in rounds of 8 (the real worst case: 2 jobs × 4 investigations) produced no warning and 0 listeners left.
4. **curl checks**:
   - `/catalog/search?q=dp-700` returned the hit with `briefStatus:"fresh"` and `following:null`. After following, `q=` returned `following:{status:"STUDYING"}`.
   - `/catalog/resolve` with a bad code returned 400 `INVALID_REQUEST`.
   - `POST …/brief/refresh` returned 412 `OPENAI_KEY_MISSING`.
   - Intake select on a hand-made SUCCEEDED session:
     - code `"!!!"`: 422 `INVALID_REQUEST` with a message.
     - code `"Professional Cloud Architect"`: 200 (slugged to `PROFESSIONAL-CLOUD-ARCHITECT`; row removed afterwards).
5. **Browser walk** (built-in browser pane, 1024 px wide):
   - `/`: typing "dp-700" shows the DP-700 row with a Fresh chip; ArrowDown + Enter opens `/certifications/cmvimifrs00017l5jbwya68qc`.
   - **Real seeded brief**: renders header (Fresh · today, v1 · 22 sources), summary, warnings, exam facts, checklist (18 items) and the rest, with no fixture flag.
     - I checked off the first item, voted the summary Accurate and set My status to Studying, then reloaded.
     - After the reload: 1 checkbox checked, "1 of 18", Accurate count 1, select = STUDYING.
     - The API confirmed `completedItemIds:['read-the-official-study-guide']`, `following.status:'STUDYING'` and `brief:brief` with `mine:'accurate'`.
     - Home "My certifications" then showed "Studying / Fresh / Researched 21 Oct 2026".
   - **Empty brief** (`/certifications/<AZ-104>`): the "No study brief for AZ-104 yet" empty state renders. "Generate study brief" shows the "Add your OpenAI API key first" callout with "Open settings".
   - `?fixture=1` on AZ-104: the Sample data banner renders, plus the checklist (17 items), known gaps and sources.
   - `/settings`: saving a fake `sk-test-…` key shows "OpenAI rejected this key." inline. The models card shows `gpt-6-astra` / `gpt-6-luna`.
   - `/intake`: submitting text shows the "Add your OpenAI API key first." callout and keeps the text.
   - `/admin/ops`: summary tiles render (1 current brief, 1 fresh, 83 without brief), along with the scheduler card ("Refresh all stale" disabled with the reason), the stale table ("Nothing is stale.") and the jobs table.
   - Legacy pages load against the real API: `/library` (17 provider tiles), `/library/:id`, `/community`, `/saved`, `/contributions`, `/leaderboard`, `/admin/reports`.
   - Legacy flows:
     - Create certification: "Integration Test / ZZ-999" was created and the page navigated to `/library/:id`.
     - Add a link resource: an https Microsoft Learn link appeared as a Link card.
     - Bookmark: Save showed "Saved", and the resource appears on `/saved`.
   - Console: no React or runtime errors. The only console errors were the network log lines for the deliberate 412 (refresh, intake) and 400 (fake key) responses.
6. **390 px viewport**: I re-walked every route above.
   - `document.documentElement.scrollWidth` was 390 on all of them (no page-level horizontal scroll), and no element inside `<main>` extends past the viewport. The only overflowing element is the mobile bottom nav, which scrolls sideways by design (C0).
   - I took screenshots of `/` and the brief page.
7. **Build and lint**: `npm run lint` and `npm run build` from the repo root, both exit 0 (see top).

## Not verified, and why

- **Any real OpenAI call** (brief research, intake recommendation, key validation success, scheduler-enqueued refresh actually completing): no key is available. Everything stops at `OPENAI_KEY_MISSING` / "OpenAI rejected this key." The `gpt-6-astra` / `gpt-6-luna` defaults come from the docs, not from a live call. A live CLI run is the first thing to do with a key:

  ```
  npm --prefix server run research -- --code AZ-104 --provider Microsoft --key sk-...
  ```

  Whether the API accepts `blocked_domains` on `web_search` and `max_tool_calls` is also still unverified (A's notes).
- **Live job progress UI** (RUNNING state on the brief page and intake result page), job cancel from the UI, and an intake SUCCEEDED result flowing through "Start studying" in the browser. All need a real model run. The select route itself was checked with curl.
- **Voice dictation** and the unsupported-browser note: no microphone, and no non-Chromium browser.
- **PDF upload in the legacy add-resource flow and intake file upload in the browser**: not re-run here. C covered intake uploads with curl.
- **Non-admin access**: local bypass has a single user, so 403 on `/admin/ops` and another user's job or intake returning 404 were not re-checked (E and B checked them with `ADMIN_OBJECT_IDS` empty).
- **Entra sign-in**: bypass only.
- **Full SIGINT behaviour while a job is RUNNING**: no job can reach RUNNING without a key. The abort path itself was exercised by the listener test.

## Mobile layout issues for the design pass (G)

Seen at 390 × 844. None causes page-level horizontal scroll.

1. **Bottom navigation**:
   - It is icon-only and scrolls sideways. Settings, Review queue and Operations sit off-screen with no hint, and there are no text labels.
   - The brand ("upskill.") takes about a third of the bar.
   - The plan's target is a top bar with a menu.
2. **API key banner**: it wraps to two lines and pushes every page down by about 70 px; "Open settings" wraps under itself.
3. **Home**:
   - The search placeholder is cut off ("Try AZ-104, SAA-C03, Security+ or C").
   - The "1 certification" count wraps beside the "My certifications" description.
   - In the My certifications row, the follow-status label and "Researched …" date are hidden at this width; only the Fresh chip shows.
   - Provider tile subtitles truncate ("Amazon Web Servic…").
4. **Brief page**:
   - The header stacks into a tall block: logo, breadcrumb, a two-line title, chip, link, version, then the status and date selects, then two full-width buttons. The first content appears at about 500 px.
   - Feedback votes on the summary are icon-only with tiny counts.
5. **Admin ops**: tables scroll inside their cards, which is acceptable, but the summary tiles are long; worth a density pass.

Not mobile-specific, but for G as well:
- Every route has the document title "Upskill | Certification library".
- Checklist checkboxes have the accessible name "on" (no associated label).
- Provider tiles on `/library` and resource-kind buttons in the add-resource dialog are buttons with no accessible name.
- The `/library` provider list still shows an "Anthropic, 0 certifications" tile.

## Leftover risks

1. **S0 migrated the main checkout's DB**: S0's first `db:migrate` applied `ai_rework_foundation` to the **main checkout's** `server/dev.db` (S0 deviation 2). `main` will report drift until this branch is merged, or until that database is restored or reset. I did not touch it.
2. **Unused fast model**: `OPENAI_FAST_MODEL` is still unused. Either route intake to it (`INTAKE_MODEL_TIER = 'fast'`) after a live quality check, or drop the setting.
3. **Single-process limits**: rate limits and scheduler `lastRun*` are in memory and per process. The job queue claims rows from SQLite, and two API processes on one DB compete for jobs (now documented in README and AGENTS).
4. **Resolving catalog hits awards points**:
   - When a user resolves a catalog-only hit (search, or intake "Start studying"), the new certification row is `createdById` = that user. The legacy leaderboard then gives them 5 points and "My contributions" lists it.
   - The system user is excluded now, but these user-attributed catalog rows are not. Consider creating catalog-matched rows as the system user in `findOrCreateCertification`.
5. **Weak catalog matching for model output**: matching intake recommendations to catalog rows depends on provider + code or an alias. Google recommendations whose "code" is the exam name ("Professional Cloud Architect") create a new row instead of matching `PCA`. Adding exam titles as aliases in `catalog.json`, or matching on title in `findCatalogEntry`, would fix that.
6. **Revoked server key**: every nightly run re-enqueues up to 10 failing jobs, with no backoff (E).
7. **No running-job cancel**: RUNNING jobs cannot be cancelled. A per-job `AbortController` now exists in `queue.ts` (`withChildSignal` per job), so wiring cancel to it is a small follow-up, but it is not done.
8. **Upcoming exam code changes**: several catalog codes change within weeks (DVA-C03 on 2026-11-30, SAP-C03 on 2026-11-16, SY0-801 on 2026-11-17); see D's handoff.
9. **Dev key fallback**: `KEY_ENCRYPTION_SECRET` is unset in the worktree `.env` (the dev fallback is used). Any key saved locally becomes unreadable once a real secret is set.
10. **Bundle size**: the client bundle is over 500 kB; route-level code splitting was not done.
