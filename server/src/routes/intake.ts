// STUB owned by workstream C. S0 placeholder; replace the catch-all with real routes.
// Mounted in routes/api.ts at the API root, so define FULL paths here ('/intake', '/intake/:id', '/intake/:id/select', '/me/intake').
import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'

export const intakeRouter = Router()

const paths = ['/intake{/*splat}', '/me/intake{/*splat}']

intakeRouter.all(paths, requireAuth, (_request, response) => {
  response.status(501).json({ error: 'Not implemented yet.', code: 'NOT_IMPLEMENTED' })
})
