# Upskill

Upskill helps colleagues get certified with as little effort as possible. You open it, type the exam you are preparing for, and get a **cited, versioned study brief**: how the exam works, the skills measured, the official learning path, what the official material misses according to people who passed, recommended resources, and a step-by-step checklist you tick off. If you do not know which certification to take, describe your situation (typed, dictated, or by uploading a resume or project brief) and get ranked recommendations that open straight into a brief.

The content is researched by an LLM agent with web search, not written by hand. People verify and enrich it instead of producing it: star what helped, report what is wrong, track progress, and keep a list of what they are studying, planning and already hold.

**Stack**: React 19 + Vite, Express 5, Prisma 7 on SQLite, Microsoft Entra sign-in, OpenAI Responses API with the built-in web search tool.

## Run it locally

Requires Node.js 20.19+ or 22.12+.

```bash
npm install && npm --prefix client install && npm --prefix server install
cp client/.env.example client/.env && cp server/.env.example server/.env
```

For local work without Entra, set `VITE_DEV_AUTH_BYPASS=true` in `client/.env` and `DEV_AUTH_BYPASS=true` in `server/.env` (rejected in production). To see the admin pages, also set `VITE_LOCAL_IS_ADMIN=true` and `ADMIN_OBJECT_IDS=local-developer`.

```bash
npm --prefix server run db:migrate        # create server/dev.db
npm --prefix server run db:seed           # 88 well-known exams, safe to re-run
npm --prefix server run seed:sample-brief # optional DP-700 demo brief, no OpenAI key needed
npm run dev                               # web on :5173, API on :4000
```

Then open `http://localhost:5173`, go to **Settings** and paste your own OpenAI API key (see below), and search for an exam.

Run only one API process per SQLite database: each process runs the background job worker, and two of them compete for jobs. Other commands: `npm run build`, `npm run lint`. There is no automated test suite yet.

## Bring your own OpenAI key

The MVP runs research with each user's own key. It is validated against OpenAI on save, encrypted at rest with AES-256-GCM using `KEY_ENCRYPTION_SECRET`, and never shown again beyond its last four characters. Without a key, generating or updating a brief, identifying a certification from free text, and intake recommendations stop with a link to Settings.

Models are set by `OPENAI_RESEARCH_MODEL` (default `gpt-6-astra`) and `OPENAI_FAST_MODEL` (default `gpt-6-luna`); the research model must support the `web_search` tool. An optional company key, `OPENAI_SERVER_API_KEY`, enables the admin "Refresh all stale" action and, with `SCHEDULER_ENABLED=true`, a nightly refresh of stale briefs for certifications people follow. A brief counts as stale after `BRIEF_STALE_DAYS` (default 30). Every variable is documented in the two `.env.example` files.

## How a brief is made

A job runs four web-search investigations in parallel (official exam page; official learning path and practice assessment; community gaps and tips from Reddit, YouTube and blogs; third-party resources), then one structuring call with a strict JSON schema. Exam-dump domains and non-HTTPS links are dropped, every item must cite a source from the list, and the result is validated before it is saved as a new version. Jobs run in an in-process queue with live progress in the UI, and users can refresh a brief at most three times per certification per hour.

The same pipeline is available from the terminal, which is the quickest way to try it with a key:

```bash
npm --prefix server run research -- --code DP-700 --provider Microsoft --key sk-...
```

## What is where

- `/` search over the catalog with typo tolerance; when nothing matches, the agent identifies the certification from free text.
- `/intake` describe yourself or upload a resume; recommendations plus the certifications you already hold, saved in one tap.
- `/certifications/:id` the study brief: Summary, Exam, Checklist, Gaps and Resources tabs.
- `/my-certifications` Studying, Planning and Passed.
- `/community` the earlier shared library, saved resources, ideas and feedback, contributions and leaderboard, kept as a secondary layer.
- `/admin` operations (jobs, stale briefs, scheduler) and the review queue.

`docs/AI_REWORK_PLAN.md` is the design, `docs/handoff/` records what each workstream built and verified, `docs/TODO.md` lists the next steps, and `data/knowledge/` holds temporary exports of the catalog and briefs until a real database is chosen.

## Content rules

Research excludes exam-dump sites and the model is told not to reproduce exam questions. Briefs are a researched starting point with sources, not a guarantee; the star and report actions exist so people can correct them. In the community library, shared question sets and PDFs still require confirmation that the contributor created the material or has permission to share it, and PDFs are served only through authenticated routes.

## Deployment notes

This version is built for a single API instance: SQLite, local PDF storage, an in-process job queue, in-memory rate limits and scheduler state. For more than one instance, move the database, files, jobs and rate limits to shared services, and set `KEY_ENCRYPTION_SECRET`, Entra identity, `ADMIN_OBJECT_IDS` and optionally `OPENAI_SERVER_API_KEY` before deploying.
