# Upskill

Upskill helps colleagues prepare for IT certifications. The front door is one question: "Which certification are you preparing for?" An LLM research pipeline then reads the official exam page, the official learning path and community commentary, and produces a **cited, versioned study brief** with a step-by-step checklist. People who do not know which certification to take can describe their background (typed, dictated, or as an uploaded resume or project brief) and get ranked recommendations that open straight into a brief.

People verify the generated content instead of writing it: they vote items accurate, inaccurate or outdated, check off checklist items, and follow certifications with a status and target date. The earlier community library (resources, PDFs, question sets, ideas and questions, contributions, leaderboard, admin review queue) is still available under "Community" in the navigation.

Stack: React 19 + Vite client, Express 5 API, Prisma 7 with SQLite, Microsoft Entra sign-in, OpenAI Responses API with web search.

## Local setup

Requires Node.js 20.19+ or 22.12+.

1. Install dependencies: `npm install` in the repository root, then `npm --prefix client install` and `npm --prefix server install`.
2. Copy `client/.env.example` to `client/.env` and `server/.env.example` to `server/.env`. Every variable is documented in those files.
3. To work locally without Entra, set `VITE_DEV_AUTH_BYPASS=true` in `client/.env` and `DEV_AUTH_BYPASS=true` in `server/.env`. Leave both false when using Entra. Bypass is rejected when `NODE_ENV=production`.
4. To see admin pages with local bypass, set `VITE_LOCAL_IS_ADMIN=true` (UI only) and `ADMIN_OBJECT_IDS=local-developer` (what the server checks). In production, admin access comes from verified roles or `ADMIN_OBJECT_IDS`.
5. Create the database and seed the catalog:
   ```
   npm --prefix server run db:migrate      # applies prisma/migrations to server/dev.db
   npm --prefix server run db:seed         # upserts the system user and ~84 well-known exams (safe to re-run)
   npm --prefix server run seed:sample-brief   # optional: DP-700 demo brief, no OpenAI key needed
   ```
6. Start both processes with `npm run dev`. The web app runs at `http://localhost:5173` and the API at `http://localhost:4000` (`PORT` / `CLIENT_ORIGIN` in `server/.env`, `VITE_API_BASE_URL` in `client/.env`). To run them separately: `npm --prefix server run dev` and `npm --prefix client run dev`. If you change ports, update `CLIENT_ORIGIN` and `VITE_API_BASE_URL` to match, or the browser gets CORS errors.

**Run only one API process per SQLite database.** Each API process runs the background job worker, so two processes on the same `dev.db` compete for jobs and hit `SQLITE_BUSY`. A second checkout or worktree should use its own `DATABASE_URL`.

Other commands: `npm run build` (server `tsc` then client `vite build`), `npm run lint`, `npm run db:generate`. There is no automated test suite yet.

## Bring your own OpenAI key

Research runs with the requesting user's own OpenAI API key:

1. Open **Settings** and paste a key. The server validates it against OpenAI before saving, encrypts it at rest with AES-256-GCM using `KEY_ENCRYPTION_SECRET`, and only ever shows its last four characters. Remove it from the same page.
2. Without a key, "Generate study brief", "Refresh" and intake recommendations return `OPENAI_KEY_MISSING` and the UI links to Settings. A banner reminds users who have no key.
3. Models come from `OPENAI_RESEARCH_MODEL` (default `gpt-6-astra`, used for web research, brief structuring and intake) and `OPENAI_FAST_MODEL` (default `gpt-6-luna`, reserved for quick tasks). `gpt-6.1-sol` is a cheaper near-flagship alternative for research. The research model must support the Responses API `web_search` tool. Defaults were checked against the OpenAI models page on 2026-10-21; the older `gpt-5` / `gpt-5-mini` snapshots shut down on 2026-12-11.
4. Users may refresh a brief at most 3 times per certification per hour.

### Company key and the scheduler

`OPENAI_SERVER_API_KEY` is optional. When set, admins can use "Refresh all stale" on **Operations** (`/admin/ops`), and with `SCHEDULER_ENABLED=true` a nightly job (`SCHEDULER_CRON`, default `0 3 * * *`) refreshes up to 10 stale briefs of certifications that someone follows. Without the server key the scheduler does nothing and Operations only reports staleness. A brief is stale after `BRIEF_STALE_DAYS` (default 30).

## How research works

A brief job runs four parallel investigations with web search (official exam page; official learning path and practice assessment; community gaps and tips; third-party resources), then one structuring call with a strict JSON schema. Sources on exam-dump domains (`BLOCKED_RESEARCH_DOMAINS`) and non-HTTPS links are dropped, every claim must cite a source from the list, and the result is validated before it is saved as a new CURRENT version (older versions stay readable). Jobs run in an in-process queue backed by the `ResearchJob` table (concurrency 2); the page polls for progress. Jobs left running when the server stops are marked failed on the next start.

Research CLI (runs the pipeline directly, without the worker, and saves the brief):

```
npm --prefix server run research -- --code DP-700 --provider Microsoft [--title "..."] [--official-url https://...] [--model gpt-6.1-sol] [--key sk-...]
# or set OPENAI_API_KEY instead of --key; the key is never stored
```

The DP-700 sample (`server/src/services/research/__fixtures__/dp-700.sample.json`) is demo data, not a researched brief. `seed:sample-brief` saves it with model `fixture`; pass `-- --force` to add it again as a new version. In development, `/certifications/<id>?fixture=1` renders a client-side sample without touching the database.

## Content and resource sharing

Research excludes exam-dump sites and the model is told not to reproduce exam questions. Generated briefs are a starting point; the accuracy votes exist so people can flag what is wrong or outdated.

In the community library, question sets and PDFs require confirmation that the contributor created the material or has permission to share it. Add source attribution where applicable. Do not upload copied exam questions or restricted content. PDF files are stored outside the public frontend directory and are delivered only through an authenticated API route.

Resource cards (including saved resources) and resource details display quality signals: the last administrator review date, source attribution with a link when supplied, and the number of helpful votes received. Resources without a review or attribution are explicitly labeled. Review dates indicate when an administrator marked a resource reviewed, not a guarantee that its content is current or accurate. Helpful votes represent community feedback, not verification.

## Deployment notes

The first version uses local SQLite, local PDF storage, an in-process job queue and in-memory rate limits and scheduler state, so it is designed for a single API instance. For a multi-instance deployment, move the database and file storage to shared hosted services, move jobs and rate limits to shared infrastructure, and configure company identity, admin IDs, `KEY_ENCRYPTION_SECRET` and (optionally) `OPENAI_SERVER_API_KEY` before deployment.
