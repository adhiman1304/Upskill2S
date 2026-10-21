// Owned by workstream D. Mounted in routes/api.ts at '/catalog' (paths here are relative).
import { Router } from 'express'
import { z } from 'zod'
import { resolveCertificationInputSchema } from '../lib/contracts/index.js'
import { currentUser } from '../lib/permissions.js'
import { certificationSchema } from '../lib/validation.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { findOrCreateCertification, searchCatalog } from '../services/catalog/index.js'

export const catalogRouter = Router()
catalogRouter.use(requireAuth)

const searchQuerySchema = z.object({ q: z.string().trim().max(100).default('') })

// Mirrors the provider/code/title rules of the legacy certificationSchema so resolved rows stay editable there,
// and only accepts HTTPS official links.
const resolveBodySchema = resolveCertificationInputSchema.extend({
  provider: certificationSchema.shape.provider,
  code: certificationSchema.shape.code,
  title: certificationSchema.shape.title,
  officialUrl: resolveCertificationInputSchema.shape.officialUrl.refine(
    (value) => !value || /^https:\/\/[^\s]+$/i.test(value),
    'Official links must use HTTPS.',
  ),
})

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
  const parsed = resolveBodySchema.safeParse(request.body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const error = issue?.path[0] === 'code' && issue.code === 'invalid_format'
      ? 'Exam codes may only contain letters, numbers, dots, dashes and underscores.'
      : issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'Invalid certification.'
    response.status(400).json({ error })
    return
  }
  const user = await currentUser(request)
  const { id, created } = await findOrCreateCertification(parsed.data, user.id)
  response.status(created ? 201 : 200).json({ id })
})
