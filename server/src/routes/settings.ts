// Owned by S0. BYO OpenAI key management. Mounted in routes/api.ts at '/settings'.
// The decrypted key is never returned or logged; only the last 4 characters (keyHint).
import { Router } from 'express'
import type { UserProviderKey } from '../generated/prisma/client.js'
import { config } from '../config.js'
import { prisma } from '../database.js'
import { encryptSecret } from '../lib/crypto.js'
import { saveOpenAiKeySchema, type OpenAiKeyStatusDto } from '../lib/contracts/index.js'
import { currentUser } from '../lib/permissions.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { validateOpenAIKey } from '../services/openai/client.js'
import { openAiModels } from '../services/openai/models.js'

export const settingsRouter = Router()
settingsRouter.use(requireAuth)

const PROVIDER = 'openai'

function keyStatusDto(stored: UserProviderKey | null): OpenAiKeyStatusDto {
  return {
    configured: Boolean(stored),
    keyHint: stored?.keyHint ?? null,
    lastValidatedAt: stored?.lastValidatedAt?.toISOString() ?? null,
    models: { research: openAiModels.research, fast: openAiModels.fast },
    serverKeyAvailable: Boolean(config.openAiServerApiKey),
  }
}

settingsRouter.get('/openai-key', async (request, response) => {
  const user = await currentUser(request)
  const stored = await prisma.userProviderKey.findUnique({ where: { userId_provider: { userId: user.id, provider: PROVIDER } } })
  response.json(keyStatusDto(stored))
})

settingsRouter.put('/openai-key', async (request, response) => {
  const parsed = saveOpenAiKeySchema.safeParse(request.body)
  if (!parsed.success) {
    response.status(400).json({ error: 'Enter a valid OpenAI API key (it starts with "sk-").', code: 'OPENAI_KEY_INVALID' })
    return
  }
  const { apiKey } = parsed.data
  const validation = await validateOpenAIKey(apiKey)
  if (!validation.ok) {
    response.status(400).json({ error: validation.reason, code: 'OPENAI_KEY_INVALID' })
    return
  }
  const user = await currentUser(request)
  const data = { encryptedKey: encryptSecret(apiKey), keyHint: apiKey.slice(-4), lastValidatedAt: new Date() }
  const stored = await prisma.userProviderKey.upsert({
    where: { userId_provider: { userId: user.id, provider: PROVIDER } },
    create: { userId: user.id, provider: PROVIDER, ...data },
    update: data,
  })
  response.json(keyStatusDto(stored))
})

settingsRouter.delete('/openai-key', async (request, response) => {
  const user = await currentUser(request)
  await prisma.userProviderKey.deleteMany({ where: { userId: user.id, provider: PROVIDER } })
  response.status(204).end()
})
