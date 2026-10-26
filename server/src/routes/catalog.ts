// Owned by workstream D. Mounted in routes/api.ts at '/catalog' (paths here are relative).
import { Router } from 'express'
import { z } from 'zod'
import { currentUser } from '../lib/permissions.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { findOrCreateCertification, parseResolveInput, searchCatalog } from '../services/catalog/index.js'
import { IdentifyError, identifyCertification } from '../services/catalog/identify.js'
import { getOpenAIClientForUser, MissingApiKeyError } from '../services/openai/client.js'
import { identifyRequestSchema } from '../lib/contracts/index.js'
import { consume } from '../lib/rate-limit.js'
import type OpenAI from 'openai'

export const catalogRouter = Router()
catalogRouter.use(requireAuth)

const searchQuerySchema = z.object({ q: z.string().trim().max(100).default('') })

catalogRouter.get('/search', async (request, response) => {
  const parsed = searchQuerySchema.safeParse(request.query)
  if (!parsed.success) {
    response.status(400).json({ error: 'Search text must be at most 100 characters.' })
    return
  }
  const user = await currentUser(request)
  response.json(await searchCatalog(parsed.data.q, user.id))
})

catalogRouter.post('/resolve', async (request, response) => {
  const parsed = parseResolveInput(request.body)
  if (!parsed.ok) {
    response.status(400).json({ error: parsed.error, code: 'INVALID_REQUEST' })
    return
  }
  const user = await currentUser(request)
  const { id, created } = await findOrCreateCertification(parsed.data, user.id)
  response.status(created ? 201 : 200).json({ id })
})

const IDENTIFY_LIMIT = 10
const IDENTIFY_WINDOW_MS = 60 * 60 * 1000

// POST /api/catalog/identify {query} -> IdentifyResult. Uses the caller's OpenAI key (web search), 10 per user per hour.
catalogRouter.post('/identify', async (request, response) => {
  const parsed = identifyRequestSchema.safeParse(request.body)
  if (!parsed.success) {
    response.status(400).json({ error: 'Describe the certification in 3 to 200 characters.', code: 'INVALID_REQUEST' })
    return
  }
  const user = await currentUser(request)
  let client: OpenAI
  try {
    client = await getOpenAIClientForUser(user.id)
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      response.status(412).json({ error: 'Add your OpenAI API key in Settings to let the agent identify certifications.', code: 'OPENAI_KEY_MISSING' })
      return
    }
    throw error
  }
  const limit = consume(`catalog-identify:${user.id}`, IDENTIFY_LIMIT, IDENTIFY_WINDOW_MS)
  if (!limit.ok) {
    const minutes = Math.ceil(limit.retryAfterSeconds / 60)
    response.setHeader('Retry-After', String(limit.retryAfterSeconds))
    response.status(429).json({ error: `You can ask the agent to identify ${IDENTIFY_LIMIT} certifications per hour. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`, code: 'RATE_LIMITED', retryAfterSeconds: limit.retryAfterSeconds })
    return
  }

  // Stop the OpenAI calls if the client goes away before we answer.
  const disconnect = new AbortController()
  response.on('close', () => { if (!response.writableEnded) disconnect.abort() })
  try {
    response.json(await identifyCertification({ client, query: parsed.data.query, signal: disconnect.signal }))
  } catch (error) {
    if (disconnect.signal.aborted) return
    if (error instanceof IdentifyError) {
      response.status(error.status).json(error.code ? { error: error.message, code: error.code } : { error: error.message })
      return
    }
    console.error('Certification identify failed.', error)
    response.status(502).json({ error: 'The agent could not identify this certification. Try again later.' })
  }
})
