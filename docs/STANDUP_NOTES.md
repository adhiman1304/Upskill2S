# Stand-up notes: Upskill AI rework (branch `ai-rework`)

Built overnight on 2026-10-21 and 2026-10-22. One orchestrating session plus nine Claude Opus 5.5 agents working in parallel waves on disjoint files, from the plan in `docs/AI_REWORK_PLAN.md`.

## The pitch in three sentences

The MVP was a manual catalog: people upload PDFs and question sets, vote, and climb a leaderboard, and nothing makes the content correct or current. The rework inverts that: the front door is "Which certification are you preparing for?", and an LLM research agent searches the web, reads the official exam page, learning path and community commentary, and returns a cited, versioned Study Brief with an actionable checklist. People verify and track instead of producing; the existing community features stay as a secondary layer.

## What exists now

- **Home**: one search box over an 84-exam seeded catalog plus anything already researched; retired codes alias to their successors (AZ-500 finds SC-500). "I don't know yet" leads to intake. "My certifications" shows what you follow with freshness.
- **Study Brief** (`/certifications/:id`): tabs Summary, Exam, Checklist, Gaps and Resources at every width; a clean hero with freshness and the official exam page; custom status and target-date controls; a 10 to 25 item checklist grouped by phase with per-user check-off and a highlighted next step; known gaps sourced from community posts; star to recommend and flag to report per item; a source icon per item opening its citations; version history. "Update brief" re-runs the research agent with a live progress log.
- **Research pipeline**: OpenAI Responses API with the built-in web search tool. Four focused investigations run in parallel (official page, learning path, community gaps, third-party resources), then one strict-JSON structuring call into the brief contract, validation and one repair attempt, versioned persistence. Braindump domains are blocked. A CLI runs it from the terminal.
- **Intake** (`/intake`): describe your situation by text or voice dictation, or upload a resume, project description or offer (PDF, DOCX, TXT). The model returns ranked certification recommendations with reasons, prerequisites and prep estimates. "Start studying" opens the brief.
- **Bring your own key** (`/settings`): each user stores their own OpenAI key, validated on save, AES-256-GCM encrypted at rest, never shown again. Research runs with the requesting user's key.
- **Operations** (`/admin/ops`): summary tiles, stale briefs, job table with progress logs and cancel, "refresh all stale". A nightly scheduler refreshes stale briefs for followed certifications when a company server key is configured.
- **Find anything**: search is typo tolerant, the four real Anthropic certifications are in the catalog, and when the catalog has no match the last row asks the agent to identify the certification from free text using web search, then opens its brief.
- **My certifications**: its own page with Studying, Planning and Passed tabs and "Add one I already hold". Uploading a resume in intake extracts the certifications you already hold for one-tap saving, and they are excluded from recommendations.
- **Legacy**: library, resources, saved, community board, contributions, leaderboard and review queue still work under "Community".
- **Mobile**: below 900 px every page is one mission per screen with tabs under the title (brief: Checklist, Overview, Gaps, Resources, Sources; intake: one screen; admin: Summary, Stale, Jobs). Desktop layouts unchanged.
- **Brand**: a sharp bracket-u mark on a 24-unit grid that doubles as the first letter of the wordmark; favicon and compact tile use the same glyph in green. Alternatives are viewable in dev at `/?brand=1`.
- **Design pass**: DM Sans only, one token set under `client/src/styles/`, tighter density, single-column page grammar with one primary action per view, desktop sidebar plus a mobile top bar with a menu, accessible checkboxes and votes, per-route page titles. Screenshots at 1280 px and 390 px are in `docs/screenshots/`. Details in `docs/handoff/G.md`.

## Numbers

| Item | Value |
|---|---|
| Commits on the branch | 20 |
| Files changed vs main | about 210 (about 18k lines added) |
| New API route modules | 6 (settings, catalog, briefs, jobs, intake, admin-ops) |
| New services | research, intake, catalog, jobs, openai, ops, scheduler |
| Catalog exams seeded | 88 across 17 providers |
| New database tables | 7, one migration |

## Verified

- Lint and build pass from the repo root.
- Every route walked in a browser at desktop and 390 px widths with local auth bypass, no console errors, no horizontal scroll.
- All API routes exercised with curl, including error paths (missing key 412, running job 409, rate limit 429, bad uploads 400, non-admin 403).
- Job queue runs jobs two at a time, logs progress, recovers interrupted jobs at boot, stops cleanly on SIGINT.
- The DP-700 brief page shows a realistic sample brief seeded without a key; check-off, votes and follow persist across reload.

## Not verified (needs a real OpenAI key)

- A live research run, a live intake recommendation, a successful key save, and the live progress views. First thing to try with a key:

```bash
npm --prefix server run research -- --code AZ-104 --provider Microsoft --key sk-...
```

- Whether the API accepts the `blocked_domains` filter and `max_tool_calls` on web search (the code falls back if not).
- Voice dictation with a real microphone, Entra sign-in, multi-user permission paths.

## Decisions to make as a team

1. BYO key for the MVP versus a company key with per-user quotas (the server key path already exists for scheduled refreshes).
2. Model defaults: now `gpt-6-astra` for research and `gpt-6-luna` for fast tasks, picked from the current docs; the fast model is not used by any job yet.
3. What happens to the legacy contribution features: keep as "Community", or fold resources into brief items as community tips.
4. Database structure: the knowledge gathered so far (84-exam catalog, exam change log, briefs) is exported to `data/knowledge/` as a temporary safety net. This is explicitly not the final storage design; we need to pick the real database and storage structure.
5. Deeper community signal later: YouTube transcripts and nested Reddit threads need their own APIs or a browsing agent; tonight's build reads what web search surfaces.

## Known risks and follow-ups

- The foundation migration was also applied to the main checkout's local `server/dev.db` by accident (additive only); `main` reports drift until this branch merges.
- Several catalog codes change in November (DVA-C03, SAP-C03, SY0-801); aliases are in place.
- Running jobs cannot be cancelled yet; a revoked server key would re-enqueue failing nightly jobs without backoff.
- Resolving a catalog-only exam attributes the row to the user and awards legacy leaderboard points.
- Intake recommendations named only by title (Google "Professional Cloud Architect") create a new row instead of matching the catalog entry.
- `KEY_ENCRYPTION_SECRET` must be set before anyone stores a real key outside local dev.

## Branch state

All work is on the branch `ai-rework`, twenty commits ahead of `main`, each wave its own commit so the history reads as the plan. A pull request to `main` is open for review; `docs/TODO.md` lists the agreed next steps.

## How to run

See `README.md`. Short version: install, copy both `.env.example` files, `npm --prefix server run db:migrate`, `npm --prefix server run db:seed`, optionally `npm --prefix server run seed:sample-brief`, then `npm run dev`.
