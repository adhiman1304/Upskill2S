// STUB owned by workstream B. S0 placeholder; replace the catch-all with real routes.
// Mounted in routes/api.ts at the API root, before the legacy routes, so define FULL paths here
// ('/certifications/:id/brief...', '/certifications/:id/follow', '/briefs/:briefId/feedback').
// Only match these specific subpaths so legacy '/certifications' routes are not shadowed.
import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'

export const briefsRouter = Router()

const paths = ['/certifications/:id/brief{/*splat}', '/certifications/:id/follow', '/briefs/:briefId/feedback']

briefsRouter.all(paths, requireAuth, (_request, response) => {
  response.status(501).json({ error: 'Not implemented yet.', code: 'NOT_IMPLEMENTED' })
})
