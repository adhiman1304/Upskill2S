/**
 * Exports the knowledge the platform has gathered so it survives without the
 * local SQLite database: every certification row and every study brief, as
 * JSON under data/knowledge/, plus a readable Markdown catalog generated from
 * prisma/seed/catalog.json.
 *
 *   npm --prefix server run export:knowledge
 */
import 'dotenv/config'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prisma } from '../database.js'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../..')
const outDir = resolve(repoRoot, 'data/knowledge')

interface CatalogEntry { provider: string; code: string; title: string; officialUrl: string | null; aliases: string[] }

async function main() {
  await mkdir(resolve(outDir, 'briefs'), { recursive: true })
  const exportedAt = new Date().toISOString()

  const certifications = await prisma.certification.findMany({
    orderBy: [{ provider: 'asc' }, { code: 'asc' }],
    include: { studyBriefs: { where: { status: 'CURRENT' }, select: { id: true, version: true, generatedAt: true, model: true, sourceCount: true } } },
  })
  const certificationRows = certifications.map((c) => ({
    provider: c.provider, code: c.code, title: c.title, description: c.description, status: c.status,
    officialUrl: c.officialUrl, aliases: JSON.parse(c.aliases) as string[], isCatalog: c.isCatalog,
    examVersion: c.examVersion, examUpdatedAt: c.examUpdatedAt?.toISOString() ?? null,
    lastResearchedAt: c.lastResearchedAt?.toISOString() ?? null,
    currentBrief: c.studyBriefs[0] ? { version: c.studyBriefs[0].version, generatedAt: c.studyBriefs[0].generatedAt.toISOString(), model: c.studyBriefs[0].model, sourceCount: c.studyBriefs[0].sourceCount } : null,
  }))
  await writeFile(resolve(outDir, 'certifications.json'), JSON.stringify({ exportedAt, count: certificationRows.length, certifications: certificationRows }, null, 2) + '\n')

  const briefs = await prisma.studyBrief.findMany({ include: { certification: { select: { provider: true, code: true, title: true } } }, orderBy: [{ certificationId: 'asc' }, { version: 'asc' }] })
  const briefIndex: { file: string; provider: string; code: string; version: number; status: string; generatedAt: string; model: string; sourceCount: number }[] = []
  for (const brief of briefs) {
    const slug = `${brief.certification.provider}-${brief.certification.code}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const file = `briefs/${slug}-v${brief.version}.json`
    await writeFile(resolve(outDir, file), JSON.stringify({
      exportedAt, certification: brief.certification, version: brief.version, status: brief.status,
      model: brief.model, sourceCount: brief.sourceCount, generatedAt: brief.generatedAt.toISOString(),
      inputTokens: brief.inputTokens, outputTokens: brief.outputTokens, content: JSON.parse(brief.content) as unknown,
    }, null, 2) + '\n')
    briefIndex.push({ file, provider: brief.certification.provider, code: brief.certification.code, version: brief.version, status: brief.status, generatedAt: brief.generatedAt.toISOString(), model: brief.model, sourceCount: brief.sourceCount })
  }
  await writeFile(resolve(outDir, 'briefs/index.json'), JSON.stringify({ exportedAt, count: briefIndex.length, briefs: briefIndex }, null, 2) + '\n')

  const catalog = JSON.parse(await readFile(resolve(repoRoot, 'prisma/seed/catalog.json'), 'utf8')) as CatalogEntry[]
  const byProvider = new Map<string, CatalogEntry[]>()
  for (const entry of catalog) byProvider.set(entry.provider, [...(byProvider.get(entry.provider) ?? []), entry])
  const lines = [
    '# Certification catalog', '',
    `Generated from \`prisma/seed/catalog.json\` on ${exportedAt.slice(0, 10)} by \`npm --prefix server run export:knowledge\`. ${catalog.length} exams across ${byProvider.size} providers. Aliases are retired or upcoming codes that resolve to this exam. See \`EXAM_CHANGES.md\` for the change log.`, '',
  ]
  for (const [provider, entries] of [...byProvider.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`## ${provider} (${entries.length})`, '', '| Code | Title | Aliases | Official page |', '|---|---|---|---|')
    for (const e of entries.sort((a, b) => a.code.localeCompare(b.code))) lines.push(`| ${e.code} | ${e.title} | ${e.aliases.join(', ') || ''} | ${e.officialUrl ? `[link](${e.officialUrl})` : ''} |`)
    lines.push('')
  }
  await writeFile(resolve(outDir, 'CATALOG.md'), lines.join('\n'))

  console.log(`Exported ${certificationRows.length} certifications and ${briefIndex.length} briefs to ${outDir}`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
