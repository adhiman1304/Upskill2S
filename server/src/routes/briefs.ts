// Owned by workstream B. Study brief read, refresh, versions, checklist progress, feedback and follow.
// Mounted in routes/api.ts at the API root (before the legacy routes), so every path here is a FULL path
// and only these specific subpaths are matched; legacy '/certifications' routes are not shadowed.
import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import type { StudyBrief, UserCertification } from '../generated/prisma/client.js'
import { config } from '../config.js'
import { prisma } from '../database.js'
import {
  feedbackItemTypeSchema,
  feedbackReportReasonSchema,
  followStatusSchema,
  slugIdSchema,
  studyBriefContentSchema,
  type ApiErrorBody,
  type BriefVersionSummary,
  type BriefPageDto,
  type FeedbackItemType,
  type FeedbackSummary,
  type FeedbackVerdict,
  type StudyBriefContent,
  type StudyBriefDto,
} from '../lib/contracts/index.js'
import { currentUser } from '../lib/permissions.js'
import { consume } from '../lib/rate-limit.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { enqueueJob, findActiveJob } from '../services/jobs/queue.js'

export const briefsRouter = Router()

const routeParam = (value: string | string[] | undefined) => typeof value === 'string' ? value : value?.[0] ?? ''
const DAY_MS = 24 * 60 * 60 * 1000
const REFRESH_LIMIT = 3
const REFRESH_WINDOW_MS = 60 * 60 * 1000

type Following = BriefPageDto['following']

function sendError(response: Response, status: number, body: ApiErrorBody) {
  response.status(status).json(body)
}

/** Parses stored brief JSON against the contract; returns null (and logs) if the stored row is unreadable. */
function parseBriefContent(brief: StudyBrief): StudyBriefContent | null {
  try {
    const parsed = studyBriefContentSchema.safeParse(JSON.parse(brief.content))
    if (parsed.success) return parsed.data
    console.error(`Study brief ${brief.id} does not match the StudyBriefContent contract:`, parsed.error.issues.slice(0, 5))
  } catch (error) {
    console.error(`Study brief ${brief.id} has invalid JSON content:`, error)
  }
  return null
}

function studyBriefDto(brief: StudyBrief): StudyBriefDto | null {
  const content = parseBriefContent(brief)
  if (!content) return null
  return {
    id: brief.id,
    certificationId: brief.certificationId,
    version: brief.version,
    status: brief.status === 'SUPERSEDED' ? 'SUPERSEDED' : 'CURRENT',
    model: brief.model,
    sourceCount: brief.sourceCount,
    generatedAt: brief.generatedAt.toISOString(),
    content,
  }
}

function freshness(brief: StudyBrief | null): BriefPageDto['freshness'] {
  const staleAfterDays = config.briefStaleDays
  if (!brief) return { status: 'missing', generatedAt: null, staleAfterDays, ageDays: null }
  const ageMs = Math.max(0, Date.now() - brief.generatedAt.getTime())
  return {
    status: ageMs <= staleAfterDays * DAY_MS ? 'fresh' : 'stale',
    generatedAt: brief.generatedAt.toISOString(),
    staleAfterDays,
    ageDays: Math.floor(ageMs / DAY_MS),
  }
}

function followingDto(row: UserCertification | null): Following {
  if (!row) return null
  return {
    status: followStatusSchema.catch('STUDYING').parse(row.status),
    targetDate: row.targetDate ? row.targetDate.toISOString().slice(0, 10) : null,
  }
}

async function findCertification(response: Response, id: string) {
  const certification = id ? await prisma.certification.findUnique({ where: { id } }) : null
  if (!certification) sendError(response, 404, { error: 'Certification not found.' })
  return certification
}

function findCurrentBrief(certificationId: string) {
  return prisma.studyBrief.findFirst({ where: { certificationId, status: 'CURRENT' }, orderBy: { version: 'desc' } })
}

async function completedItemIds(userId: string, certificationId: string) {
  const rows = await prisma.checklistProgress.findMany({ where: { userId, certificationId }, select: { itemId: true }, orderBy: { completedAt: 'asc' } })
  return rows.map((row) => row.itemId)
}

const emptySummary = (): FeedbackSummary => ({ stars: 0, reports: 0, mine: null })

/** Maps stored verdicts to star / report. Legacy rows: 'accurate' counts as a star, 'inaccurate' and 'outdated' as reports. */
function normalizeVerdict(value: string): FeedbackVerdict | null {
  if (value === 'star' || value === 'accurate') return 'star'
  if (value === 'report' || value === 'inaccurate' || value === 'outdated') return 'report'
  return null
}

/** Counts per `${itemType}:${itemId}` for one brief, plus the current user's own verdict. */
async function feedbackSummaries(briefId: string, userId: string, only?: { itemType: string; itemId: string }) {
  const where = { briefId, ...(only ?? {}) }
  const [groups, mine] = await Promise.all([
    prisma.briefFeedback.groupBy({ by: ['itemType', 'itemId', 'verdict'], where, _count: { _all: true } }),
    prisma.briefFeedback.findMany({ where: { ...where, userId }, select: { itemType: true, itemId: true, verdict: true } }),
  ])
  const summaries: Record<string, FeedbackSummary> = {}
  for (const group of groups) {
    const verdict = normalizeVerdict(group.verdict)
    if (!verdict) continue
    const summary = summaries[`${group.itemType}:${group.itemId}`] ??= emptySummary()
    if (verdict === 'star') summary.stars += group._count._all
    else summary.reports += group._count._all
  }
  for (const row of mine) {
    const verdict = normalizeVerdict(row.verdict)
    if (!verdict) continue
    ;(summaries[`${row.itemType}:${row.itemId}`] ??= emptySummary()).mine = verdict
  }
  return summaries
}

function itemExists(content: StudyBriefContent, itemType: FeedbackItemType, itemId: string) {
  switch (itemType) {
    case 'brief': return itemId === 'brief'
    case 'checklist': return content.checklist.some((item) => item.id === itemId)
    case 'gap': return content.knownGaps.some((item) => item.id === itemId)
    case 'resource': return content.communityResources.some((item) => item.id === itemId)
    case 'skill': return content.skillsMeasured.some((item) => item.id === itemId)
    case 'learning_path': return content.officialLearningPath.some((item) => item.id === itemId)
  }
}

// GET /certifications/:id/brief -> BriefPageDto
briefsRouter.get('/certifications/:id/brief', requireAuth, async (request, response) => {
  const certification = await findCertification(response, routeParam(request.params.id))
  if (!certification) return
  const user = await currentUser(request)
  const currentRow = await findCurrentBrief(certification.id)
  const brief = currentRow ? studyBriefDto(currentRow) : null
  const [activeJob, completed, feedback, followRow] = await Promise.all([
    findActiveJob({ certificationId: certification.id }),
    completedItemIds(user.id, certification.id),
    brief ? feedbackSummaries(brief.id, user.id) : Promise.resolve({}),
    prisma.userCertification.findUnique({ where: { userId_certificationId: { userId: user.id, certificationId: certification.id } } }),
  ])
  const body: BriefPageDto = {
    certification: { id: certification.id, provider: certification.provider, code: certification.code, title: certification.title, officialUrl: certification.officialUrl, status: certification.status },
    brief,
    freshness: freshness(brief ? currentRow : null),
    activeJob,
    progress: { completedItemIds: completed },
    feedback,
    following: followingDto(followRow),
  }
  response.json(body)
})

// POST /certifications/:id/brief/refresh -> 202 JobDto
briefsRouter.post('/certifications/:id/brief/refresh', requireAuth, async (request, response) => {
  const certification = await findCertification(response, routeParam(request.params.id))
  if (!certification) return
  const user = await currentUser(request)
  const key = await prisma.userProviderKey.findUnique({ where: { userId_provider: { userId: user.id, provider: 'openai' } }, select: { id: true } })
  if (!key) {
    sendError(response, 412, { error: 'Add your OpenAI API key in Settings to generate a study brief.', code: 'OPENAI_KEY_MISSING' })
    return
  }
  const active = await findActiveJob({ certificationId: certification.id })
  if (active) {
    response.status(409).json({ error: 'Research for this certification is already running.', code: 'JOB_ALREADY_RUNNING', job: active })
    return
  }
  const limit = consume(`brief-refresh:${user.id}:${certification.id}`, REFRESH_LIMIT, REFRESH_WINDOW_MS)
  if (!limit.ok) {
    const minutes = Math.ceil(limit.retryAfterSeconds / 60)
    response.setHeader('Retry-After', String(limit.retryAfterSeconds))
    response.status(429).json({ error: `You can refresh this brief ${REFRESH_LIMIT} times per hour. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`, code: 'RATE_LIMITED', retryAfterSeconds: limit.retryAfterSeconds })
    return
  }
  const existing = await prisma.studyBrief.count({ where: { certificationId: certification.id } })
  const job = await enqueueJob({ kind: existing ? 'REFRESH' : 'BRIEF', requestedById: user.id, certificationId: certification.id })
  response.status(202).json(job)
})

// GET /certifications/:id/brief/versions -> newest first
briefsRouter.get('/certifications/:id/brief/versions', requireAuth, async (request, response) => {
  const certification = await findCertification(response, routeParam(request.params.id))
  if (!certification) return
  const rows = await prisma.studyBrief.findMany({
    where: { certificationId: certification.id },
    orderBy: { version: 'desc' },
    select: { id: true, version: true, status: true, model: true, sourceCount: true, generatedAt: true },
  })
  response.json(rows.map((row): BriefVersionSummary => ({ id: row.id, version: row.version, status: row.status === 'SUPERSEDED' ? 'SUPERSEDED' : 'CURRENT', model: row.model, sourceCount: row.sourceCount, generatedAt: row.generatedAt.toISOString() })))
})

// GET /certifications/:id/brief/versions/:briefId -> StudyBriefDto
briefsRouter.get('/certifications/:id/brief/versions/:briefId', requireAuth, async (request, response) => {
  const certificationId = routeParam(request.params.id)
  const briefId = routeParam(request.params.briefId)
  const row = briefId ? await prisma.studyBrief.findUnique({ where: { id: briefId } }) : null
  if (!row || row.certificationId !== certificationId) {
    sendError(response, 404, { error: 'Study brief version not found.' })
    return
  }
  const dto = studyBriefDto(row)
  if (!dto) {
    sendError(response, 500, { error: 'This study brief version could not be read.' })
    return
  }
  response.json(dto)
})

const progressSchema = z.object({ completed: z.boolean() })

// PUT /certifications/:id/brief/progress/:itemId -> { completedItemIds }
briefsRouter.put('/certifications/:id/brief/progress/:itemId', requireAuth, async (request, response) => {
  const parsed = progressSchema.safeParse(request.body)
  const itemId = slugIdSchema.safeParse(routeParam(request.params.itemId))
  if (!parsed.success || !itemId.success) {
    sendError(response, 400, { error: 'Send { completed: boolean } for a valid checklist item id.' })
    return
  }
  const certification = await findCertification(response, routeParam(request.params.id))
  if (!certification) return
  const user = await currentUser(request)
  const brief = await findCurrentBrief(certification.id)
  if (!brief) {
    sendError(response, 404, { error: 'This certification has no study brief yet.' })
    return
  }
  if (parsed.data.completed) {
    const content = parseBriefContent(brief)
    if (!content?.checklist.some((item) => item.id === itemId.data)) {
      sendError(response, 404, { error: 'Checklist item not found in the current study brief.' })
      return
    }
    await prisma.checklistProgress.upsert({
      where: { userId_certificationId_itemId: { userId: user.id, certificationId: certification.id, itemId: itemId.data } },
      create: { userId: user.id, certificationId: certification.id, briefId: brief.id, itemId: itemId.data },
      update: { briefId: brief.id },
    })
  } else {
    await prisma.checklistProgress.deleteMany({ where: { userId: user.id, certificationId: certification.id, itemId: itemId.data } })
  }
  response.json({ completedItemIds: await completedItemIds(user.id, certification.id) })
})

const feedbackTargetSchema = z.object({
  itemType: feedbackItemTypeSchema,
  itemId: z.string().trim().min(1).max(120),
})
const feedbackSchema = z.discriminatedUnion('verdict', [
  feedbackTargetSchema.extend({ verdict: z.literal('star') }),
  feedbackTargetSchema.extend({
    verdict: z.literal('report'),
    reason: feedbackReportReasonSchema,
    comment: z.string().trim().min(3).max(500),
  }),
])

// POST /briefs/:briefId/feedback -> { key, summary }
// star: toggles the user's star (posting it again removes it). report: needs a reason and a 3 to 500 character comment;
// the reason is stored as a "[reason] " prefix of the comment (the table has no reason column).
// One row per user and item, so a report replaces the user's star and a star replaces their report.
briefsRouter.post('/briefs/:briefId/feedback', requireAuth, async (request, response) => {
  const parsed = feedbackSchema.safeParse(request.body)
  if (!parsed.success) {
    sendError(response, 400, { error: 'Send { itemType, itemId, verdict: "star" }, or { itemType, itemId, verdict: "report", reason: wrong | outdated | broken_link | other, comment (3 to 500 characters) }.' })
    return
  }
  const briefId = routeParam(request.params.briefId)
  const brief = briefId ? await prisma.studyBrief.findUnique({ where: { id: briefId } }) : null
  const content = brief ? parseBriefContent(brief) : null
  if (!brief || !content) {
    sendError(response, 404, { error: 'Study brief not found.' })
    return
  }
  const { itemType, itemId } = parsed.data
  if (!itemExists(content, itemType, itemId)) {
    sendError(response, 404, { error: 'That item is not part of this study brief.' })
    return
  }
  const user = await currentUser(request)
  const where = { userId_briefId_itemType_itemId: { userId: user.id, briefId: brief.id, itemType, itemId } }
  if (parsed.data.verdict === 'star') {
    const existing = await prisma.briefFeedback.findUnique({ where, select: { verdict: true } })
    if (existing && normalizeVerdict(existing.verdict) === 'star') await prisma.briefFeedback.delete({ where })
    else await prisma.briefFeedback.upsert({ where, create: { userId: user.id, briefId: brief.id, itemType, itemId, verdict: 'star', comment: '' }, update: { verdict: 'star', comment: '' } })
  } else {
    const data = { verdict: 'report', comment: `[${parsed.data.reason}] ${parsed.data.comment}` }
    await prisma.briefFeedback.upsert({ where, create: { userId: user.id, briefId: brief.id, itemType, itemId, ...data }, update: data })
  }
  const key = `${itemType}:${itemId}`
  const summaries = await feedbackSummaries(brief.id, user.id, { itemType, itemId })
  response.json({ key, summary: summaries[key] ?? emptySummary() })
})

const followSchema = z.object({
  status: followStatusSchema,
  targetDate: z.iso.date().nullable().optional(),
})

// PUT /certifications/:id/follow -> following
briefsRouter.put('/certifications/:id/follow', requireAuth, async (request, response) => {
  const parsed = followSchema.safeParse(request.body)
  if (!parsed.success) {
    sendError(response, 400, { error: 'Send { status: PLANNING | STUDYING | PASSED, targetDate?: YYYY-MM-DD | null }.' })
    return
  }
  const certification = await findCertification(response, routeParam(request.params.id))
  if (!certification) return
  const user = await currentUser(request)
  const targetDate = parsed.data.targetDate ? new Date(`${parsed.data.targetDate}T00:00:00.000Z`) : null
  const row = await prisma.userCertification.upsert({
    where: { userId_certificationId: { userId: user.id, certificationId: certification.id } },
    create: { userId: user.id, certificationId: certification.id, status: parsed.data.status, targetDate },
    update: { status: parsed.data.status, targetDate },
  })
  response.json(followingDto(row))
})

// DELETE /certifications/:id/follow -> null
briefsRouter.delete('/certifications/:id/follow', requireAuth, async (request, response) => {
  const certification = await findCertification(response, routeParam(request.params.id))
  if (!certification) return
  const user = await currentUser(request)
  await prisma.userCertification.deleteMany({ where: { userId: user.id, certificationId: certification.id } })
  response.json(followingDto(null))
})

/** Fallback for unknown methods/subpaths under the brief prefix, so they do not fall through to legacy routes. */
function notFound(_request: Request, response: Response) {
  sendError(response, 404, { error: 'Not found.' })
}
briefsRouter.all(['/certifications/:id/brief{/*splat}', '/certifications/:id/follow', '/briefs/:briefId/feedback'], requireAuth, notFound)
