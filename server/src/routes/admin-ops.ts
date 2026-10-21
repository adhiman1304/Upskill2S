// Workstream E: admin operations. Mounted in routes/api.ts at '/admin/ops' (paths here are relative).
import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { config } from '../config.js'
import { prisma } from '../database.js'
import type { Prisma } from '../generated/prisma/client.js'
import { jobKindSchema, jobStatusSchema, type JobDto } from '../lib/contracts/index.js'
import { currentUser, isAdmin } from '../lib/permissions.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { jobDto, parseJobProgress } from '../services/jobs/dto.js'
import { getServerOpenAIClient } from '../services/openai/client.js'
import { getOpsSummary } from '../services/ops/metrics.js'
import { findStaleCertifications } from '../services/ops/stale.js'
import { MAX_REFRESH_LIMIT, ServerKeyMissingError, refreshStaleBriefs, startScheduler } from '../services/scheduler/index.js'

// Integrator: move this call into server/src/index.ts next to startJobWorker() (see docs/handoff/E.md).
if (config.schedulerEnabled) startScheduler()

export const adminOpsRouter = Router()

const requireAdmin: RequestHandler = (request, response, next) => {
  if (!isAdmin(request)) { response.status(403).json({ error: 'Administrator access is required.', code: 'FORBIDDEN' }); return }
  next()
}

adminOpsRouter.use(requireAuth, requireAdmin)

const emptyToUndefined = (value: unknown) => (value === '' || value === undefined ? undefined : Array.isArray(value) ? value[0] : value)
const booleanQuery = z.preprocess((value) => {
  const single = emptyToUndefined(value)
  return single === undefined ? undefined : single === 'true' || single === '1'
}, z.boolean().optional())

const jobsQuerySchema = z.object({
  status: z.preprocess(emptyToUndefined, jobStatusSchema.optional()),
  kind: z.preprocess(emptyToUndefined, jobKindSchema.optional()),
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(200).default(50)),
})

const staleQuerySchema = z.object({
  onlyFollowed: booleanQuery,
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(500).default(100)),
})

const refreshBodySchema = z.strictObject({
  limit: z.number().int().min(1).max(MAX_REFRESH_LIMIT).optional(),
  certificationIds: z.array(z.string().trim().min(1).max(64)).min(1).max(MAX_REFRESH_LIMIT).optional(),
  onlyFollowed: z.boolean().optional(),
})

const adminJobInclude = {
  requestedBy: { select: { displayName: true } },
  certification: { select: { id: true, provider: true, code: true, title: true } },
} satisfies Prisma.ResearchJobInclude
type AdminJobRow = Prisma.ResearchJobGetPayload<{ include: typeof adminJobInclude }>

export type AdminJobDto = JobDto & {
  requestedByName: string
  certification: { id: string; provider: string; code: string; title: string } | null
  useServerKey: boolean
  inputTokens: number | null
  outputTokens: number | null
}

function adminJobDto(row: AdminJobRow): AdminJobDto {
  return {
    ...jobDto(row),
    requestedByName: row.requestedBy.displayName,
    certification: row.certification,
    useServerKey: row.useServerKey,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
  }
}

function invalid(response: Parameters<RequestHandler>[1], error: z.ZodError) {
  response.status(400).json({ error: error.issues[0]?.message ?? 'Invalid request.', code: 'INVALID_REQUEST' })
}

adminOpsRouter.get('/summary', async (_request, response) => {
  response.json(await getOpsSummary())
})

adminOpsRouter.get('/jobs', async (request, response) => {
  const parsed = jobsQuerySchema.safeParse(request.query)
  if (!parsed.success) { invalid(response, parsed.error); return }
  const { status, kind, limit } = parsed.data
  const rows = await prisma.researchJob.findMany({
    where: { ...(status ? { status } : {}), ...(kind ? { kind } : {}) },
    include: adminJobInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  })
  response.json(rows.map(adminJobDto))
})

adminOpsRouter.get('/stale', async (request, response) => {
  const parsed = staleQuerySchema.safeParse(request.query)
  if (!parsed.success) { invalid(response, parsed.error); return }
  const items = await findStaleCertifications({ onlyFollowed: parsed.data.onlyFollowed ?? false, limit: parsed.data.limit })
  response.json({ staleAfterDays: config.briefStaleDays, items })
})

adminOpsRouter.post('/refresh-stale', async (request, response) => {
  const parsed = refreshBodySchema.safeParse(request.body ?? {})
  if (!parsed.success) { invalid(response, parsed.error); return }
  if (!getServerOpenAIClient()) {
    response.status(412).json({ error: 'OPENAI_SERVER_API_KEY is not configured on the server, so briefs cannot be refreshed with the company key.', code: 'SERVER_KEY_MISSING' })
    return
  }
  const user = await currentUser(request)
  try {
    const result = await refreshStaleBriefs({ ...parsed.data, requestedById: user.id, trigger: 'admin' })
    response.json(result)
  } catch (error) {
    if (error instanceof ServerKeyMissingError) { response.status(412).json({ error: error.message, code: 'SERVER_KEY_MISSING' }); return }
    throw error
  }
})

adminOpsRouter.post('/jobs/:id/cancel', async (request, response) => {
  const id = typeof request.params.id === 'string' ? request.params.id : ''
  const job = await prisma.researchJob.findUnique({ where: { id }, select: { id: true, status: true, progress: true, intakeSessionId: true } })
  if (!job) { response.status(404).json({ error: 'Job not found.', code: 'NOT_FOUND' }); return }
  if (job.status !== 'QUEUED') {
    const reason = job.status === 'RUNNING' ? 'Running jobs cannot be cancelled yet.' : `The job has already finished (${job.status}).`
    response.status(409).json({ error: reason, code: 'JOB_NOT_CANCELLABLE' })
    return
  }
  const user = await currentUser(request)
  const now = new Date()
  const progress = [...parseJobProgress(job.progress), { at: now.toISOString(), message: `Cancelled by ${user.displayName}.`.slice(0, 500) }]
  // Conditional update: the worker may have claimed the job since we read it.
  const { count } = await prisma.researchJob.updateMany({
    where: { id, status: 'QUEUED' },
    data: { status: 'CANCELLED', error: 'Cancelled by an administrator.', finishedAt: now, progress: JSON.stringify(progress) },
  })
  if (count !== 1) { response.status(409).json({ error: 'The job started before it could be cancelled.', code: 'JOB_NOT_CANCELLABLE' }); return }
  if (job.intakeSessionId) {
    await prisma.intakeSession.updateMany({ where: { id: job.intakeSessionId, status: { in: ['QUEUED', 'RUNNING'] } }, data: { status: 'FAILED', error: 'Cancelled by an administrator.' } })
  }
  const row = await prisma.researchJob.findUniqueOrThrow({ where: { id }, include: adminJobInclude })
  response.json(adminJobDto(row))
})
