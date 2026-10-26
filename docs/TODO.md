# Next steps

Ordered roughly by how much they move the product toward "instant value, zero onboarding". Each item is a self-contained piece of work.

## 1. Prove it with real keys

- Run a live brief with a real OpenAI key (`npm --prefix server run research -- --code DP-700 --provider Microsoft --key sk-...`) and judge the output quality, cost and time. Tune the prompts in `server/src/services/research/prompts.ts` from what comes back.
- Run a live intake with a real resume and check that held certifications are extracted and excluded from recommendations.
- Confirm the API accepts `max_tool_calls` and `filters.blocked_domains` on `web_search` (the code falls back if not).
- Decide on bring-your-own key versus a company key with per-user quotas; the server-key path already exists for scheduled refreshes.

## 2. Link the expertise we already have in-house

This is the biggest gap. The company has people who hold most of these certifications, and the product does not yet draw on them. The constraint is the same as everywhere else: it has to be nearly zero effort for them.

- **Verified-by-a-colleague signal on a brief.** When someone marks a certification Passed, invite them (once, in-product, not by email) to skim the brief's checklist and gaps and star what was true for them or flag what was not. Show "Verified by 3 colleagues who passed" on the brief. No forms, no uploads; the star and report actions already exist.
- **Tips from people who passed.** On the Passed tab, a one-line prompt: "One thing you wish you had known before DP-700?" Store it as a tip attached to the certification, show the best ones in the brief's Gaps tab under "From colleagues". A tip is a sentence, not a document.
- **Ask a holder.** On a brief, show which colleagues hold the certification (opt-in) with a "Message on Teams" link. Zero work for the holder until someone actually asks.
- **Fold the community library into briefs.** Existing shared notes and question sets become "community tips" attached to a brief's checklist items, instead of a separate library people have to go and find.
- **Surface reports.** Reports are stored but nothing reads them. Show them on the Admin hub and, for a brief with several reports on one item, nudge an update.

## 3. Make the agent deeper

- Read YouTube transcripts and nested Reddit threads (YouTube Data API, Reddit API, or a browsing agent) so the community gaps section catches what the surface search misses.
- Watch the official exam page for "skills measured" changes and refresh automatically when it changes, not only on a calendar.
- Personalize the checklist from the intake profile and the target date, and let people export it to their calendar.
- Match intake recommendations named only by title (for example Google "Professional Cloud Architect") to the catalog entry instead of creating a new row; add titles as aliases in `prisma/seed/catalog.json`.

## 4. Product polish

- Cancel running jobs (the per-job abort controller exists in the queue; the route and button do not).
- Back off nightly refreshes when the server key is revoked instead of enqueuing failing jobs.
- Resolving a catalog-only exam currently attributes the row to the user and awards legacy leaderboard points; create those rows as the system user.
- Route-level code splitting; the client bundle is over 500 kB.
- Decide the fate of the leaderboard and contribution badges now that content is generated.

## 5. Storage and operations

- Pick the real database and storage (Postgres or similar plus object storage for briefs, sources and PDFs). `data/knowledge/` is a temporary export so nothing is lost meanwhile; replace it with a proper backup and import path and delete it from git.
- Move jobs, rate limits and scheduler state out of process memory for multi-instance deployment.
- Add an automated test suite; start with the contracts (`validateBriefContent`, intake schema) and the routes that gate on keys and admin.
- Update catalog codes as exams roll over (DVA-C03 on 2026-11-30, SAP-C03 on 2026-11-16, SY0-801 on 2026-11-17, Anthropic exam content on 2026-12-07); see `data/knowledge/EXAM_CHANGES.md`.
