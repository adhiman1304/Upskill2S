# D handoff: Home, catalog and settings UI

Status: done. Server and client build and lint pass (the client still has the old `LibraryPage` exhaustive-deps warning, which I did not touch).

## Files

- Server: `server/src/services/catalog/index.ts`, `server/src/routes/catalog.ts`
- Seed: `prisma/seed/catalog.json`, `prisma/seed/seed.ts`. I appended `"db:seed": "tsx ../prisma/seed/seed.ts"` to `server/package.json` and added `migrations.seed` in `server/prisma.config.ts`, so `prisma db seed` also works.
- Client: `client/src/pages/home/{HomePage,CertificationSearch,MyCertifications,ProviderBrowse,FreshnessChip}.tsx`, `home.css`; `client/src/pages/settings/SettingsPage.tsx`, `settings.css`; `client/src/lib/api/{catalog,settings}.ts`

## Catalog

The catalog has **84 entries** across 16 providers:

| Provider | Entries |
|---|---|
| Microsoft | 22 |
| AWS | 12 |
| Google Cloud | 9 |
| CompTIA | 8 |
| Cisco | 3 |
| ISC2 | 4 |
| ISACA | 3 |
| PMI | 3 |
| PeopleCert | 3 |
| Linux Foundation | 4 |
| HashiCorp | 2 |
| Red Hat | 2 |
| Oracle | 3 |
| Salesforce | 2 |
| Databricks | 3 |
| Snowflake | 1 |

Codes, titles and URLs were checked against vendor pages on 2026-10-21. Several exams on the requested list have been retired or replaced. Each one below uses the current exam, and its old code is kept in `aliases`, so searching the old code finds the successor:

| Old code | Seeded exam | Change |
|---|---|---|
| AI-900 | AI-901 | AI-900 retired 2026-06-30 |
| AZ-204 | AI-200 | Azure AI Cloud Developer Associate; AZ-204 retired 2026-07-31 |
| AZ-500 | SC-500 | Cloud and AI Security Engineer Associate |
| AI-102 | AI-103 | Azure AI Apps and Agents Developer Associate |
| DP-100 | AI-300 | Machine Learning Operations Engineer Associate |
| MS-900 | AB-900 | MS-900 retired 2026-03-31. AB-900 (Copilot and Agent Administration Fundamentals) is the closest current exam, not a rename. |
| SOA-C02 | SOA-C03 | CloudOps Engineer Associate |
| SCS-C02 | SCS-C03 | |
| CS0-003 | CS0-004 | CySA+ |
| COF-C02 | COF-C03 | SnowPro Core |

Other naming changes:

- **CompTIA A+** uses `220-1201` (alias `220-1202`).
- **Cisco DevNet Associate** is now "CCNA Automation" (`200-901`).
- **HashiCorp:** Terraform Associate 004 and Vault Associate 003.
- **Oracle** uses the 2026 codes `1Z0-1085-26` and `1Z0-1072-26`.
- **Salesforce** renamed its exams to Platform Administrator (`ADM-201`) and Platform Developer (`CRT-450`).
- **Red Hat:** EX294 now leads to "RHCE in Ansible".
- **ITIL:** I added ITIL 5 Foundation next to ITIL 4 Foundation.
- **AWS:** I added AIP-C01 (Generative AI Developer – Professional).

Some current codes will be replaced within weeks:

- DVA-C02 by DVA-C03 (2026-11-30)
- SAP-C02 by SAP-C03 (2026-11-16)
- SY0-701 by SY0-801 (launches 2026-11-17)
- MLA-C01 by MLA-C02 (currently in beta)

The upcoming codes are already aliases. Update the seed codes when each switch happens; the seed then updates rows that already exist (see "How to seed").

Vendors without official codes (Google, ISC2, ISACA, PMI, PeopleCert, Databricks, Linux Foundation) use short codes or slugs that match `certificationSchema`'s code regex, for example `PCA`, `PCDOE`, `ITIL4-FOUNDATION` and `DATA-ENGINEER-ASSOCIATE`.

Some URLs could not be fetched, because the PMI and Oracle sites return 403 to bots. These follow each vendor's URL pattern or were confirmed by search only: PMI CAPM and PMI-ACP, and Oracle 1Z0-1072-26.

## How to seed

```
npm --prefix server run db:seed
# or: cd server && npx prisma db seed --config prisma.config.ts
```

The seed reuses `server/src/database.ts`, so it uses the same libsql adapter. It loads `server/.env` through `config.ts` and dotenv, with the working directory set to `server/`. Because it imports `config.ts`, production seeding needs the same environment as the API (`TENANT_ID`, `API_AUDIENCE`, `KEY_ENCRYPTION_SECRET`).

What it does:

1. Upserts the system user (`system`/`system`, "Upskill").
2. Upserts each entry by `providerKey + codeKey`, using the legacy `normalizeKey`.
3. New rows get `isCatalog: true`, the code in upper case, and `createdById` set to the system user.
4. For rows that already exist, it only refreshes `officialUrl`, `aliases` and `isCatalog`. Titles edited by users are kept.

The seed can be run again safely. On the worktree DB it reported 84 entries, then 0 created and 84 updated on the second run.

## Routes

These are mounted at `/api/catalog` and protected by `requireAuth`.

**`GET /api/catalog/search?q=dp-7`** returns `CatalogHitDto[]`.

- With an empty `q`, it returns the user's followed certifications first, then recently researched ones (`lastResearchedAt` set), up to 12. This list is what Home shows under "My certifications".
- With a query, it matches provider, code, title and aliases case-insensitively. It also does a punctuation-insensitive match, so `dp700` finds DP-700.
- Ranking: exact code, then exact title or alias, then code prefix, then a prefix of a word in the provider, title or alias, then substring (every token must match). It returns at most 15 hits.
- Catalog entries that are not yet in the database are returned with `source: 'catalog'` and `certificationId: null`.
- `briefStatus` comes from the generation time of the CURRENT StudyBrief compared with `config.briefStaleDays`.
- A query longer than 100 characters returns 400.

```
$ curl 'localhost:4010/api/catalog/search?q=dp-7'
[{"certificationId":"cmv…","provider":"Microsoft","code":"DP-700","title":"…","officialUrl":"https://learn.microsoft.com/…","source":"db","briefStatus":"missing","lastResearchedAt":null}]
```

**`POST /api/catalog/resolve`** takes `{provider, code, title, officialUrl?}` and returns `{id}`.

- Status is **201** when the row was created and **200** when it was found.
- The body is checked with `resolveCertificationInputSchema`, extended with the `certificationSchema` provider, code and title rules (including the code regex). `officialUrl` must use HTTPS.
- It matches by normalized provider and code. Common provider names are mapped: "Amazon Web Services" becomes AWS, "GCP" becomes Google Cloud, "(ISC)2" becomes ISC2, and so on.
- A code-like alias also matches. **Note:** this means resolving `AZ-500` returns SC-500, its successor.
- When it creates a row, `createdById` is the requesting user. `isCatalog` is true only if the input matched a catalog entry; in that case the catalog's provider, code, title and aliases are used. `officialUrl` comes from the input if it uses HTTPS, otherwise from the catalog.
- Concurrent creates are handled: on a P2002 unique-constraint error it fetches the existing row again.

```
$ curl -X POST localhost:4010/api/catalog/resolve -H 'content-type: application/json' \
  -d '{"provider":"Microsoft","code":"az-140","title":"Microsoft Certified: Azure Virtual Desktop Specialty"}'
{"id":"cmv…"}   # 201 the first time, 200 after that
```

Service exports from `services/catalog/index.ts`:

- `searchCatalog(query, userId)`
- `resolveCertification(input, userId)`, which returns `{ id }` (plan signature; C can use it for intake select)
- `findOrCreateCertification(input, userId)`, which returns `{ id, created }`
- `listCatalogEntries()`, which returns the cached, validated catalog.json. It reads `<repo>/prisma/seed/catalog.json` relative to the module, which works from both `src/` and `dist/`.

## Client

**Home**

- The hero asks one question and has a combobox typeahead (250 ms debounce, AbortController, arrow keys, Enter and Escape, ARIA `aria-activedescendant`).
- Each row shows the provider logo, code, title, provider and a freshness chip.
- A db hit navigates to `/certifications/:id`. A catalog hit calls resolve first and then navigates.
- When nothing matches, the dropdown links to `/intake`.
- Other parts of the page:
  - the "I don't know yet, help me choose" link to `/intake`
  - `<section id="mine">` "My certifications", with an empty state and the hash-scroll effect from C0
  - "Browse by provider" tiles: `featuredProviders` minus Anthropic, which has no catalog exams, plus HashiCorp, Salesforce, Databricks and Snowflake. A click fills the search box.
  - "How it works" in three steps
  - a "Community library" link to `/library`

**Settings**

- Shows the key status with its hint and when it was last validated.
- The key field is password-style with a show/hide toggle.
- Save calls PUT. An `OPENAI_KEY_INVALID` error is shown inline. On success, the field is cleared and a note shows the new hint.
- Remove calls DELETE after a confirm.
- An encryption note explains how the key is stored. The key is never logged or echoed back.
- A Models card shows `research` and `fast`, plus a line saying whether a server key is available.

## Verified

- Server build and lint, and client build and lint, pass.
- `db:seed` and `prisma db seed` both run against the worktree DB (`file:./dev.db`).
- API on port 4010:
  - `q=dp-7` and `q=dp700` returned DP-700.
  - `aws security` returned SCS-C03, and `az-500` returned SC-500.
  - With the CKS row deleted, CKS came back as `source:'catalog'`.
  - An empty `q` with one followed certification returned it.
  - Resolving unseeded AZ-140 returned 201, then 200 on a repeat. Resolving "Amazon Web Services"/`saa-c03` returned 200 with the seeded row.
  - An `http://` URL returned 400, a bad code returned 400, and a `q` over 100 characters returned 400.
- Browser at `localhost:5174`:
  - Typing "dp-700" showed the DP-700 row.
  - Arrow keys and Enter opened `/certifications/:id`, which B's page rendered.
  - Selecting a catalog-only hit (CKS) resolved and navigated.
  - A provider tile filled the search box.
  - `/#mine` scrolled to the section.
  - On `/settings`, a fake `sk-` key showed "OpenAI rejected this key." inline.
  - The 375 px mobile layout had no horizontal scroll.
- Test changes I made to the DB were reverted: a temporary follow, and the deleted CKS row, which was recreated through resolve and then re-seeded.
- The AZ-140 row created by the resolve test is still in the worktree DB.

## For the integrator

1. **Contract gap:** "My certifications" cannot show the follow status (PLANNING / STUDYING / PASSED), because `CatalogHitDto` has no such field; it shows freshness and research date instead. **Proposal:** add `following: { status, targetDate } | null` to `CatalogHitDto` on both sides, set it in `searchCatalog` (the followed list is already queried), and render it in `MyCertifications.tsx`.
2. Provider logos come from `google.com/s2/favicons`, as in the legacy page. In the preview pane the Microsoft and AWS logos loaded.
3. The DP-700 row in the worktree DB has the title "Implementing Data Engineering Solutions Using Microsoft Fabric", set by another workstream before seeding. The seed does not overwrite titles on existing rows.
4. A full `npm run build` currently passes with everyone's files as they are now.
