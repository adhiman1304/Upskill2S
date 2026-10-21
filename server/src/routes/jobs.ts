// STUB owned by workstream B. S0 placeholder; replace the catch-all with real routes.
// Mounted in routes/api.ts at the API root, so define FULL paths here ('/jobs/:id', '/me/jobs').
import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'

export const jobsRouter = Router()

const paths = ['/jobs{/*splat}', '/me/jobs{/*splat}']

jobsRouter.all(paths, requireAuth, (_request, response) => {
  response.status(501).json({ error: 'Not implemented yet.', code: 'NOT_IMPLEMENTED' })
})
