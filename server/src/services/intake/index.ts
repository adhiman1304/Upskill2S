import { AuthenticationError, RateLimitError } from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { prisma } from '../../database.js'
import { intakeModelOutputSchema, type HeldCertification, type IntakeModelOutput, type IntakeResult } from '../../lib/contracts/index.js'
import { normalizeKey } from '../../lib/validation.js'
import { canonicalProviderKey } from '../catalog/index.js'
import { clip, displayProvider, findDbCertification, matchCatalogEntry, toCertificationCode } from '../catalog/identify.js'
import { UserFacingJobError, type JobContext } from '../jobs/queue.js'
import { getOpenAIClientForUser, getServerOpenAIClient, MissingApiKeyError, openAiModels } from '../openai/client.js'
import { buildIntakeInput, INTAKE_INSTRUCTIONS } from './prompts.js'
import { withChildSignal } from '../../lib/abort.js'

/** Flip to 'fast' to trade recommendation quality for speed and cost. */
const INTAKE_MODEL_TIER: 'research' | 'fast' = 'research'
const MIN_RECOMMENDATIONS = 1
const MAX_RECOMMENDATIONS = 6
const MAX_HELD = 20

function intakeModel() {
  return INTAKE_MODEL_TIER === 'research' ? openAiModels.research : openAiModels.fast
}

function heldKey(provider: string, code: string) {
  return `${canonicalProviderKey(provider)}\u0000${normalizeKey(code)}`
}

/**
 * Held certifications from the model, made safe to save: catalog provider names, codes that pass the certification
 * code regex, catalog and db matches (catalog code wins), clipped text, no duplicates. Same steps as identify.
 */
export async function finalizeHeldCertifications(raw: IntakeModelOutput['heldCertifications']): Promise<HeldCertification[]> {
  const seen = new Set<string>()
  const held: HeldCertification[] = []
  for (const item of raw) {
    if (held.length >= MAX_HELD) break
    const title = clip(item.title, 160)
    const code = toCertificationCode(item.code, title)
    if (!item.provider.trim() || !title || !code) continue
    const provider = displayProvider(item.provider)
    const entry = matchCatalogEntry(provider, code, title)
    const row = await findDbCertification([provider, item.provider, ...(entry ? [entry.provider] : [])], [code, ...(entry ? [entry.code] : [])])
    const finalCode = entry?.code ?? row?.code ?? code
    const key = heldKey(entry?.provider ?? provider, finalCode)
    if (seen.has(key)) continue
    seen.add(key)
    const year = item.yearObtained
    held.push({
      provider: entry?.provider ?? provider,
      code: finalCode,
      title: entry?.title ?? title,
      yearObtained: year !== null && year >= 1950 && year <= new Date().getFullYear() ? year : null,
      evidence: clip(item.evidence, 200),
      catalogMatch: row || entry ? { certificationId: row?.id ?? null, code: row?.code ?? entry?.code ?? code } : null,
      saved: false,
    })
  }
  return held
}

/**
 * Drops non-HTTPS links, re-ranks in order, caps the list, post-processes held certifications, and removes
 * recommendations for certifications the person already holds (unless that would leave none).
 */
export async function normalizeIntakeResult(output: IntakeModelOutput): Promise<IntakeResult> {
  const heldCertifications = await finalizeHeldCertifications(output.heldCertifications)
  const heldKeys = new Set(heldCertifications.flatMap((item) => [heldKey(item.provider, item.code), ...(item.catalogMatch ? [heldKey(item.provider, item.catalogMatch.code)] : [])]))
  const sorted = [...output.recommendations].sort((a, b) => a.rank - b.rank)
  const notHeld = sorted.filter((item) => {
    const code = toCertificationCode(item.code, item.title) ?? item.code
    const entry = matchCatalogEntry(item.provider, code, item.title)
    return !heldKeys.has(heldKey(entry?.provider ?? item.provider, entry?.code ?? code))
  })
  const recommendations = (notHeld.length ? notHeld : sorted)
    .slice(0, MAX_RECOMMENDATIONS)
    .map((recommendation, index) => {
      let officialUrl: string | null = null
      if (recommendation.officialUrl) {
        try { if (new URL(recommendation.officialUrl).protocol === 'https:') officialUrl = recommendation.officialUrl } catch { officialUrl = null }
      }
      return { ...recommendation, rank: index + 1, provider: recommendation.provider.trim(), code: recommendation.code.trim(), title: recommendation.title.trim(), officialUrl }
    })
  return { profileSummary: output.profileSummary, detectedSkills: output.detectedSkills, goals: output.goals, heldCertifications, recommendations, followUpQuestions: output.followUpQuestions }
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
      text: { format: zodTextFormat(intakeModelOutputSchema, 'intake_result') },
    }, { signal }))
    if (!response.output_parsed) throw new UserFacingJobError('The model did not return recommendations. Try again.')
    const checked = intakeModelOutputSchema.safeParse(response.output_parsed)
    if (!checked.success) throw new UserFacingJobError('The model returned recommendations in an unexpected format. Try again.')
    const result = await normalizeIntakeResult(checked.data)
    if (result.recommendations.length < MIN_RECOMMENDATIONS) throw new UserFacingJobError('No suitable certifications were found. Add more detail about your background and goals.')
    if (result.heldCertifications.length) await ctx.log(`Found ${result.heldCertifications.length} certification(s) you already hold.`)
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
