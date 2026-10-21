import type OpenAI from 'openai'
import { APIUserAbortError, AuthenticationError, NotFoundError, PermissionDeniedError, RateLimitError } from 'openai'
import type { StudyBriefContent } from '../../lib/contracts/index.js'
import { prisma } from '../../database.js'
import { UserFacingJobError, type JobContext } from '../jobs/queue.js'
import { getOpenAIClientForUser, getServerOpenAIClient, MissingApiKeyError, openAiModels } from '../openai/client.js'
import { INVESTIGATION_KEYS, runInvestigations, type InvestigationResult } from './investigations.js'
import { persistBrief } from './persist.js'
import { investigationTitles, type CertificationSubject } from './prompts.js'
import { mergeSources } from './sources.js'
import { structureBrief } from './structure.js'
import { addUsage, emptyUsage } from './usage.js'

export { isBlockedUrl } from './filters.js'

const MAX_SOURCES = 60

export interface ResearchCertification extends CertificationSubject {
  id: string
}

export interface ResearchBriefOptions {
  client: OpenAI
  certification: ResearchCertification
  requestedById: string
  jobId: string | null
  log: (message: string) => Promise<void>
  signal: AbortSignal
  /** Defaults to `openAiModels.research`. */
  model?: string
}

export interface ResearchBriefResult {
  briefId: string
  version: number
  content: StudyBriefContent
  inputTokens: number
  outputTokens: number
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) throw signal.reason instanceof Error ? signal.reason : new APIUserAbortError()
}

/**
 * Lower-level entry point: research, structure and persist one brief with an explicit
 * OpenAI client. Used by `runBriefResearch` (job worker) and the research CLI.
 */
export async function researchBrief(options: ResearchBriefOptions): Promise<ResearchBriefResult> {
  const model = options.model ?? openAiModels.research
  const subject: CertificationSubject = {
    provider: options.certification.provider,
    code: options.certification.code,
    title: options.certification.title,
    officialUrl: options.certification.officialUrl,
  }
  let usage = emptyUsage()

  await options.log(`Starting research for ${subject.code}`)
  const settled = await runInvestigations({ client: options.client, model, subject, signal: options.signal, log: options.log })
  throwIfAborted(options.signal)

  const succeeded: InvestigationResult[] = []
  const failures: unknown[] = []
  const warnings: string[] = []
  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      succeeded.push(outcome.value)
      usage = addUsage(usage, outcome.value.usage)
    } else {
      failures.push(outcome.reason)
    }
  }
  if (!succeeded.length) throw failures[0] ?? new Error('All research investigations failed.')
  if (failures.length) {
    failures.forEach((reason) => console.error(`Research investigation failed for ${subject.code}:`, reason))
    const missing = settled.flatMap((outcome, index) => outcome.status === 'rejected' ? [investigationLabel(index)] : [])
    await options.log(`Continuing without ${missing.join(', ')}`)
    warnings.push(`Part of the research could not be completed (${missing.join(', ')}); this brief may be incomplete.`)
  }

  const sources = mergeSources(succeeded.map((result) => result.sources), MAX_SOURCES)
  if (!sources.length) throw new UserFacingJobError('The web search returned no usable sources for this certification. Check the provider and exam code, then try again.')

  await options.log('Structuring the brief')
  const structured = await structureBrief({
    client: options.client,
    model,
    subject,
    notes: succeeded.map((result) => ({ label: investigationTitles[result.key], text: result.notes })),
    sources,
    signal: options.signal,
  })
  usage = addUsage(usage, structured.usage)
  throwIfAborted(options.signal)

  const content: StudyBriefContent = warnings.length ? { ...structured.content, warnings: [...structured.content.warnings, ...warnings] } : structured.content
  const saved = await persistBrief({
    certificationId: options.certification.id,
    content,
    model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    jobId: options.jobId,
    requestedById: options.requestedById,
  })
  await options.log(`Saved brief v${saved.version} with ${content.sources.length} sources`)
  return { briefId: saved.briefId, version: saved.version, content, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens }
}

function investigationLabel(index: number) {
  const key = INVESTIGATION_KEYS[index]
  return key ? investigationTitles[key] : 'one investigation'
}

/** Maps OpenAI errors whose cause is safe and actionable to `UserFacingJobError`; returns anything else unchanged. */
export function toUserFacingResearchError(error: unknown, model: string, useServerKey: boolean): unknown {
  if (error instanceof UserFacingJobError || error instanceof MissingApiKeyError || error instanceof APIUserAbortError) return error
  const whose = useServerKey ? 'the server OpenAI key' : 'your OpenAI key'
  if (error instanceof AuthenticationError) {
    return new UserFacingJobError(useServerKey ? 'OpenAI rejected the server API key. Ask an administrator to update it.' : 'OpenAI rejected your API key. Update it in Settings and try again.')
  }
  if (error instanceof RateLimitError) {
    if (error.code === 'insufficient_quota') return new UserFacingJobError(`The OpenAI account behind ${whose} has no remaining quota. Check billing on platform.openai.com, then try again.`)
    return new UserFacingJobError('OpenAI rate-limited this research request. Wait a minute and try again.')
  }
  if (error instanceof NotFoundError && /model/i.test(error.message)) return new UserFacingJobError(`The research model "${model}" is not available to ${whose}.`)
  if (error instanceof PermissionDeniedError) return new UserFacingJobError(`${useServerKey ? 'The server OpenAI key' : 'Your OpenAI key'} is not permitted to use the research model "${model}" or web search. Check the key's project permissions.`)
  return error
}

/** Job handler entry point for BRIEF and REFRESH jobs. */
export async function runBriefResearch(ctx: JobContext): Promise<{ briefId: string; inputTokens: number; outputTokens: number }> {
  if (!ctx.certificationId) throw new UserFacingJobError('This research job has no certification.')
  const certification = await prisma.certification.findUnique({
    where: { id: ctx.certificationId },
    select: { id: true, provider: true, code: true, title: true, officialUrl: true },
  })
  if (!certification) throw new UserFacingJobError('The certification for this job no longer exists.')

  const model = openAiModels.research
  try {
    let client: OpenAI
    if (ctx.useServerKey) {
      const serverClient = getServerOpenAIClient()
      if (!serverClient) throw new UserFacingJobError('No server OpenAI key is configured for scheduled research.')
      client = serverClient
    } else {
      client = await getOpenAIClientForUser(ctx.requestedById)
    }
    const result = await researchBrief({ client, certification, requestedById: ctx.requestedById, jobId: ctx.jobId, log: ctx.log, signal: ctx.signal, model })
    return { briefId: result.briefId, inputTokens: result.inputTokens, outputTokens: result.outputTokens }
  } catch (error) {
    throw toUserFacingResearchError(error, model, ctx.useServerKey)
  }
}
