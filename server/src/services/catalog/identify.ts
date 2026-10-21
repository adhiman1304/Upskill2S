// Owned by workstream F. Free-text certification identification: web search + structuring, then catalog matching.
import OpenAI, { APIConnectionError, APIConnectionTimeoutError, APIUserAbortError, AuthenticationError, BadRequestError, NotFoundError, PermissionDeniedError, RateLimitError } from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { identifyModelOutputSchema, type ApiErrorCode, type IdentifyCandidate, type IdentifyModelOutput, type IdentifyResult } from '../../lib/contracts/index.js'
import { config } from '../../config.js'
import { prisma } from '../../database.js'
import { normalizeKey } from '../../lib/validation.js'
import { openAiModels } from '../openai/models.js'
import { isBlockedUrl } from '../research/filters.js'
import { extractCitedSources } from '../research/sources.js'
import { canonicalProviderKey, compact, findCatalogEntry, httpsOrNull, listCatalogEntries } from './index.js'

export const IDENTIFY_TIMEOUT_MS = 60_000
const IDENTIFY_MAX_TOOL_CALLS = 4
const SEARCH_MAX_OUTPUT_TOKENS = 8_000
const STRUCTURE_MAX_OUTPUT_TOKENS = 4_000
const MAX_NOTES_CHARS = 8_000
const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

/** A failure whose message is safe to show; the route sends `{ error: message, code }` with `status`. */
export class IdentifyError extends Error {
  constructor(message: string, readonly status: number, readonly code?: ApiErrorCode) {
    super(message)
    this.name = 'IdentifyError'
  }
}

const SEARCH_INSTRUCTIONS = `You identify professional IT and technology certification exams from a user's free-text description.
The text may be misspelled, informal, abbreviated or use an old exam name.
Use web search to find which real, currently offered certification exam(s) the user means. Prefer the vendor's official pages.
Report up to 3 candidates, best first. For each give: the vendor (provider), the official exam code (or say the vendor has none),
the official certification title, the official HTTPS page URL on the vendor's or its exam delivery partner's site, one sentence on
what it is and who it is for, and how confident you are that it is what the user meant (high / medium / low).
Include a retired exam only if the user clearly means it, and then say it is retired and name its successor exam code.
Never invent certifications, codes or URLs. If nothing real matches, say so plainly. Keep the notes under 400 words.`

const STRUCTURE_INSTRUCTIONS = `Convert research notes about certification exams into JSON matching the schema.
Rules:
- Only include certifications the notes confirm exist. Return {"candidates": []} if the notes found nothing real.
- At most 3 candidates, best match first.
- code: the official exam code exactly as the vendor writes it (for example "AZ-104", "SAA-C03", "CCAR-F"). If the vendor has no code,
  use a short upper-case slug of the title with letters, digits and dashes only (for example "PROFESSIONAL-CLOUD-ARCHITECT").
- title: the official certification title. provider: the vendor's common name (for example "Microsoft", "AWS", "Google Cloud", "Anthropic").
- officialUrl: an https:// URL taken from the notes or cited sources, on the vendor's official site or its exam delivery partner; otherwise null.
- note: one sentence, plain text.
- confidence: high only when the notes clearly confirm the exam matches the user's text.
- retired: true only for an exam that is no longer offered; then successorCode is the replacement's code, else null.`

function searchInput(query: string, today: string) {
  return `Today is ${today}.\nThe user is looking for this certification exam: """${query}"""`
}

function structureInput(query: string, notes: string, sources: { title: string; url: string }[]) {
  const sourceLines = sources.map((source) => `- ${source.title}: ${source.url}`).join('\n') || '- (none)'
  return `User's text: """${query}"""\n\nResearch notes:\n${notes}\n\nCited sources:\n${sourceLines}`
}

function refusalOf(response: OpenAI.Responses.Response): string | null {
  for (const item of response.output) {
    if (item.type !== 'message') continue
    for (const part of item.content) if (part.type === 'refusal') return part.refusal
  }
  return null
}

// --- post-processing ----------------------------------------------------------------------------

function clip(value: string, max: number) {
  const trimmed = value.replace(/\s+/g, ' ').trim()
  return trimmed.length > max ? `${trimmed.slice(0, max - 1).trimEnd()}…` : trimmed
}

/** Coerces a model-supplied code (or, failing that, the title) into something the certification code regex accepts. */
export function toCertificationCode(rawCode: string, title: string): string | null {
  const fromCode = (value: string) => value.trim().toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9._-]/g, '').replace(/^[^A-Z0-9]+/, '').replace(/-{2,}/g, '-').slice(0, 40).replace(/[._-]+$/, '')
  const code = fromCode(rawCode)
  if (code && CODE_PATTERN.test(code) && !/^(N\/?A|NONE|NULL)$/.test(code)) return code
  const slug = fromCode(title.replace(/[^A-Za-z0-9]+/g, '-'))
  return slug && CODE_PATTERN.test(slug) ? slug : null
}

/** Provider name as the catalog spells it ("Amazon Web Services" -> "AWS"), else the model's text. */
function displayProvider(provider: string) {
  const key = canonicalProviderKey(provider)
  return listCatalogEntries().find((entry) => canonicalProviderKey(entry.provider) === key)?.provider ?? clip(provider, 80)
}

/** Catalog entry by provider + code (or code-like alias), else by provider + title/alias. */
function matchCatalogEntry(provider: string, code: string, title: string) {
  const byCode = findCatalogEntry(provider, code)
  if (byCode) return byCode
  const providerKey = canonicalProviderKey(provider)
  const titleCompact = compact(title)
  if (!titleCompact) return null
  return listCatalogEntries().find((entry) => canonicalProviderKey(entry.provider) === providerKey
    && [entry.title, ...entry.aliases].some((name) => compact(name) === titleCompact)) ?? null
}

async function findDbCertification(providers: string[], codes: string[]) {
  const providerKeys = [...new Set(providers.flatMap((provider) => [normalizeKey(provider), canonicalProviderKey(provider)]))]
  const codeKeys = [...new Set(codes.map(normalizeKey))]
  return prisma.certification.findFirst({
    where: { providerKey: { in: providerKeys }, codeKey: { in: codeKeys } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, code: true },
  })
}

/** Turns raw model output into contract candidates: valid codes, HTTPS-only links, normalized providers, catalog matches, no duplicates. */
export async function finalizeCandidates(output: IdentifyModelOutput): Promise<IdentifyCandidate[]> {
  const seen = new Set<string>()
  const candidates: IdentifyCandidate[] = []
  for (const raw of output.candidates.slice(0, 3)) {
    const title = clip(raw.title, 160)
    const code = toCertificationCode(raw.code, title)
    if (!raw.provider.trim() || !title || !code) continue
    const provider = displayProvider(raw.provider)
    const entry = matchCatalogEntry(provider, code, title)
    const row = await findDbCertification([provider, raw.provider, ...(entry ? [entry.provider] : [])], [code, ...(entry ? [entry.code] : [])])
    const key = `${canonicalProviderKey(entry?.provider ?? provider)}\u0000${normalizeKey(entry?.code ?? row?.code ?? code)}`
    if (seen.has(key)) continue
    seen.add(key)

    const officialUrl = httpsOrNull(raw.officialUrl)
    const successor = raw.retired && raw.successorCode ? toCertificationCode(raw.successorCode, '') : null
    candidates.push({
      provider: entry?.provider ?? provider,
      code,
      title,
      officialUrl: officialUrl && !isBlockedUrl(officialUrl) ? officialUrl : entry?.officialUrl ?? null,
      note: clip(raw.note, 400),
      confidence: raw.confidence,
      retired: raw.retired,
      successorCode: successor,
      catalogMatch: row || entry ? { certificationId: row?.id ?? null, code: row?.code ?? entry?.code ?? code } : null,
    })
  }
  return candidates
}

// --- OpenAI calls -------------------------------------------------------------------------------

function toIdentifyError(error: unknown, timedOut: boolean, model: string): unknown {
  if (error instanceof IdentifyError) return error
  if (timedOut || error instanceof APIConnectionTimeoutError) return new IdentifyError('Identifying the certification took too long. Try again or add more detail.', 504)
  if (error instanceof APIUserAbortError) return error
  if (error instanceof AuthenticationError) return new IdentifyError('OpenAI rejected your API key. Update it in Settings and try again.', 400, 'OPENAI_KEY_INVALID')
  if (error instanceof RateLimitError) {
    if (error.code === 'insufficient_quota') return new IdentifyError('The OpenAI account behind your key has no remaining quota. Check billing on platform.openai.com, then try again.', 402)
    return new IdentifyError('OpenAI rate-limited this request. Wait a minute and try again.', 429, 'RATE_LIMITED')
  }
  if (error instanceof NotFoundError && /model/i.test(error.message)) return new IdentifyError(`The research model "${model}" is not available to your OpenAI key.`, 502)
  if (error instanceof PermissionDeniedError) return new IdentifyError(`Your OpenAI key is not permitted to use the model "${model}" or web search. Check the key's project permissions.`, 502)
  if (error instanceof BadRequestError || error instanceof APIConnectionError) return new IdentifyError('OpenAI could not complete the identification. Try again later.', 502)
  return error
}

/**
 * Two calls: (1) research model + web_search (max 4 tool calls) writes notes with citations,
 * (2) fast model structures the notes into `identifyModelOutputSchema`. Aborts after 60 s or when `signal` aborts.
 */
export async function identifyCertification(options: { client: OpenAI; query: string; signal?: AbortSignal; now?: Date }): Promise<IdentifyResult> {
  const now = options.now ?? new Date()
  const model = openAiModels.research
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, IDENTIFY_TIMEOUT_MS)
  const onParentAbort = () => controller.abort()
  options.signal?.addEventListener('abort', onParentAbort, { once: true })
  const requestOptions = { signal: controller.signal, maxRetries: 0 }

  try {
    // `max_tool_calls` is a documented create parameter, but SDK 6.49.0 only types it on the realtime client event.
    const searchBody: OpenAI.Responses.ResponseCreateParamsNonStreaming & { max_tool_calls: number } = {
      model,
      instructions: SEARCH_INSTRUCTIONS,
      input: searchInput(options.query, now.toISOString().slice(0, 10)),
      tools: [{ type: 'web_search', search_context_size: 'low' }],
      max_tool_calls: IDENTIFY_MAX_TOOL_CALLS,
      max_output_tokens: SEARCH_MAX_OUTPUT_TOKENS,
      store: false,
    }
    const searched = await options.client.responses.create(searchBody, requestOptions)
    const notes = searched.output_text.trim().slice(0, MAX_NOTES_CHARS)
    const result = (candidates: IdentifyCandidate[]): IdentifyResult => ({ query: options.query, candidates, searchedAt: now.toISOString(), model })
    if (!notes || refusalOf(searched)) return result([])

    const sources = extractCitedSources(searched, { retrievedAt: now.toISOString(), blockedDomains: config.blockedResearchDomains })
      .slice(0, 20)
      .map(({ title, url }) => ({ title, url }))
    const structured = await options.client.responses.create({
      model: openAiModels.fast,
      instructions: STRUCTURE_INSTRUCTIONS,
      input: [{ role: 'user', content: structureInput(options.query, notes, sources) }],
      text: { format: zodTextFormat(identifyModelOutputSchema, 'identify_result') },
      max_output_tokens: STRUCTURE_MAX_OUTPUT_TOKENS,
      store: false,
    }, requestOptions)
    if (refusalOf(structured)) return result([])
    let raw: unknown
    try { raw = JSON.parse(structured.output_text) } catch { raw = null }
    const parsed = identifyModelOutputSchema.safeParse(raw)
    if (!parsed.success) {
      console.warn('Certification identify: structured output failed validation.', parsed.error.issues.slice(0, 5))
      throw new IdentifyError('The identification result could not be read. Try again.', 502)
    }
    return result(await finalizeCandidates(parsed.data))
  } catch (error) {
    throw toIdentifyError(error, timedOut, model)
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onParentAbort)
  }
}
