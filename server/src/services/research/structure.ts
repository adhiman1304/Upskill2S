import type OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { studyBriefContentSchema, validateBriefContent, type BriefSource, type StudyBriefContent } from '../../lib/contracts/index.js'
import { config } from '../../config.js'
import { UserFacingJobError } from '../jobs/queue.js'
import { isBlockedUrl } from './filters.js'
import { repairInput, STRUCTURE_INSTRUCTIONS, structureInput, type CertificationSubject } from './prompts.js'
import { addUsage, emptyUsage, usageOf, type TokenUsage } from './usage.js'
import { withChildSignal } from '../../lib/abort.js'

/** The brief JSON is large (often 8-15k tokens) and reasoning tokens count toward this cap. */
const STRUCTURE_MAX_OUTPUT_TOKENS = 48_000
const MAX_REPORTED_ERRORS = 30

export interface StructureOptions {
  client: OpenAI
  model: string
  subject: CertificationSubject
  notes: { label: string; text: string }[]
  sources: BriefSource[]
  signal: AbortSignal
  blockedDomains?: readonly string[]
  now?: Date
}

type Validation = { ok: true; content: StudyBriefContent } | { ok: false; errors: string[] }

function refusalOf(response: OpenAI.Responses.Response): string | null {
  for (const item of response.output) {
    if (item.type !== 'message') continue
    for (const part of item.content) if (part.type === 'refusal') return part.refusal
  }
  return null
}

/**
 * Applies server-owned fields and safety filtering to the model output before validation:
 * the canonical source list replaces whatever the model wrote, provider and code are pinned,
 * and items or links on blocked domains are dropped.
 */
export function finalizeBriefCandidate(raw: unknown, subject: CertificationSubject, sources: BriefSource[], blockedDomains: readonly string[] = config.blockedResearchDomains): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw
  const candidate = { ...(raw as Record<string, unknown>) }
  candidate.sources = sources
  if (candidate.certification && typeof candidate.certification === 'object') {
    const certification = { ...(candidate.certification as Record<string, unknown>) }
    certification.provider = subject.provider
    certification.code = subject.code
    if (typeof certification.title !== 'string' || !certification.title.trim()) certification.title = subject.title
    candidate.certification = certification
  }
  const keepAllowed = (value: unknown) => Array.isArray(value)
    ? value.filter((item) => !(item && typeof item === 'object' && typeof (item as { url?: unknown }).url === 'string' && isBlockedHostOnly((item as { url: string }).url, blockedDomains)))
    : value
  candidate.officialLearningPath = keepAllowed(candidate.officialLearningPath)
  candidate.communityResources = keepAllowed(candidate.communityResources)
  if (Array.isArray(candidate.checklist)) {
    candidate.checklist = candidate.checklist.map((item: unknown) => {
      if (!item || typeof item !== 'object' || !Array.isArray((item as { links?: unknown }).links)) return item
      return { ...(item as object), links: keepAllowed((item as { links: unknown[] }).links) }
    })
  }
  return candidate
}

/** Blocked-domain check only; non-HTTPS links are left for validation so the repair call can fix them. */
function isBlockedHostOnly(url: string, blockedDomains: readonly string[]) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
  } catch {
    return false
  }
  return isBlockedUrl(url, blockedDomains)
}

export function checkBriefCandidate(outputText: string, subject: CertificationSubject, sources: BriefSource[], blockedDomains?: readonly string[]): Validation {
  let raw: unknown
  try { raw = JSON.parse(outputText) } catch { return { ok: false, errors: ['The output is not complete, valid JSON. Return the full JSON object.'] } }
  const result = validateBriefContent(finalizeBriefCandidate(raw, subject, sources, blockedDomains))
  if (result.success) return { ok: true, content: result.data }
  const errors = result.error.issues.slice(0, MAX_REPORTED_ERRORS).map((issue) => `${issue.path.length ? issue.path.join('.') : '(root)'}: ${issue.message}`)
  return { ok: false, errors }
}

/** Stage B: one strict-JSON structuring call, plus at most one repair call when validation fails. */
export async function structureBrief(options: StructureOptions): Promise<{ content: StudyBriefContent; usage: TokenUsage; repaired: boolean }> {
  const today = (options.now ?? new Date()).toISOString().slice(0, 10)
  const userInput = structureInput({
    subject: options.subject,
    today,
    notes: options.notes,
    sources: options.sources.map(({ id, title, url, kind }) => ({ id, title, url, kind })),
  })
  const format = zodTextFormat(studyBriefContentSchema, 'study_brief')
  let usage = emptyUsage()

  const call = async (input: OpenAI.Responses.ResponseInput) => {
    const response = await withChildSignal(options.signal, (signal) => options.client.responses.create({
      model: options.model,
      instructions: STRUCTURE_INSTRUCTIONS,
      input,
      text: { format },
      max_output_tokens: STRUCTURE_MAX_OUTPUT_TOKENS,
      store: false,
    }, { signal }))
    usage = addUsage(usage, usageOf(response))
    const refusal = refusalOf(response)
    if (refusal) throw new UserFacingJobError('The model declined to structure this brief. Try refreshing again.')
    return response.output_text
  }

  const firstInput: OpenAI.Responses.ResponseInput = [{ role: 'user', content: userInput }]
  const firstOutput = await call(firstInput)
  const first = checkBriefCandidate(firstOutput, options.subject, options.sources, options.blockedDomains)
  if (first.ok) return { content: first.content, usage, repaired: false }

  console.warn(`Brief structuring for ${options.subject.code} failed validation; attempting one repair. Errors:`, first.errors)
  const repairOutput = await call([
    ...firstInput,
    { role: 'assistant', content: firstOutput || '{}' },
    { role: 'user', content: repairInput(first.errors) },
  ])
  const second = checkBriefCandidate(repairOutput, options.subject, options.sources, options.blockedDomains)
  if (second.ok) return { content: second.content, usage, repaired: true }

  console.error(`Brief repair for ${options.subject.code} still invalid:`, second.errors)
  throw new UserFacingJobError('The research result could not be validated. Try refreshing again.')
}
