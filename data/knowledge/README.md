# Knowledge exports

> **Temporary measure.** These files exist only so the certification knowledge gathered during the AI rework is not lost with a local SQLite file. Committing JSON exports to git is not the long-term storage design. The team is going to decide on a real database structure (hosted Postgres or similar, with object storage for briefs and sources); when that lands, replace this folder with a proper import/export or backup path and delete the exports from git. Until then, re-run the export after any research run worth keeping.

Durable copies of what the platform has learned, kept in git because the local SQLite database is not.

| File | What it is | How it is produced |
|---|---|---|
| `CATALOG.md` | Readable catalog of every seeded exam by provider, with aliases and official pages | `npm --prefix server run export:knowledge` (from `prisma/seed/catalog.json`) |
| `EXAM_CHANGES.md` | Retired, renamed and upcoming exam codes found while building the catalog, plus API notes | Written by hand from the agent handoffs; update when the seed changes |
| `certifications.json` | Every certification row in the database at export time, with current brief metadata | export script |
| `briefs/index.json`, `briefs/*.json` | Every study brief version with its full content and sources | export script |

Re-run the export after real research runs so briefs are not lost with the database. The seed (`npm --prefix server run db:seed`) restores the catalog; `npm --prefix server run seed:sample-brief` restores the DP-700 sample brief. Restoring arbitrary exported briefs is a follow-up (a `import:knowledge` script).
