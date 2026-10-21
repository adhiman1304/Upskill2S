// Workstream M: the user's certifications grouped by status (Studying / Planning / Passed).
// Mounted in routes/api.ts at the API root, so paths here are FULL paths. Every route applies requireAuth itself.
import { Router, type Response } from 'express'
import { prisma } from '../database.js'
import { myCertificationBulkSchema, myCertificationUpdateSchema, type ApiErrorBody } from '../lib/contracts/index.js'
import { currentUser } from '../lib/permissions.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { listMyCertifications, MyCertificationInputError, saveMyCertifications, setMyCertification } from '../services/my-certifications/index.js'

export const myCertificationsRouter = Router()

const routeParam = (value: string | string[] | undefined) => typeof value === 'string' ? value : value?.[0] ?? ''

function sendError(response: Response, status: number, body: ApiErrorBody) {
  response.status(status).json(body)
}

// GET /me/certifications -> { studying, planning, passed }
myCertificationsRouter.get('/me/certifications', requireAuth, async (request, response) => {
  const user = await currentUser(request)
  response.json(await listMyCertifications(user.id))
})

// POST /me/certifications/bulk { items: [{ provider, code, title, officialUrl?, status }] } -> grouped
myCertificationsRouter.post('/me/certifications/bulk', requireAuth, async (request, response) => {
  const parsed = myCertificationBulkSchema.safeParse(request.body)
  if (!parsed.success) {
    sendError(response, 400, { error: 'Send { items: [{ provider, code, title, officialUrl?, status }] } with 1 to 25 items.', code: 'INVALID_REQUEST' })
    return
  }
  const user = await currentUser(request)
  try {
    await saveMyCertifications(user.id, parsed.data.items)
  } catch (error) {
    if (error instanceof MyCertificationInputError) { sendError(response, 400, { error: error.message, code: 'INVALID_REQUEST' }); return }
    throw error
  }
  response.json(await listMyCertifications(user.id))
})

// PUT /me/certifications/:certificationId { status, targetDate? } -> grouped
myCertificationsRouter.put('/me/certifications/:certificationId', requireAuth, async (request, response) => {
  const parsed = myCertificationUpdateSchema.safeParse(request.body)
  if (!parsed.success) {
    sendError(response, 400, { error: 'Send { status: PLANNING | STUDYING | PASSED, targetDate?: YYYY-MM-DD | null }.', code: 'INVALID_REQUEST' })
    return
  }
  const certificationId = routeParam(request.params.certificationId)
  const certification = certificationId ? await prisma.certification.findUnique({ where: { id: certificationId }, select: { id: true } }) : null
  if (!certification) { sendError(response, 404, { error: 'Certification not found.', code: 'NOT_FOUND' }); return }
  const user = await currentUser(request)
  await setMyCertification(user.id, certification.id, parsed.data.status, parsed.data.targetDate)
  response.json(await listMyCertifications(user.id))
})

// DELETE /me/certifications/:certificationId -> grouped (removing a row that does not exist is not an error)
myCertificationsRouter.delete('/me/certifications/:certificationId', requireAuth, async (request, response) => {
  const user = await currentUser(request)
  await prisma.userCertification.deleteMany({ where: { userId: user.id, certificationId: routeParam(request.params.certificationId) } })
  response.json(await listMyCertifications(user.id))
})
