// Research CLI: runs the brief pipeline for one certification without the job worker.
//
//   npm --prefix server run research -- --code DP-700 --provider Microsoft [--title "..."] [--official-url https://...] [--model gpt-6.1-sol] [--key sk-...]
//
// The key comes from --key or OPENAI_API_KEY and is used only for this process; it is never stored.
// The brief JSON is printed to stdout and saved as a new CURRENT StudyBrief version.
import { parseArgs } from 'node:util'
import OpenAI from 'openai'
import { prisma } from '../database.js'
import { normalizeKey } from '../lib/validation.js'
import { researchBrief } from '../services/research/index.js'

const usage = 'Usage: npm --prefix server run research -- --code DP-700 --provider Microsoft [--title "..."] [--official-url https://...] [--model gpt-6.1-sol] [--key sk-...]'

async function main() {
  const { values } = parseArgs({
    options: {
      code: { type: 'string' },
      provider: { type: 'string' },
      title: { type: 'string' },
      'official-url': { type: 'string' },
      model: { type: 'string' },
      key: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  })
  if (values.help) {
    console.error(usage)
    return 0
  }
  const code = values.code?.trim()
  const provider = values.provider?.trim()
  const apiKey = (values.key ?? process.env.OPENAI_API_KEY ?? '').trim()
  if (!code || !provider) {
    console.error(usage)
    return 2
  }
  if (!apiKey) {
    console.error('Provide an OpenAI API key with --key or the OPENAI_API_KEY environment variable.')
    return 2
  }
  const officialUrl = values['official-url']?.trim() || null
  if (officialUrl && !officialUrl.startsWith('https://')) {
    console.error('--official-url must use https.')
    return 2
  }

  const systemUser = await prisma.user.upsert({
    where: { tenantId_objectId: { tenantId: 'system', objectId: 'system' } },
    update: {},
    create: { tenantId: 'system', objectId: 'system', displayName: 'Upskill' },
  })

  const providerKey = normalizeKey(provider)
  const codeKey = normalizeKey(code)
  let certification = await prisma.certification.findUnique({
    where: { providerKey_codeKey: { providerKey, codeKey } },
    select: { id: true, provider: true, code: true, title: true, officialUrl: true },
  })
  if (!certification) {
    certification = await prisma.certification.create({
      data: {
        provider,
        providerKey,
        code: code.toUpperCase(),
        codeKey,
        title: values.title?.trim() || `${provider} ${code.toUpperCase()}`,
        officialUrl,
        createdById: systemUser.id,
      },
      select: { id: true, provider: true, code: true, title: true, officialUrl: true },
    })
    console.error(`Created certification ${certification.provider} ${certification.code} (${certification.id}).`)
  } else {
    console.error(`Using existing certification ${certification.provider} ${certification.code} (${certification.id}).`)
  }

  const controller = new AbortController()
  process.once('SIGINT', () => controller.abort(new Error('Interrupted.')))

  const started = Date.now()
  const result = await researchBrief({
    client: new OpenAI({ apiKey }),
    certification: { ...certification, officialUrl: certification.officialUrl ?? officialUrl },
    requestedById: systemUser.id,
    jobId: null,
    signal: controller.signal,
    log: async (message) => { console.error(`[${((Date.now() - started) / 1000).toFixed(1)}s] ${message}`) },
    ...(values.model ? { model: values.model } : {}),
  })

  process.stdout.write(`${JSON.stringify(result.content, null, 2)}\n`)
  console.error(`Saved brief ${result.briefId} (v${result.version}); tokens in ${result.inputTokens}, out ${result.outputTokens}.`)
  return 0
}

main()
  .then((code) => { process.exitCode = code })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
