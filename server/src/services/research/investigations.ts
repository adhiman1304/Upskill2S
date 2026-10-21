import OpenAI, { BadRequestError } from 'openai'
import type { BriefSource } from '../../lib/contracts/index.js'
import { config } from '../../config.js'
import { investigationInput, investigationInstructions, investigationTitles, type CertificationSubject, type InvestigationKey } from './prompts.js'
import { extractCitedSources, officialHostsFor } from './sources.js'
import { usageOf, type TokenUsage } from './usage.js'

export const INVESTIGATION_KEYS: readonly InvestigationKey[] = ['officialExam', 'learningPath', 'communityGaps', 'thirdPartyResources']

/** Generous cap: reasoning tokens count toward it, and notes are asked to stay under ~900 words. */
const INVESTIGATION_MAX_OUTPUT_TOKENS = 16_000
const MAX_NOTES_CHARS = 20_000

export interface InvestigationResult {
  key: InvestigationKey
  notes: string
  sources: BriefSource[]
  usage: TokenUsage
}

export interface InvestigationOptions {
  client: OpenAI
  model: string
  subject: CertificationSubject
  signal: AbortSignal
  log: (message: string) => Promise<void>
  maxWebSearches?: number
  blockedDomains?: readonly string[]
  now?: Date
}

/** Splits the total web search budget across the investigations (at least one each, remainder to the first ones). */
export function splitSearchBudget(total: number, parts: number): number[] {
  const base = Math.max(1, Math.floor(total / parts))
  const remainder = Math.max(0, total - base * parts)
  return Array.from({ length: parts }, (_, index) => base + (index < remainder ? 1 : 0))
}

function webSearchTool(blockedDomains: readonly string[], withFilters: boolean): OpenAI.Responses.WebSearchTool {
  const tool: OpenAI.Responses.WebSearchTool = { type: 'web_search', search_context_size: 'medium' }
  // `blocked_domains` is documented for the `web_search` tool but not yet typed in SDK 6.49.0.
  if (withFilters && blockedDomains.length) tool.filters = { blocked_domains: blockedDomains.slice(0, 100) } as unknown as OpenAI.Responses.WebSearchTool.Filters
  return tool
}

function isFilterRejection(error: unknown) {
  return error instanceof BadRequestError && /blocked_domains|filters/i.test(error.message)
}

export async function runInvestigation(key: InvestigationKey, maxToolCalls: number, options: InvestigationOptions): Promise<InvestigationResult> {
  const blockedDomains = options.blockedDomains ?? config.blockedResearchDomains
  const now = options.now ?? new Date()
  const request = (withFilters: boolean) => {
    // `max_tool_calls` is a documented create parameter, but SDK 6.49.0 only types it on the realtime client event.
    const body: OpenAI.Responses.ResponseCreateParamsNonStreaming & { max_tool_calls: number } = {
      model: options.model,
      instructions: investigationInstructions(key),
      input: investigationInput(options.subject, key, now.toISOString().slice(0, 10)),
      tools: [webSearchTool(blockedDomains, withFilters)],
      max_tool_calls: maxToolCalls,
      max_output_tokens: INVESTIGATION_MAX_OUTPUT_TOKENS,
      store: false,
    }
    return options.client.responses.create(body, { signal: options.signal })
  }

  let response: OpenAI.Responses.Response
  try {
    response = await request(true)
  } catch (error) {
    // Defensive: if the API ever rejects the domain filter, retry without it. Sources are filtered locally anyway.
    if (!isFilterRejection(error)) throw error
    console.warn(`Research investigation ${key}: web_search filters rejected, retrying without them.`)
    response = await request(false)
  }

  const notes = response.output_text.trim().slice(0, MAX_NOTES_CHARS)
  const sources = extractCitedSources(response, {
    retrievedAt: now.toISOString(),
    officialHosts: officialHostsFor(options.subject.officialUrl),
    blockedDomains,
  })
  const label = investigationTitles[key]
  await options.log(`Read ${label} (${sources.length} source${sources.length === 1 ? '' : 's'})`)
  if (!notes) throw new Error(`Investigation ${key} returned no text (status ${response.status ?? 'unknown'}).`)
  return { key, notes, sources, usage: usageOf(response) }
}

/** Stage A: the four investigations in parallel. Rejections are returned, not thrown, so partial results can be used. */
export async function runInvestigations(options: InvestigationOptions): Promise<PromiseSettledResult<InvestigationResult>[]> {
  const budget = splitSearchBudget(options.maxWebSearches ?? config.researchMaxWebSearches, INVESTIGATION_KEYS.length)
  return Promise.allSettled(INVESTIGATION_KEYS.map((key, index) => runInvestigation(key, budget[index] ?? 1, options)))
}
