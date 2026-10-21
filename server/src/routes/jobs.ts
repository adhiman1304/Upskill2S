// Owned by workstream B. Job status for polling clients.
// Mounted in routes/api.ts at the API root, so paths here are FULL paths ('/jobs/:id', '/me/jobs').
import { Router } from 'express'
import { prisma } from '../database.js'
import { currentUser, isAdmin } from '../lib/permissions.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { jobDto } from '../services/jobs/dto.js'

export const jobsRouter = Router()

const routeParam = (value: string | string[] | undefined) => typeof value === 'string' ? value : value?.[0] ?? ''

// GET /jobs/:id -> JobDto. Non-admins may only read jobs they requested; others get 404 so ids do not leak.
jobsRouter.get('/jobs/:id', requireAuth, async (request, response) => {
  const id = routeParam(request.params.id)
  const row = id ? await prisma.researchJob.findUnique({ where: { id } }) : null
  if (!row) {
    response.status(404).json({ error: 'Job not found.' })
    return
  }
  if (!isAdmin(request)) {
    const user = await currentUser(request)
    if (row.requestedById !== user.id) {
      response.status(404).json({ error: 'Job not found.' })
      return
    }
  }
  response.json(jobDto(row))
})

// GET /me/jobs -> the user's 20 most recent jobs
jobsRouter.get('/me/jobs', requireAuth, async (request, response) => {
  const user = await currentUser(request)
  const rows = await prisma.researchJob.findMany({ where: { requestedById: user.id }, orderBy: { createdAt: 'desc' }, take: 20 })
  response.json(rows.map(jobDto))
})
