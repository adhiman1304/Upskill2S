# E handoff: scheduler, admin ops and observability

Status: done. Server build and lint pass. Client build passes, and client lint shows 0 errors (only the existing `LibraryPage` warning remains).

## Files

| File | Contents |
|---|---|
| `server/src/services/ops/stale.ts` | `findStaleCertifications({ onlyFollowed = false, limit = 50 })` and `staleCutoff()` |
| `server/src/services/ops/metrics.ts` | `getOpsSummary()`, `OpsSummary` |
| `server/src/services/scheduler/index.ts` | `startScheduler()`, `stopScheduler()`, `refreshStaleBriefs()`, `getSchedulerStatus()`, `getSystemUserId()`, `ServerKeyMissingError`, `SCHEDULED_REFRESH_LIMIT` (10), `MAX_REFRESH_LIMIT` (25) |
| `server/src/routes/admin-ops.ts` | Router (replaces the stub); calls `startScheduler()` at import time (see below) |
| `server/package.json` | `node-cron ^4.6.0`, installed. It ships its own types, so no `@types` package is needed. |
| `client/src/lib/api/adminOps.ts` | Types and functions: `getOpsSummary`, `listAdminJobs`, `getStaleCertifications`, `refreshStale`, `cancelAdminJob` |
| `client/src/pages/admin/` | `AdminOpsPage.tsx`, `SummaryTiles.tsx`, `SchedulerCard.tsx`, `StaleTable.tsx`, `JobsTable.tsx`, `format.ts`, `admin-ops.css` |

## Routes (`/api/admin/ops`, `requireAuth` then an admin guard; non-admins get 403 `{ error, code: 'FORBIDDEN' }`)

| Route | Behavior |
|---|---|
| `GET /summary` | `OpsSummary` (shape below). |
| `GET /jobs?status=&kind=&limit=` | Validated with zod (`limit` 1 to 200, default 50; bad input returns 400 `INVALID_REQUEST`). Returns `AdminJobDto[]`, newest first. `AdminJobDto = JobDto & { requestedByName, certification: { id, provider, code, title } \| null, useServerKey, inputTokens, outputTokens }`. |
| `GET /stale?onlyFollowed=&limit=` | `{ staleAfterDays, items: StaleCertification[] }`. Each item has `{ certificationId, provider, code, title, followers, reason: 'stale' \| 'missing', briefId, briefGeneratedAt, briefAgeDays }`. `onlyFollowed` defaults to false; `limit` defaults to 100 (max 500). Certifications with an active QUEUED or RUNNING job are excluded. |
| `POST /refresh-stale` | Body (strict): `{ limit?: 1-25, certificationIds?: string[] (1-25), onlyFollowed?: boolean }`. With no server key it returns 412 `{ error, code: 'SERVER_KEY_MISSING' }`. Otherwise it returns `{ enqueued: JobDto[], skipped: { certificationId, reason: 'not_found' \| 'job_active' }[] }`. Without `certificationIds` it takes the stale list (followed only by default) up to `limit` (default 10). With `certificationIds` it refreshes exactly those certifications, stale or not. Jobs are `REFRESH` with `useServerKey: true`, and `requestedById` is the admin who clicked (as an audit trail). |
| `POST /jobs/:id/cancel` | 404 `NOT_FOUND` when the job is missing. A QUEUED job becomes CANCELLED: a conditional `updateMany` sets `finishedAt`, sets `error: 'Cancelled by an administrator.'` and appends a progress entry. The route returns the `AdminJobDto`. RUNNING and finished jobs return 409 `JOB_NOT_CANCELLABLE`, and so does losing a race with the worker. If the job has an `intakeSessionId`, a QUEUED or RUNNING `IntakeSession` is set to FAILED with the same error, so the intake page does not wait forever. |

### Summary shape

```ts
{
  generatedAt: string
  briefs: { total, fresh, stale, certificationsWithoutBrief, followedWithoutBrief, staleAfterDays }   // total/fresh/stale count CURRENT briefs
  jobs: { last24h: { QUEUED, RUNNING, SUCCEEDED, FAILED, CANCELLED, total } }                         // by createdAt
  tokens: { last7Days: { input, output, jobs }, byKind: { BRIEF|REFRESH|INTAKE: { input, output, jobs } } } // by finishedAt, from ResearchJob token columns
  scheduler: { enabled, cron, serverKeyAvailable, active, inactiveReason, nextRunAt, lastRunAt, lastRunEnqueued, lastRunTrigger: 'schedule'|'admin'|null, lastRunError }
  followers: { total, certifications }
}
```

`lastRun*` is kept in module memory, so it resets when the server restarts. Both scheduled runs and admin runs update it.

## Scheduler

- `startScheduler()` does nothing unless `config.schedulerEnabled` is true. If there is no server key (`getServerOpenAIClient()` returns null), it logs one warning and does not schedule anything. An invalid `SCHEDULER_CRON` also logs a warning and schedules nothing. Otherwise it registers `node-cron` with `noOverlap`. The function is idempotent.
- Each run calls `refreshStaleBriefs({ limit: 10, requestedById: systemUserId, onlyFollowed: true, trigger: 'schedule' })`. The system user (`tenantId "system"`, `objectId "system"`, `displayName "Upskill"`) is upserted if missing. Every run (scheduled or admin) logs one line: `[scheduler] refresh-stale (<trigger>): enqueued N REFRESH job(s), skipped M, limit L.`
- `stopScheduler()` stops and destroys the task.

### Integrator: move scheduler startup into `index.ts`

1. In `server/src/routes/admin-ops.ts`, delete these lines:

   ```ts
   // Integrator: move this call into server/src/index.ts next to startJobWorker() (see docs/handoff/E.md).
   if (config.schedulerEnabled) startScheduler()
   ```

   Also remove `startScheduler` from the import. `config` is still used by `/stale`.

2. In `server/src/index.ts`, add:

   ```ts
   import { startScheduler, stopScheduler } from './services/scheduler/index.js'
   // after startJobWorker():
   startScheduler()
   // in the SIGINT/SIGTERM handler, next to stopJobWorker():
   void stopScheduler()
   ```

## Contract notes for the integrator

- New error codes that are not yet in `ApiErrorCode` (server `lib/contracts/index.ts`, client `lib/contracts/index.ts`): `SERVER_KEY_MISSING` (412), `JOB_NOT_CANCELLABLE` (409), `NOT_FOUND` (404), `FORBIDDEN` (403), `INVALID_REQUEST` (400). The client declares them locally as `AdminOpsErrorCode` in `lib/api/adminOps.ts` and compares `error.code as string`. Consider adding them to the shared union.
- The scheduler and the admin "refresh" always enqueue `REFRESH`, including for followed certifications that have no brief yet (`reason: 'missing'`). Both kinds go to `runBriefResearch`, so the result is the same. If B's rate limit or UI treats `REFRESH` differently from `BRIEF`, switch `missing` to `BRIEF` in `refreshStaleBriefs`.

## Verification

- `npm --prefix server run build`, `npm --prefix server run lint`, `npm --prefix client run build` and `npm --prefix client run lint` all pass. Client lint shows 0 errors and only the existing `LibraryPage` warning. Earlier in the session the client build failed on B's then-missing `brief.css`, and server `tsc` flagged A's `max_tool_calls`; both were fixed by their owners by the time of the final run.
- Ports 4010 and 5174/5175 were in use by other agents, so the API ran on **4015** (bypass, `ADMIN_OBJECT_IDS=local-developer`) and the client on **5179**.
- Against the worktree `dev.db`, with no server key and `SCHEDULER_ENABLED=true`:
  - The warning was logged once, and the server started.
  - `/summary` returned the shape above.
  - `/jobs` returned an array.
  - `/refresh-stale` returned 412 `SERVER_KEY_MISSING`.
  - Cancelling a missing job returned 404.
  - `limit=500` and `status=BOGUS` returned 400.
- Against a **copy** of the DB with seeded certifications, briefs and followers, plus `OPENAI_SERVER_API_KEY=sk-fake`, `SCHEDULER_CRON='* * * * *'`:
  - The stale list ordering and the `onlyFollowed` filter were correct.
  - Summary counts were correct (3 current briefs: 1 fresh, 2 stale).
  - A per-certification refresh enqueued 1 job and skipped the unknown id.
  - The cron fired at the minute and logged `enqueued 2`; the jobs were requested by "Upskill" with `useServerKey`.
  - `lastRunAt`, `lastRunEnqueued` and `nextRunAt` were reported.
  - Cancelling a RUNNING job returned 409. Cancelling a QUEUED job returned 200 with status CANCELLED and an appended progress entry; repeating the cancel returned 409.
- In the browser at `/admin/ops`, these rendered: summary tiles, the scheduler card with "Refresh all stale" disabled and the reason shown, the stale table, and the jobs table with an expandable progress log and error. At a 375 px width the page has no horizontal page scroll; the tables scroll inside their cards.
- A non-admin (with `ADMIN_OBJECT_IDS` empty) gets 403 on `/summary`.
- All servers I started were stopped. No automated tests exist; none were run.

## Side effect to know about

My first API run used the shared worktree `dev.db`. Its job worker claimed one QUEUED `INTAKE` job (`cmvimgtqp0001gw5j3cs6b82n`) that another agent had enqueued, and failed it with `OPENAI_KEY_MISSING`. Any API process pointed at the same DB competes for queued jobs. All later testing used a DB copy in the scratchpad.

## Limits

- **RUNNING jobs cannot be cancelled.** The queue has no per-job abort, only the shutdown signal. This needs a per-job `AbortController` in `queue.ts` (S0-owned).
- The scheduler state (`lastRun*`) lives in memory, and it is per process. Multiple API instances would each schedule their own run; node-cron's `distributed` option or a DB lock would fix that later.
- With a revoked server key, every nightly run re-enqueues up to 10 jobs that fail. Failures show in the jobs table and in `FAILED` counts, but nothing backs off yet.
- Token totals come only from `ResearchJob.inputTokens/outputTokens`, as written by job handlers.
- Seen while testing (A's area): `MaxListenersExceededWarning: 11 abort listeners added to [AbortSignal]` when several REFRESH jobs run. Research probably adds listeners to the shared shutdown signal for each call.
