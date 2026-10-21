import OpenAI, { APIConnectionError, APIConnectionTimeoutError, APIError, AuthenticationError } from 'openai'
import { config } from '../../config.js'
import { prisma } from '../../database.js'
import { decryptSecret } from '../../lib/crypto.js'

export { openAiModels } from './models.js'

/** Thrown when a user has no stored OpenAI key. Routes map it to HTTP 412 `OPENAI_KEY_MISSING`. */
export class MissingApiKeyError extends Error {
  readonly code = 'OPENAI_KEY_MISSING'
  constructor(message = 'Add your OpenAI API key in Settings to run research.') {
    super(message)
    this.name = 'MissingApiKeyError'
  }
}

export async function getOpenAIClientForUser(userId: string): Promise<OpenAI> {
  const stored = await prisma.userProviderKey.findUnique({ where: { userId_provider: { userId, provider: 'openai' } } })
  if (!stored) throw new MissingApiKeyError()
  let apiKey: string
  try { apiKey = decryptSecret(stored.encryptedKey) }
  catch { throw new MissingApiKeyError('Your stored OpenAI API key could not be read. Save it again in Settings.') }
  return new OpenAI({ apiKey })
}

let serverClient: OpenAI | null | undefined
export function getServerOpenAIClient(): OpenAI | null {
  if (serverClient === undefined) serverClient = config.openAiServerApiKey ? new OpenAI({ apiKey: config.openAiServerApiKey }) : null
  return serverClient
}

export async function validateOpenAIKey(apiKey: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const client = new OpenAI({ apiKey, maxRetries: 0, timeout: 15_000 })
  try {
    await client.models.list()
    return { ok: true }
  } catch (error) {
    if (error instanceof AuthenticationError) return { ok: false, reason: 'OpenAI rejected this key.' }
    if (error instanceof APIConnectionTimeoutError) return { ok: false, reason: 'OpenAI did not respond in time. Try again.' }
    if (error instanceof APIConnectionError) return { ok: false, reason: 'Could not reach OpenAI to validate the key. Try again.' }
    if (error instanceof APIError && error.status === 403) return { ok: false, reason: 'This key is not permitted to list models. Check its project permissions.' }
    if (error instanceof APIError && error.status === 429) return { ok: false, reason: 'OpenAI rate-limited the validation request or the key has no quota.' }
    if (error instanceof APIError) return { ok: false, reason: `OpenAI returned an error (${error.status ?? 'unknown status'}).` }
    return { ok: false, reason: 'The key could not be validated.' }
  }
}
