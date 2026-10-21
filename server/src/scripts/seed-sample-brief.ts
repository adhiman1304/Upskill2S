// Seeds the DP-700 sample brief (services/research/__fixtures__/dp-700.sample.json) as the CURRENT
// StudyBrief of the Microsoft DP-700 certification, so the real brief page has content without an OpenAI key.
//
//   npm --prefix server run seed:sample-brief            # skips when DP-700 already has a CURRENT brief
//   npm --prefix server run seed:sample-brief -- --force # saves the sample as a new CURRENT version anyway
//
// Run `npm --prefix server run db:seed` first so the catalog row exists (it is created here otherwise).
// The sample is demo data, not a researched brief: it is saved with model "fixture" and requested by the system user.
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { prisma } from '../database.js'
import { validateBriefContent } from '../lib/contracts/index.js'
import { resolveCertification } from '../services/catalog/index.js'
import { persistBrief } from '../services/research/persist.js'

// src/scripts and dist/scripts are both two levels below server/, so this resolves from either.
const fixtureUrl = new URL('../../src/services/research/__fixtures__/dp-700.sample.json', import.meta.url)

async function main() {
  const { values } = parseArgs({ options: { force: { type: 'boolean' } }, strict: true })

  const parsed = validateBriefContent(JSON.parse(readFileSync(fixtureUrl, 'utf8')))
  if (!parsed.success) {
    console.error('The sample brief does not pass validateBriefContent:')
    for (const issue of parsed.error.issues.slice(0, 20)) console.error(`  ${issue.path.join('.')}: ${issue.message}`)
    return 1
  }
  const content = parsed.data

  const systemUser = await prisma.user.upsert({
    where: { tenantId_objectId: { tenantId: 'system', objectId: 'system' } },
    update: {},
    create: { tenantId: 'system', objectId: 'system', displayName: 'Upskill' },
    select: { id: true },
  })
  const { id: certificationId } = await resolveCertification({
    provider: content.certification.provider,
    code: content.certification.code,
    title: content.certification.title,
    officialUrl: content.certification.officialUrl,
  }, systemUser.id)

  const current = await prisma.studyBrief.findFirst({ where: { certificationId, status: 'CURRENT' }, select: { id: true, version: true, model: true } })
  if (current && !values.force) {
    console.log(`DP-700 (${certificationId}) already has a CURRENT brief v${current.version} (model ${current.model}); nothing to do. Pass --force to add the sample as a new version.`)
    return 0
  }

  const { briefId, version } = await persistBrief({
    certificationId,
    content,
    model: 'fixture',
    inputTokens: 0,
    outputTokens: 0,
    jobId: null,
    requestedById: systemUser.id,
  })
  console.log(`Saved the DP-700 sample brief as v${version} (${briefId}) with ${content.sources.length} sources for certification ${certificationId}.`)
  console.log(`Open http://localhost:5173/certifications/${certificationId} (or your CLIENT_ORIGIN).`)
  return 0
}

main()
  .then((code) => { process.exitCode = code })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
