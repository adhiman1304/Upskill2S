// Owned by workstream D. Seeds the system user and the well-known exam catalog.
// Run from server/: `npm run db:seed` (or `npx prisma db seed --config prisma.config.ts`).
// Reuses the API's database module, so it loads server/.env via dotenv and uses the same libsql adapter.
import { readFile } from 'node:fs/promises'
import { prisma } from '../../server/src/database.js'
import { catalogSeedEntrySchema } from '../../server/src/lib/contracts/catalog.js'
import { normalizeKey } from '../../server/src/lib/validation.js'

const SYSTEM_USER = { tenantId: 'system', objectId: 'system', displayName: 'Upskill' }

async function main() {
  const raw = JSON.parse(await readFile(new URL('./catalog.json', import.meta.url), 'utf8')) as unknown
  const entries = catalogSeedEntrySchema.array().parse(raw)
  for (const entry of entries) {
    if (entry.officialUrl && !entry.officialUrl.startsWith('https://')) throw new Error(`Catalog entry ${entry.provider} ${entry.code} must use an HTTPS officialUrl.`)
  }

  const system = await prisma.user.upsert({
    where: { tenantId_objectId: { tenantId: SYSTEM_USER.tenantId, objectId: SYSTEM_USER.objectId } },
    create: SYSTEM_USER,
    update: { displayName: SYSTEM_USER.displayName },
  })

  let created = 0
  let updated = 0
  for (const entry of entries) {
    const providerKey = normalizeKey(entry.provider)
    const codeKey = normalizeKey(entry.code)
    const existing = await prisma.certification.findUnique({ where: { providerKey_codeKey: { providerKey, codeKey } }, select: { id: true } })
    const catalogFields = { officialUrl: entry.officialUrl, aliases: JSON.stringify(entry.aliases), isCatalog: true }
    if (existing) {
      // Keep user-edited fields (title, description) on rows that already exist; only refresh catalog metadata.
      await prisma.certification.update({ where: { id: existing.id }, data: catalogFields })
      updated += 1
    } else {
      await prisma.certification.create({
        data: { provider: entry.provider, providerKey, code: entry.code.toUpperCase(), codeKey, title: entry.title, createdById: system.id, ...catalogFields },
      })
      created += 1
    }
  }
  console.log(`Catalog seed: ${entries.length} entries (${created} created, ${updated} updated).`)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
