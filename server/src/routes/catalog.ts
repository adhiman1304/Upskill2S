// STUB owned by workstream D. S0 placeholder; replace the catch-all with real routes.
// Mounted in routes/api.ts at '/catalog' (paths here are relative: '/search', '/resolve').
import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'

export const catalogRouter = Router()

catalogRouter.use(requireAuth)
catalogRouter.all('{/*splat}', (_request, response) => {
  response.status(501).json({ error: 'Not implemented yet.', code: 'NOT_IMPLEMENTED' })
})
