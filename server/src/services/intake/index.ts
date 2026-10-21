import { AuthenticationError, RateLimitError } from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { prisma } from '../../database.js'
import { intakeResultSchema, type IntakeResult } from '../../lib/contracts/index.js'
import { UserFacingJobError, type JobContext } from '../jobs/queue.js'
import { getOpenAIClientForUser, getServerOpenAIClient, MissingApiKeyError, openAiModels } from '../openai/client.js'
import { buildIntakeInput, INTAKE_INSTRUCTIONS } from './prompts.js'
import { withChildSignal } from '../../lib/abort.js'

/** Flip to 'fast' to trade recommendation quality for speed and cost. */
const INTAKE_MODEL_TIER: 'research' | 'fast' = 'research'
const MIN_RECOMMENDATIONS = 1
const MAX_RECOMMENDATIONS = 6

function intakeModel() {
  return INTAKE_MODEL_TIER === 'research' ? openAiModels.research : openAiModels.fast
}

/** Drops non-HTTPS links, re-ranks in order, and caps the list. */
export function normalizeIntakeResult(result: IntakeResult): IntakeResult {
  const recommendations = [...result.recommendations]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, MAX_RECOMMENDATIONS)
    .map((recommendation, index) => {
      let officialUrl: string | null = null
      if (recommendation.officialUrl) {
        try { if (new URL(recommendation.officialUrl).protocol === 'https:') officialUrl = recommendation.officialUrl } catch { officialUrl = null }
      }
      return { ...recommendation, rank: index + 1, provider: recommendation.provider.trim(), code: recommendation.code.trim(), title: recommendation.title.trim(), officialUrl }
    })
  return { ...result, recommendations }
}

export async function runIntakeRecommendation(ctx: JobContext): Promise<{ inputTokens: number; outputTokens: number }> {
  if (!ctx.intakeSessionId) throw new UserFacingJobError('This intake job has no session attached.')
  const session = await prisma.intakeSession.findUnique({ where: { id: ctx.intakeSessionId } })
  if (!session) throw new UserFacingJobError('The intake session no longer exists.')
  await prisma.intakeSession.update({ where: { id: session.id }, data: { status: 'RUNNING', error: null } })
  const model = intakeModel()
  try {
    const client = ctx.useServerKey ? getServerOpenAIClient() : await getOpenAIClientForUser(ctx.requestedById)
    if (!client) throw new UserFacingJobError('No server OpenAI key is configured.')
    await ctx.log(`Analyzing your profile with ${model}.`)
    const response = await withChildSignal(ctx.signal, (signal) => client.responses.parse({
      model,
      instructions: INTAKE_INSTRUCTIONS,
      input: buildIntakeInput(session.inputText, session.extractedText),
      text: { format: zodTextFormat(intakeResultSchema, 'intake_result') },
    }, { signal }))
    if (!response.output_parsed) throw new UserFacingJobError('The model did not return recommendations. Try again.')
    const checked = intakeResultSchema.safeParse(response.output_parsed)
    if (!checked.success) throw new UserFacingJobError('The model returned recommendations in an unexpected format. Try again.')
    const result = normalizeIntakeResult(checked.data)
    if (result.recommendations.length < MIN_RECOMMENDATIONS) throw new UserFacingJobError('No suitable certifications were found. Add more detail about your background and goals.')
    await ctx.log(`Found ${result.recommendations.length} recommendation(s).`)
    await prisma.intakeSession.update({ where: { id: session.id }, data: { status: 'SUCCEEDED', result: JSON.stringify(result), model, error: null } })
    return { inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 }
  } catch (error) {
    const safe = sessionErrorMessage(error, ctx.signal)
    await prisma.intakeSession.update({ where: { id: session.id }, data: { status: 'FAILED', error: safe, model } }).catch((updateError: unknown) => {
      console.error(`Could not mark intake session ${session.id} as failed:`, updateError)
    })
    throw error
  }
}

function sessionErrorMessage(error: unknown, signal: AbortSignal) {
  if (signal.aborted) return 'The server shut down while this was running. Try again.'
  if (error instanceof UserFacingJobError || error instanceof MissingApiKeyError) return error.message
  if (error instanceof AuthenticationError) return 'OpenAI rejected your API key. Update it in Settings.'
  if (error instanceof RateLimitError) return 'OpenAI rate limit or quota exceeded. Try again later.'
  return 'The recommendation failed unexpectedly. Try again later.'
}

/** On boot, RUNNING intake sessions (QUEUED ones still have a queued job) belong to a dead process: mark them FAILED. */
export async function recoverInterruptedIntakeSessions(): Promise<void> {
  const { count } = await prisma.intakeSession.updateMany({
    where: { status: 'RUNNING' },
    data: { status: 'FAILED', error: 'The server restarted while this was running. Try again.' },
  })
  if (count) console.warn(`Marked ${count} interrupted intake session(s) as FAILED.`)
}
