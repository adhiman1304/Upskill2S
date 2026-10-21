// Owned by workstream D. Mounted in routes/api.ts at '/catalog' (paths here are relative).
import { Router } from 'express'
import { z } from 'zod'
import { currentUser } from '../lib/permissions.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { findOrCreateCertification, parseResolveInput, searchCatalog } from '../services/catalog/index.js'

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
