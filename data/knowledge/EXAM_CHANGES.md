# Exam change log

Findings gathered by the catalog research agent on 2026-10-21 while verifying codes, titles and official pages against vendor sites. This is the knowledge behind the `aliases` in `prisma/seed/catalog.json`: searching or resolving an old code returns its successor.

## Retired or replaced exams

| Old code | Current exam | Note |
|---|---|---|
| AI-900 | AI-901 | AI-900 retired 2026-06-30 |
| AZ-204 | AI-200 | Azure AI Cloud Developer Associate; AZ-204 retired 2026-07-31 |
| AZ-500 | SC-500 | Cloud and AI Security Engineer Associate |
| AI-102 | AI-103 | Azure AI Apps and Agents Developer Associate |
| DP-100 | AI-300 | Machine Learning Operations Engineer Associate |
| MS-900 | AB-900 | MS-900 retired 2026-03-31. AB-900 (Copilot and Agent Administration Fundamentals) is the closest current exam, not a rename |
| SOA-C02 | SOA-C03 | AWS CloudOps Engineer Associate |
| SCS-C02 | SCS-C03 | AWS Security Specialty |
| CS0-003 | CS0-004 | CompTIA CySA+ |
| COF-C02 | COF-C03 | SnowPro Core |

## Naming and code changes

- CompTIA A+ uses `220-1201` (alias `220-1202`).
- Cisco DevNet Associate is now "CCNA Automation" (`200-901`).
- HashiCorp: Terraform Associate 004 and Vault Associate 003.
- Oracle uses the 2026 codes `1Z0-1085-26` and `1Z0-1072-26`.
- Salesforce renamed its exams to Platform Administrator (`ADM-201`) and Platform Developer (`CRT-450`).
- Red Hat: EX294 now leads to "RHCE in Ansible".
- PeopleCert: ITIL 5 Foundation exists alongside ITIL 4 Foundation.
- AWS added AIP-C01 (Generative AI Developer, Professional).

## Upcoming changes (update the seed codes when each switch happens)

| Current | Successor | Date |
|---|---|---|
| DVA-C02 | DVA-C03 | 2026-11-30 |
| SAP-C02 | SAP-C03 | 2026-11-16 |
| SY0-701 | SY0-801 | launches 2026-11-17 |
| MLA-C01 | MLA-C02 | in beta |

The successor codes are already aliases, so they are findable today.

## Vendors without official exam codes

Google Cloud, ISC2, ISACA, PMI, PeopleCert, Databricks and Linux Foundation use short codes or slugs in the catalog (for example `PCA`, `PCDOE`, `ITIL4-FOUNDATION`, `DATA-ENGINEER-ASSOCIATE`). Intake recommendations that name these exams by title rather than code may not match the catalog row yet; adding titles as aliases is a known follow-up.

## Verification caveats

- PMI and Oracle sites return 403 to automated requests. The PMI CAPM and PMI-ACP links and the Oracle `1Z0-1072-26` link follow each vendor's URL pattern or were confirmed by search only.
- The DP-700 sample brief (`briefs/microsoft-dp-700-v1.json` and `server/src/services/research/__fixtures__/dp-700.sample.json`) reflects the skills outline as published 2026-10-19: three skill areas at 30 to 35 percent each. Its community snippets are labelled as sample summaries and its URLs were not individually link-checked. Treat it as demo data until a live research run replaces it.

## OpenAI model notes (from the research pipeline agent, 2026-10-21)

- `gpt-5` and `gpt-5-mini` snapshots are scheduled for shutdown on 2026-12-11. Current defaults are `gpt-6-astra` (research) and `gpt-6-luna` (fast).
- The Responses API web search tool type is `web_search`; `web_search_preview` is legacy. Citations arrive as `url_citation` annotations and links carry `utm_source=openai`, which the pipeline strips.
- `max_tool_calls` is accepted by the API but missing from SDK 6.49.0 types; `filters.blocked_domains` is documented in the guide but not in the API reference, so the pipeline retries without it if rejected.
