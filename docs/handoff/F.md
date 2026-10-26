# F handoff: free-text certification identification (server half)

Status: server done. The client half is specified at the end and has **not** been built; another agent owns `client/`.

## Files

| File | Change |
|---|---|
| `server/src/services/catalog/fuzzy.ts` | New. Tokenizer, Damerau-Levenshtein (optimal string alignment) distance, per-token similarity, `fuzzyScore`. |
| `server/src/services/catalog/index.ts` | Fuzzy tier (rank 5) in `searchCatalog`. Provider aliases `claude` and `anthropic pbc` map to `anthropic`. Exports `httpsOrNull`, `compact`, `canonicalProviderKey`, `findCatalogEntry` for `identify.ts`. |
| `server/src/services/catalog/identify.ts` | New. `identifyCertification`, `finalizeCandidates`, `toCertificationCode`, `IdentifyError`. |
| `server/src/routes/catalog.ts` | New route `POST /identify`. |
| `server/src/lib/contracts/catalog.ts` | New schemas: `identifyRequestSchema`, `identifyConfidenceSchema`, `identifyModelOutputSchema`, `identifyCandidateSchema`, `identifyResultSchema`, and their types. |
| `prisma/seed/catalog.json` | 4 Anthropic entries; the catalog now has 88. |
| `data/knowledge/EXAM_CHANGES.md` | New "Anthropic" section. |

## Anthropic certifications

Anthropic's **Claude Certification Program** runs through the Claude Partner Network. Exams are delivered by Pearson VUE and badges are issued through Credly. These four are offered today, with the codes Pearson VUE uses:

| Code | Title | Price |
|---|---|---|
| `CCAO-F` | Claude Certified Associate – Foundations | $99 |
| `CCDV-F` | Claude Certified Developer – Foundations | $125 |
| `CCAR-F` | Claude Certified Architect – Foundations | $125 |
| `CCAR-P` | Claude Certified Architect – Professional | $175 |

Each `officialUrl` is the exam's Anthropic Partner Academy page, `https://anthropic-partners.skilljar.com/claude-certified-<role>-<level>-certification`. All four returned HTTP 200.

Aliases include informal names ("Claude Associate", "Claude Developer", "Anthropic Developer", "Claude Architect"), common misspellings ("Claude Assosiate", "Claude Develper", "Claude Achitect", "Claude Architech") and the community short codes `CCA-F`, `CCA-P`, `CCDV`, `CCAO`.

Limits the owner should know about:

- Only employees of Claude Partner Network organizations can sit these exams.
- On 2026-12-07 the Associate, Developer and Architect – Professional exams get updated content. The new exam guides come out 2026-11-17.

I found no other Anthropic certification. The "CCD-F" and "CCAS-F" codes in some blog posts do not exist; the official codes are the four above.

Sources:

- [claude.com: four role-based certifications (2026-07-23)](https://claude.com/resources/articles/four-role-based-claude-certifications)
- [Pearson VUE Anthropic page](https://www.pearsonvue.com/us/en/anthropic.html)
- [Partner Academy certification FAQ](https://anthropic-partners.skilljar.com/page/faq-certifications)
- [Architect – Foundations page](https://anthropic-partners.skilljar.com/claude-certified-architect-foundations-certification)

The seed ran against the running database (`npm --prefix server run db:seed`): 88 entries, 4 created, 84 updated.

## Fuzzy search (`fuzzy.ts`)

The existing tiers (0 exact code through 4 substring) are unchanged. A candidate that matches none of them is scored as follows:

1. **Query tokens.** The query is lower-cased and split on punctuation; `+` stays part of a word, so `security+` is one token. Stopwords are dropped: `exam`, `cert`, `certification`, `certified`, `the`, `of`, `for`, and so on. Single-character tokens are dropped too, unless that would leave no tokens.
2. **Candidate vocabulary.** The tokens of provider, code, title and every alias, plus compact forms of the code and of short aliases (`az104`, `ccarf`).
3. **Per-token similarity** against each vocabulary word, keeping the best:
   - 1 for an exact match.
   - 0.92 when the query token is a prefix of the word and is at least 3 characters (0.8 for a 2-character prefix).
   - Otherwise `1 - distance / maxLength`, using OSA Damerau-Levenshtein. The number of edits allowed depends on the shorter token's length: 0 for up to 3 characters, 1 for up to 5, 2 for up to 8, and 3 beyond that. With more edits than that, the similarity is 0.
4. **Score** is the mean of the per-token best similarities. A candidate is included when **score ≥ 0.75** and at least one token scores **≥ 0.85** (an "anchor"), so weak partial matches alone never qualify.
5. Fuzzy hits get **rank 5**, so they appear below every exact, prefix and substring hit. Within a rank, results are ordered by score (descending), then by research date, then db before catalog. The total is still capped at 15.

Worked examples:

- `accosiate` vs `associate`: 3 edits on 9 letters gives 0.67. With `anthropic` and `claude` both at 1.0, the mean is 0.89, so CCAO-F is included. The architect and developer entries miss the threshold because their third token scores 0.
- `secuirty+` vs `security+`: one transposition gives 0.89.

Observed on the running API (`GET /api/catalog/search?q=…`):

| Query | Result |
|---|---|
| `anthropic claude accosiate` | CCAO-F |
| `secuirty+` | SY0-701 (CompTIA Security+) |
| `azure admin` | AZ-104, then DP-300 (substring tier, already worked) |
| `kubernets` | CKA, CKAD, CKS, KCNA |
| `aws solutions archtect` | SAA-C03, SAP-C02 |
| `data enginer` | DP-700, Databricks DE Associate/Professional, DEA-C01, PDE, and AI-300 (weaker) |
| `xyzzy` | `[]` |
| `claude`, `anthropic` | all four Anthropic exams |

## `POST /api/catalog/identify`

Request: `{ "query": string }`. The query is trimmed and must be 3 to 200 characters.

Response 200 is `IdentifyResult`. These are the exact types; the client should mirror them:

```ts
export type IdentifyConfidence = 'high' | 'medium' | 'low'
export interface IdentifyCandidate {
  provider: string            // catalog spelling when the provider is known ("AWS", "Google Cloud", "Anthropic")
  code: string                // official code, or an upper-case slug; always matches /^[A-Za-z0-9][A-Za-z0-9._-]*$/ and is at most 40 chars
  title: string               // at most 160 chars
  officialUrl: string | null  // HTTPS only, never on a blocked domain; falls back to the catalog URL
  note: string                // one sentence, at most 400 chars
  confidence: IdentifyConfidence
  retired: boolean
  successorCode: string | null    // only when retired
  catalogMatch: { certificationId: string | null; code: string } | null
}
export interface IdentifyResult { query: string; candidates: IdentifyCandidate[]; searchedAt: string; model: string }
```

How to read `catalogMatch`:

- `null`: the certification is unknown to the app.
- `{ certificationId: 'cm…', code }`: the certification already has a db row. Navigate straight to `/certifications/:certificationId`.
- `{ certificationId: null, code }`: the certification is a catalog-only entry. Call `/resolve` with `code` set to `catalogMatch.code`.

Errors, all as `{ error, code? }`:

| Status | Code | When |
|---|---|---|
| 400 | `INVALID_REQUEST` | Query missing, under 3 or over 200 characters |
| 412 | `OPENAI_KEY_MISSING` | The user has no stored key. Checked before the rate limit, so it does not count against it. |
| 429 | `RATE_LIMITED` | More than 10 identifications per user per hour. The body includes `retryAfterSeconds` and a `Retry-After` header is set. Also used when OpenAI rate-limits the key, with a different message. |
| 400 | `OPENAI_KEY_INVALID` | OpenAI returned 401 |
| 402 | none | The key has no OpenAI quota |
| 504 | none | Took longer than 60 s |
| 502 | none | Model unavailable, permission denied, output unreadable, or any other failure |

How it works (`identify.ts`):

1. **Search call.** Model is `openAiModels.research`, with the `web_search` tool (`search_context_size: 'low'`) and `max_tool_calls: 4` (passed through the same intersection-type cast as in A). `store: false`, `max_output_tokens` 8k. The output is notes plus `url_citation`s, and the citations are extracted with A's `extractCitedSources` (blocklist and HTTPS filtering).
2. **Structure call.** Model is `openAiModels.fast`, with `text.format = zodTextFormat(identifyModelOutputSchema, 'identify_result')`. That produces strict `json_schema`; I checked this locally. Input is the notes plus the cited URLs. The output is parsed and checked with `safeParse`.
3. **Post-processing** (`finalizeCandidates`):
   - Provider names are normalized through `canonicalProviderKey` and mapped to the catalog spelling.
   - Codes are coerced to the code regex. An empty or "N/A" code becomes a slug of the title.
   - Non-HTTPS and blocked URLs are dropped.
   - Each candidate is matched against the catalog: provider plus code, then a code-like alias, then title or alias. It is also matched against the db by provider and code keys.
   - Duplicates are removed and the list is capped at 3.
4. The 60 s timeout covers both calls (`maxRetries: 0`). If the HTTP client disconnects, the OpenAI calls are aborted.
5. A refusal or empty notes returns `candidates: []`.

`model` in the result is the research model's name. `searchedAt` is the server time when the request started.

Example responses. The 412 and 400 bodies were captured from the running API. The 200 body is illustrative: it is what `finalizeCandidates` produced locally from a hand-written model output.

```json
// 412
{"error":"Add your OpenAI API key in Settings to let the agent identify certifications.","code":"OPENAI_KEY_MISSING"}
// 400
{"error":"Describe the certification in 3 to 200 characters.","code":"INVALID_REQUEST"}
// 200 (illustrative)
{"query":"anthropic claude associate","searchedAt":"2026-10-22T…Z","model":"gpt-6-astra","candidates":[
  {"provider":"Anthropic","code":"CCAO-F","title":"Claude Certified Associate - Foundations",
   "officialUrl":"https://anthropic-partners.skilljar.com/claude-certified-associate-foundations-certification",
   "note":"Partner-only foundation exam on practical Claude use.","confidence":"high","retired":false,"successorCode":null,
   "catalogMatch":{"certificationId":"cmviowq530001hu5jdy8tjgp7","code":"CCAO-F"}}]}
```

## `POST /api/catalog/resolve` with a candidate

No change was needed. Send `{ provider, code, title, officialUrl }` taken directly from an `IdentifyCandidate`.

Constraints:

- `code` must match `/^[A-Za-z0-9][A-Za-z0-9._-]*$/` and be at most 40 characters. Identify always returns conforming codes, and slugs such as `PROFESSIONAL-CLOUD-ARCHITECT` pass.
- `officialUrl` must be HTTPS or null.
- `provider` and `title` are limited to 80 and 160 characters.

Resolve matches by normalized provider and code (including code-like aliases and compact forms), so `{"provider":"Claude","code":"ccarf"}` resolves to CCAR-F. Checked: it returned 200 with the seeded row.

## Verified

- `npx --prefix server tsc -p server/tsconfig.json --noEmit` passes, and `npm --prefix server run lint` passes with 0 warnings.
- The search queries in the table above were run against the running API on port 4010.
- `POST /identify` returned:
  - 412 `OPENAI_KEY_MISSING` (no key is stored)
  - 400 for `"ab"`, `{}` and a 201-character query
- Resolving the Anthropic candidate and the `Claude`/`ccarf` variant both returned 200 with the CCAR-F row.
- `finalizeCandidates` was run in a one-off local script (now deleted) against the db:
  - "Anthropic PBC" became Anthropic.
  - An `http://` URL was replaced by the catalog URL.
  - "Amazon Web Services" became AWS, and `catalogMatch` found the db row.
  - An unknown vendor with an empty code got a title slug and `catalogMatch: null`.
  - A retired successor `awp 2` became `AWP-2`.
- **Not verified:** the live OpenAI calls, since no key was available. Prompt quality, latency (I expect 15 to 40 s, which is why the timeout is 60 s) and whether the 60 s budget is enough with 4 searches are all untested.
- The 429 path was not exercised. It needs a key and 11 calls, and it uses B's `consume`.
- No automated test suite exists.

## Client half: spec

This goes in the Home search dropdown (`client/src/pages/home/CertificationSearch.tsx` and `client/src/lib/api/catalog.ts`, plus the mirrored types in `client/src/lib/contracts/catalog.ts`).

1. **Entry row.** Show it whenever the query is at least 3 characters: as the only row when there are no results, and as the last row otherwise. Label: "Can't find it? Ask the agent to identify it". It is keyboard-reachable like any other option. On empty results it replaces (or sits above) the current `/intake` link.
2. **Calling identify.** Activating the row calls `POST /api/catalog/identify { query }` through the authenticated request wrapper. While it runs, show an inline loading state in the dropdown ("Searching the web… this can take up to a minute"), and abort it if the query changes or the dropdown closes.
3. **Results.** List up to 3 candidates. Each row shows provider, code, title, a confidence chip (high, medium or low), the note, and an "Official page" link when `officialUrl` is set. A retired candidate gets a "Retired" badge and the text "replaced by {successorCode}". With zero candidates, show "The agent couldn't find a real certification matching that." and keep the `/intake` link.
4. **Picking a candidate.**
   - If `catalogMatch?.certificationId` is set, navigate to `/certifications/:certificationId`.
   - Otherwise call `POST /api/catalog/resolve` with `{ provider, code: catalogMatch?.code ?? code, title, officialUrl }`, then navigate to `/certifications/:id`.
5. **Errors.**
   - 412 `OPENAI_KEY_MISSING`: show the key callout used elsewhere ("Add your OpenAI API key in Settings…" with a link to `/settings`).
   - 429 `RATE_LIMITED`: show the server message.
   - 400 `OPENAI_KEY_INVALID`: show the message with a Settings link.
   - Anything else: show the server `error` text and a retry button.
6. **Home tiles.** Anthropic now has catalog exams, so the "Browse by provider" tiles can include Anthropic again. D removed it because it had no catalog entries.
