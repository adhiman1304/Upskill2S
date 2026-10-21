// STUB owned by workstream E. S0 placeholder; replace the catch-all with real routes.
// Mounted in routes/api.ts at '/admin/ops' (paths here are relative: '/summary', '/jobs', '/refresh-stale'). Use isAdmin() on every route.
import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'

export const adminOpsRouter = Router()

adminOpsRouter.use(requireAuth)
adminOpsRouter.all('{/*splat}', (_request, response) => {
  response.status(501).json({ error: 'Not implemented yet.', code: 'NOT_IMPLEMENTED' })
})
