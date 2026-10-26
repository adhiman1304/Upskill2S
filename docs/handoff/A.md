# A handoff: research pipeline

## What was verified about the OpenAI API (2026-10-21)

Checked against the installed SDK (`server/node_modules/openai`, **6.49.0**) and the live docs (`platform.openai.com/docs/...` now redirects to `developers.openai.com/api/docs/...`).

| Item | Finding |
|---|---|
| Call shape | `client.responses.create({ model, instructions, input, tools, text, max_output_tokens, store }, { signal })`. `response.output_text` is the convenience text. |
| Web search tool type | **`web_search`** (SDK type `WebSearchTool`, also `web_search_2025_08_26`). `web_search_preview` is legacy and lacks `filters`. Options used: `search_context_size: 'medium'`. |
| Domain filters | The guide documents `filters: { allowed_domains, blocked_domains }` (max 100 each). The API reference and the 6.49.0 SDK types only list `allowed_domains`. We send `blocked_domains` through a cast and **retry once without filters if the API returns a 400 that mentions filters**. Sources are filtered locally regardless (`filters.ts`), so the blocklist holds either way. |
| Citations | `response.output[]` items of `type: 'message'`, `content[]` of `type: 'output_text'` with `annotations[]` of `{ type: 'url_citation', url, title, start_index, end_index }`. Web search appends `?utm_source=openai` to URLs; we strip `utm_*` before deduplicating. `include: ['web_search_call.action.sources']` would return all consulted URLs; not used (citations only, as specified). |
| Search cap | `max_tool_calls` is a documented create parameter ("maximum number of total calls to built-in tools"), but **SDK 6.49.0 does not type it on `ResponseCreateParams`** (only on the realtime client event). We pass it through an intersection-typed body object. |
| Structured output | `text: { format: zodTextFormat(studyBriefContentSchema, 'study_brief') }` from `openai/helpers/zod`. Generates a strict `json_schema` (about 4.9 KB, no `$ref`, keeps `pattern` and `minItems`/`maxItems`). We use `responses.create` and `JSON.parse(output_text)` ourselves (not `responses.parse`) so that a schema mismatch goes into the repair loop instead of throwing. Refusals arrive as content parts with `type: 'refusal'`. |
| Usage | `response.usage.input_tokens`, `response.usage.output_tokens` (also `total_tokens`, `input_tokens_details.cached_tokens`, `output_tokens_details.reasoning_tokens`). Summed across all successful calls. |
| Errors | `AuthenticationError` (401), `PermissionDeniedError` (403), `NotFoundError` (404, for example an unknown model), `RateLimitError` (429; `error.code === 'insufficient_quota'` for no quota), `BadRequestError`, `APIUserAbortError`. |

### Model names: action needed

- The config defaults `gpt-5` / `gpt-5-mini` still work, but the **deprecations page lists the `gpt-5-2025-08-07` and `gpt-5-mini-2025-08-07` snapshots for shutdown on 2026-12-11**. Listed replacements are `gpt-5.6-sol` and `gpt-5.6-terra`.
- The models page shows the flagships as **`gpt-6-astra`** (most capable), **`gpt-6.1-sol`** and **`gpt-6-luna`** (cost-sensitive). The web search guide recommends `gpt-5.5` and also names `gpt-5.4`, `gpt-5` (but not with `minimal` reasoning) and `gpt-4.1`; its code samples use `gpt-6-astra`.
- I did not change the config defaults (not my file). **Integrator recommendation:** before 2026-12-11, set `OPENAI_RESEARCH_MODEL` to a current web-search-capable model (`gpt-5.5` is the one the web search guide recommends explicitly) and `OPENAI_FAST_MODEL` to `gpt-6-luna` or `gpt-5.6-terra`, after a live test.
- The pipeline does not set `reasoning` or `temperature`, so it works with both reasoning and non-reasoning models.

## Design (`server/src/services/research/`)

| File | Role |
|---|---|
| `prompts.ts` | All prompt text: four investigation instructions, the structuring instructions, input builders, and the repair message. |
| `investigations.ts` | Stage A. `runInvestigations()` runs four `web_search` calls in parallel with `Promise.allSettled`: `officialExam`, `learningPath`, `communityGaps` and `thirdPartyResources`. `config.researchMaxWebSearches` is split across them with `splitSearchBudget` (16 becomes 4/4/4/4; minimum 1 each, so a budget below 4 still allows 4 searches). Each investigation logs `Read the official exam page (6 sources)` and returns `{ key, notes, sources, usage }`. Notes are capped at 20k chars and `max_output_tokens` is 16k. `store: false`. |
| `sources.ts` | Extracts `url_citation` annotations, normalizes URLs (strips `utm_*`, `ref`, `fbclid`, `gclid` and the hash), drops blocked and non-HTTPS URLs, and deduplicates by URL. The snippet is the claim sentence before the citation marker. It infers `kind` from the domain (video, forum, course, official provider domains plus the certification's official host, blog, community, other) and builds kebab-case slug ids. `mergeSources()` deduplicates across investigations and assigns globally unique ids (`-2`, `-3` suffixes), capped at 60. |
| `filters.ts` | `isBlockedUrl(url)` blocks unparseable URLs, non-HTTPS URLs, and hosts that equal or end with a `config.blockedResearchDomains` entry. Also exports `isBlockedHost` and `filterAllowedUrls`. |
| `structure.ts` | Stage B. One call with no tools and a strict JSON format. The model is told to return `sources: []`. `finalizeBriefCandidate()` then attaches the canonical source list (so URLs can never be invented), pins `certification.provider`/`code` to the DB values, and drops learning path items, community resources and checklist links on blocked domains. Next comes `validateBriefContent`. On failure, one repair call sends the previous output plus up to 30 validation errors. If it is still invalid, it throws `UserFacingJobError('The research result could not be validated. Try refreshing again.')`. `max_output_tokens` is 48k. |
| `persist.ts` | One `prisma.$transaction`: computes `version = max + 1`, marks the CURRENT brief SUPERSEDED, and inserts the new CURRENT `StudyBrief` (content JSON, model, `sourceCount`, tokens, `jobId`, `requestedById`). It then sets `Certification.lastResearchedAt` and fills `officialUrl` (HTTPS only), `examVersion` (max 120 chars) and `examUpdatedAt` (from an ISO `lastOfficialUpdate`) only when they are empty. |
| `usage.ts` | Token usage helpers. |
| `index.ts` | `researchBrief({ client, certification, requestedById, jobId, log, signal, model? })` is the lower-level entry point and returns `{ briefId, version, content, inputTokens, outputTokens }`. `runBriefResearch(ctx)` loads the certification, picks the client (`ctx.useServerKey ? getServerOpenAIClient() : getOpenAIClientForUser(ctx.requestedById)`; a missing server key gives a `UserFacingJobError`), and maps errors through `toUserFacingResearchError`. Also re-exports `isBlockedUrl`. |

Logged milestones: `Starting research for DP-700`, `Read the official exam page (N sources)` (one per investigation), `Continuing without …` when some fail, `Structuring the brief`, `Saved brief v3 with 23 sources`.

Failure policy:
- If some investigations fail, the brief is still produced, and a warning that names the missing parts is appended to `content.warnings`.
- If all fail, the first error is rethrown (then mapped).
- If no usable sources remain, the job fails with a user-facing message.
- Aborts (`ctx.signal`) propagate as is.

Error mapping (`toUserFacingResearchError`):
- 401: "OpenAI rejected your API key..." (or a server-key variant).
- 429 `insufficient_quota`: a no-quota message pointing to billing.
- Other 429: "rate-limited, wait a minute".
- 404 mentioning a model: "model X is not available to your key".
- 403: "key not permitted to use model X or web search".
- `MissingApiKeyError`, `UserFacingJobError` and aborts pass through. Everything else is rethrown, so the queue shows the generic message.

## CLI

```
npm --prefix server run research -- --code DP-700 --provider Microsoft [--title "..."] [--official-url https://...] [--model gpt-5.5] [--key sk-...]
# or: OPENAI_API_KEY=sk-... npm --prefix server run research -- --code DP-700 --provider Microsoft
```

- `server/src/scripts/research-cli.ts`, run with `tsx` (`"research"` script appended to `server/package.json`).
- Upserts the system user (`tenantId "system"`, `objectId "system"`, `displayName "Upskill"`).
- Finds the certification by `normalizeKey(provider)` + `normalizeKey(code)`, or creates it (code upper-cased, title defaults to `"<provider> <CODE>"`).
- Builds a plain `new OpenAI({ apiKey })` and calls `researchBrief` directly with `jobId: null`. The key is never stored.
- Writes progress to stderr, the brief JSON to stdout, and saves a new CURRENT version. SIGINT aborts.
- **Caution:** the worktree's `server/.env` points `DATABASE_URL` at the main checkout's `dev.db` (S0 deviation 2). Run with `DATABASE_URL=file:./dev.db` to write to the worktree database.
- Only argument validation was exercised (no key was available).

## Fixture for seeding without a key

`server/src/services/research/__fixtures__/dp-700.sample.json` is a full `StudyBriefContent` for Microsoft DP-700. It has 22 sources, 9 official learning path items, 8 community resources, 5 known gaps and 18 checklist items across all five phases. It **passes `validateBriefContent`**, checked with a one-off `tsx` script that has since been deleted.

- **Deviation:** it has **3 skill areas, not 6**. The real outline (study guide, skills measured as of 2026-10-19, fetched today) has exactly three domains, each 30–35%. The ten sub-groups are kept as subtopics. Following the structuring prompt's rule, the weights use the range midpoint (`32.5`) and keep the range in the title.
- The skills outline, exam facts and official doc URLs come from the live study guide or are standard Microsoft Learn paths, but the URLs were **not individually link-checked**. The community sources point at real hubs (subreddit, Medium tag, YouTube channels), and their snippets are labelled "Sample summary". Treat the file as demo data, not a researched brief.
- To seed it, insert a `StudyBrief` with `content = JSON.stringify(fixture)`, `version 1`, `status 'CURRENT'`, `model 'fixture'`, `sourceCount 22`, `requestedById` = the system user, and set `Certification.lastResearchedAt`. Alternatively, call `persistBrief({ certificationId, content, model: 'fixture', inputTokens: 0, outputTokens: 0, jobId: null, requestedById })` from `services/research/persist.js`. Workstream B has its own client-side fixture (`client/src/pages/brief/fixtures/dp-700.sample.ts`).

## Known limits

- Web search reads pages through OpenAI's search tool only. YouTube transcripts, Reddit comment threads behind "load more", and paywalled courses are **not read**; community claims come from what search snippets and pages expose.
- Citation titles come from the search tool and can be generic; `publisher` is the hostname.
- `kind` inference is heuristic and domain-based.
- No live OpenAI call was made (no key available). Prompt quality, token use (my estimate is about 60–120k input and 15–30k output tokens per brief, with search context dominating) and timing (expect 1–3 minutes) are unverified.
- `blocked_domains` acceptance by the API is unverified (see the fallback above).
- If the repair call also fails, tokens spent on that job are not reported, because the job errors out.
- The SDK default request timeout (10 min) and its 2 retries apply. The queue's 5 s shutdown grace aborts in-flight calls through `ctx.signal`.

## Integrator checklist

1. Set current model names in `.env` / `.env.example` (see "Model names" above), then run one live CLI brief with a real key against the worktree DB.
2. No route or contract changes are needed. `handlers.ts` already maps `runBriefResearch` to `resultBriefId`.
3. Optional: B/E may use `isBlockedUrl` (exported from `services/research/index.js`) for user-supplied links.
4. `npm --prefix server run build` compiles the CLI into `dist/scripts/` (harmless).

## Verification

- `npm --prefix server run build`: passes.
- `npm --prefix server run lint`: passes (0 warnings), with the other workstreams' files present.
- One-off `tsx` checks (deleted afterwards):
  - Fixture validates.
  - `zodTextFormat` output is strict `json_schema`.
  - Citation extraction strips `utm_source`, drops `examtopics.com` and `http://` URLs, and produces kebab ids and claim snippets.
  - `checkBriefCandidate` accepts model output with `sources: []`, reports unknown source ids and `http` links as repairable errors, silently drops a community resource on a blocked domain, and handles truncated JSON.
- CLI argument handling (`--help`, missing key) was checked. No database writes or OpenAI calls were made.
- No automated test suite exists; none was run.
