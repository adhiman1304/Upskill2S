import { randomUUID } from 'node:crypto'
import { mkdir, unlink } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { Router } from 'express'
import multer from 'multer'
import { Prisma } from '../generated/prisma/client.js'
import type { Certification as CertificationModel, Resource as ResourceModel, User } from '../generated/prisma/client.js'
import { prisma } from '../database.js'
import { config } from '../config.js'
import { currentIdentity, currentUser, canManageCertification, canManageResource, isAdmin } from '../lib/permissions.js'
import { certificationSchema, communityCommentSchema, communityPostSchema, normalizeKey, resourceMetadataSchema, resourceReportSchema, resourceSchema, validateResourceContent } from '../lib/validation.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadBytes, files: 1 } })
const resourceTypes = ['QUESTION_SET', 'RICH_TEXT', 'LINK', 'PDF'] as const
const routeParam = (value: string | string[] | undefined) => typeof value === 'string' ? value : value?.[0] ?? ''
type ResourceWithDetails = ResourceModel & { createdBy: User; bookmarks?: { id: string }[]; helpfulVotes?: { id: string }[]; _count?: { helpfulVotes: number } }
const communityPostInclude = {
  author: { select: { id: true, displayName: true } },
  comments: { take: 20, orderBy: { createdAt: 'desc' as const }, include: { author: { select: { id: true, displayName: true } } } },
  _count: { select: { comments: true } },
} satisfies Prisma.CommunityPostInclude

function resourceInclude(userId: string) {
  return {
    createdBy: true,
    bookmarks: { where: { userId }, select: { id: true } },
    helpfulVotes: { where: { userId }, select: { id: true } },
    _count: { select: { helpfulVotes: true } },
  }
}

function parseTopics(value: string) {
  try { const topics = JSON.parse(value); return Array.isArray(topics) ? topics.filter((topic): topic is string => typeof topic === 'string') : [] }
  catch { return [] }
}

function certificationData(input: ReturnType<typeof certificationSchema.parse>) {
  return {
    ...input,
    examVersion: input.examVersion || null,
    examUpdatedAt: input.examUpdatedAt ? new Date(input.examUpdatedAt) : null,
  }
}

function resourceMetadataData(metadata: ReturnType<typeof resourceMetadataSchema.parse>) {
  return {
    topics: JSON.stringify([...new Set(metadata.topics.map(normalizeKey))]),
    language: normalizeKey(metadata.language),
    estimatedMinutes: metadata.estimatedMinutes ?? null,
    sourceName: metadata.sourceName || null,
    sourceUrl: metadata.sourceUrl || null,
    rightsConfirmed: metadata.rightsConfirmed,
  }
}

router.use(requireAuth)

function resourceDto(resource: ResourceWithDetails) {
  return {
    id: resource.id, type: resource.type, title: resource.title, content: resource.content,
    topics: parseTopics(resource.topics), language: resource.language, estimatedMinutes: resource.estimatedMinutes,
    sourceName: resource.sourceName, sourceUrl: resource.sourceUrl, rightsConfirmed: resource.rightsConfirmed,
    originalFileName: resource.originalFileName, fileSize: resource.fileSize, isReviewed: Boolean(resource.reviewedAt), reviewedAt: resource.reviewedAt?.toISOString() ?? null, isVisible: resource.isVisible,
    isBookmarked: Boolean(resource.bookmarks?.length), isHelpful: Boolean(resource.helpfulVotes?.length),
    helpfulCount: resource._count?.helpfulVotes ?? 0,
    createdById: resource.createdBy.objectId, createdByName: resource.createdBy.displayName,
    createdAt: resource.createdAt.toISOString(),
  }
}

function certificationDto(certification: CertificationModel & { createdBy: User; _count: { resources: number }; resources?: { topics: string[] | string; isVisible?: boolean }[] }) {
  const topics = new Set<string>()
  for (const resource of certification.resources ?? []) if (resource.isVisible !== false) for (const topic of Array.isArray(resource.topics) ? resource.topics : parseTopics(resource.topics)) topics.add(topic)
  return {
    id: certification.id, provider: certification.provider, code: certification.code, title: certification.title,
    description: certification.description, status: certification.status, examVersion: certification.examVersion,
    examUpdatedAt: certification.examUpdatedAt?.toISOString() ?? null, topics: [...topics].sort(),
    createdById: certification.createdBy.objectId, createdByName: certification.createdBy.displayName,
    resourceCount: certification._count.resources, resources: [], updatedAt: certification.updatedAt.toISOString(),
  }
}

function communityPostDto(post: Prisma.CommunityPostGetPayload<{ include: typeof communityPostInclude }>) {
  return {
    id: post.id, kind: post.kind, title: post.title, body: post.body,
    authorId: post.author.id, authorName: post.author.displayName, createdAt: post.createdAt.toISOString(),
    commentCount: post._count.comments,
    comments: [...post.comments].reverse().map((comment) => ({
      id: comment.id, body: comment.body, authorId: comment.author.id,
      authorName: comment.author.displayName, createdAt: comment.createdAt.toISOString(),
    })),
  }
}

router.get('/me', async (request, response) => {
  const user = await currentUser(request)
  response.json({ userId: user.objectId, displayName: user.displayName, isAdmin: isAdmin(request), isLocalDevelopment: currentIdentity(request).tenantId === 'local-development' })
})

router.get('/me/contributions', async (request, response) => {
  const user = await currentUser(request)
  const [certificationCount, resourceCount, postCount, commentCount, helpfulReceived, certifications, resources, posts, comments] = await Promise.all([
    prisma.certification.count({ where: { createdById: user.id } }),
    prisma.resource.count({ where: { createdById: user.id, isVisible: true } }),
    prisma.communityPost.count({ where: { authorId: user.id } }),
    prisma.communityComment.count({ where: { authorId: user.id } }),
    prisma.resourceHelpfulVote.count({ where: { resource: { createdById: user.id, isVisible: true } } }),
    prisma.certification.findMany({ where: { createdById: user.id }, select: { id: true, provider: true, code: true, title: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.resource.findMany({ where: { createdById: user.id, isVisible: true }, select: { id: true, title: true, createdAt: true, certification: { select: { provider: true, code: true } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.communityPost.findMany({ where: { authorId: user.id }, select: { id: true, kind: true, title: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.communityComment.findMany({ where: { authorId: user.id }, select: { id: true, body: true, createdAt: true, post: { select: { title: true } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ])
  const activity = [
    ...certifications.map((item) => ({ id: `certification-${item.id}`, kind: 'certification', title: item.title, detail: `${item.provider} · ${item.code}`, createdAt: item.createdAt.toISOString() })),
    ...resources.map((item) => ({ id: `resource-${item.id}`, kind: 'resource', title: item.title, detail: `${item.certification.provider} · ${item.certification.code}`, createdAt: item.createdAt.toISOString() })),
    ...posts.map((item) => ({ id: `post-${item.id}`, kind: item.kind.toLowerCase(), title: item.title, detail: item.kind === 'IDEA' ? 'Idea posted' : 'Question posted', createdAt: item.createdAt.toISOString() })),
    ...comments.map((item) => ({ id: `comment-${item.id}`, kind: 'comment', title: item.body.slice(0, 120), detail: `Comment on ${item.post.title}`, createdAt: item.createdAt.toISOString() })),
  ].sort((first, second) => second.createdAt.localeCompare(first.createdAt)).slice(0, 30)
  const badges = []
  if (certificationCount + resourceCount > 0) badges.push({ id: 'knowledge-sharer', label: 'Knowledge sharer', detail: 'Added to the certification library.' })
  if (postCount + commentCount >= 5) badges.push({ id: 'community-voice', label: 'Community voice', detail: 'Joined five community discussions.' })
  if (helpfulReceived >= 3) badges.push({ id: 'helpful-contributor', label: 'Helpful contributor', detail: 'Resources received at least three helpful votes.' })
  response.json({ counts: { certifications: certificationCount, resources: resourceCount, ideas: await prisma.communityPost.count({ where: { authorId: user.id, kind: 'IDEA' } }), questions: await prisma.communityPost.count({ where: { authorId: user.id, kind: 'QUESTION' } }), comments: commentCount, helpfulReceived }, badges, activity })
})

router.get('/community/posts', async (_request, response) => {
  const posts = await prisma.communityPost.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: communityPostInclude })
  response.json(posts.map(communityPostDto))
})

router.post('/community/posts', async (request, response) => {
  const parsed = communityPostSchema.safeParse(request.body)
  if (!parsed.success) { response.status(400).json({ error: 'Choose an idea or question and check the title and details.' }); return }
  const user = await currentUser(request)
  const post = await prisma.communityPost.create({ data: { ...parsed.data, authorId: user.id }, include: communityPostInclude })
  response.status(201).json(communityPostDto(post))
})

router.post('/community/posts/:id/comments', async (request, response) => {
  const parsed = communityCommentSchema.safeParse(request.body)
  if (!parsed.success) { response.status(400).json({ error: 'Write a comment of up to 2,000 characters.' }); return }
  const postId = routeParam(request.params.id)
  const postExists = await prisma.communityPost.findUnique({ where: { id: postId }, select: { id: true } })
  if (!postExists) { response.status(404).json({ error: 'Discussion not found.' }); return }
  const user = await currentUser(request)
  const comment = await prisma.communityComment.create({ data: { ...parsed.data, postId, authorId: user.id }, include: { author: { select: { id: true, displayName: true } } } })
  response.status(201).json({ id: comment.id, body: comment.body, authorId: comment.author.id, authorName: comment.author.displayName, createdAt: comment.createdAt.toISOString() })
})

router.get('/certifications', async (request, response) => {
  const search = typeof request.query.search === 'string' ? request.query.search.trim().slice(0, 100) : ''
  const provider = typeof request.query.provider === 'string' ? request.query.provider.trim() : ''
  const topic = typeof request.query.topic === 'string' ? normalizeKey(request.query.topic).slice(0, 32) : ''
  const status = request.query.status === 'ACTIVE' || request.query.status === 'RETIRED' ? request.query.status : ''
  const type = typeof request.query.resourceType === 'string' && resourceTypes.includes(request.query.resourceType as typeof resourceTypes[number]) ? request.query.resourceType : ''
  const and: Prisma.CertificationWhereInput[] = []
  if (search) and.push({ OR: [{ title: { contains: search } }, { code: { contains: search } }, { provider: { contains: search } }, { resources: { some: { isVisible: true, OR: [{ title: { contains: search } }, { content: { contains: search } }] } } }] })
  if (provider) and.push({ providerKey: normalizeKey(provider) })
  if (status) and.push({ status })
  if (type) and.push({ resources: { some: { type, isVisible: true } } })
  if (topic) and.push({ resources: { some: { isVisible: true, topics: { contains: `"${topic}"` } } } })
  const certifications = await prisma.certification.findMany({
    where: and.length ? { AND: and } : {},
    include: { createdBy: true, _count: { select: { resources: { where: { isVisible: true } } } }, resources: { select: { topics: true, isVisible: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  })
  response.json(certifications.map(certificationDto))
})

router.get('/certifications/:id', async (request, response) => {
  const user = await currentUser(request)
  const certification = await prisma.certification.findUnique({
    where: { id: routeParam(request.params.id) },
    include: { createdBy: true, resources: { where: isAdmin(request) ? {} : { isVisible: true }, include: resourceInclude(user.id), orderBy: { createdAt: 'desc' } }, _count: { select: { resources: { where: { isVisible: true } } } } },
  })
  if (!certification) { response.status(404).json({ error: 'Certification not found.' }); return }
  response.json({ ...certificationDto(certification), resources: certification.resources.map(resourceDto) })
})

router.post('/certifications', async (request, response) => {
  const parsed = certificationSchema.safeParse(request.body)
  if (!parsed.success) { response.status(400).json({ error: 'Check the certification details and try again.' }); return }
  const user = await currentUser(request)
  const input = parsed.data
  try {
    const created = await prisma.certification.create({ data: { ...certificationData(input), code: input.code.toUpperCase(), providerKey: normalizeKey(input.provider), codeKey: normalizeKey(input.code), createdById: user.id } })
    const certification = await prisma.certification.findUniqueOrThrow({ where: { id: created.id }, include: { createdBy: true, _count: { select: { resources: true } } } })
    response.status(201).json(certificationDto(certification))
  } catch (error) {
    if (isUniqueError(error)) { response.status(409).json({ error: 'That code already exists for this provider.' }); return }
    throw error
  }
})

router.patch('/certifications/:id', async (request, response) => {
  const parsed = certificationSchema.safeParse(request.body)
  if (!parsed.success) { response.status(400).json({ error: 'Check the certification details and try again.' }); return }
  const user = await currentUser(request)
  const existing = await prisma.certification.findUnique({ where: { id: routeParam(request.params.id) } })
  if (!existing) { response.status(404).json({ error: 'Certification not found.' }); return }
  if (!canManageCertification(request, user, existing)) { response.status(403).json({ error: 'Only the certification creator or an admin can edit these details.' }); return }
  const input = parsed.data
  try {
    await prisma.certification.update({ where: { id: existing.id }, data: { ...certificationData(input), code: input.code.toUpperCase(), providerKey: normalizeKey(input.provider), codeKey: normalizeKey(input.code) } })
    const updated = await prisma.certification.findUniqueOrThrow({ where: { id: existing.id }, include: { createdBy: true, _count: { select: { resources: true } } } })
    response.json(certificationDto(updated))
  } catch (error) {
    if (isUniqueError(error)) { response.status(409).json({ error: 'That code already exists for this provider.' }); return }
    throw error
  }
})

router.post('/certifications/:id/resources', upload.single('file'), async (request, response) => {
  const certification = await prisma.certification.findUnique({ where: { id: routeParam(request.params.id) } })
  if (!certification) { response.status(404).json({ error: 'Certification not found.' }); return }
  const user = await currentUser(request)
  const file = request.file

  if (file) {
    const isPdf = file.mimetype === 'application/pdf' && file.originalname.toLocaleLowerCase().endsWith('.pdf') && file.buffer.subarray(0, 5).toString('ascii') === '%PDF-'
    const title = typeof request.body.title === 'string' ? request.body.title.trim().slice(0, 120) : ''
    let topics: unknown = []
    try { topics = JSON.parse(typeof request.body.topics === 'string' ? request.body.topics : '[]') } catch { topics = null }
    const metadata = resourceMetadataSchema.safeParse({
      topics,
      language: request.body.language,
      estimatedMinutes: request.body.estimatedMinutes,
      sourceName: request.body.sourceName,
      sourceUrl: request.body.sourceUrl,
      rightsConfirmed: request.body.rightsConfirmed === 'true',
    })
    if (!isPdf || !title || !metadata.success || !metadata.data.rightsConfirmed) { response.status(400).json({ error: 'Choose a valid PDF, complete its metadata, and confirm you have permission to share it.' }); return }
    const storageName = `${randomUUID()}.pdf`
    await mkdir(config.uploadDirectory, { recursive: true })
    const fullPath = join(config.uploadDirectory, storageName)
    await import('node:fs/promises').then(({ writeFile }) => writeFile(fullPath, file.buffer, { flag: 'wx' }))
    try {
      const created = await prisma.resource.create({ data: { type: 'PDF', title, content: JSON.stringify({ originalFileName: basename(file.originalname) }), originalFileName: basename(file.originalname), storageName, mimeType: 'application/pdf', fileSize: file.size, ...resourceMetadataData(metadata.data), certificationId: certification.id, createdById: user.id }, include: resourceInclude(user.id) })
      response.status(201).json(resourceDto(created))
    } catch (error) { await unlink(fullPath).catch(() => undefined); throw error }
    return
  }

  const parsed = resourceSchema.safeParse(request.body)
  if (!parsed.success) { response.status(400).json({ error: 'Check the resource details and try again.' }); return }
  let content: string
  try { content = validateResourceContent(parsed.data.type, parsed.data.content, parsed.data.rightsConfirmed) }
  catch (error) { response.status(400).json({ error: error instanceof Error ? error.message : 'Resource content is invalid.' }); return }
  const created = await prisma.resource.create({ data: { type: parsed.data.type, title: parsed.data.title, content, ...resourceMetadataData(parsed.data), certificationId: certification.id, createdById: user.id }, include: resourceInclude(user.id) })
  response.status(201).json(resourceDto(created))
})

router.delete('/resources/:id', async (request, response) => {
  const resource = await prisma.resource.findUnique({ where: { id: routeParam(request.params.id) } })
  if (!resource) { response.status(404).json({ error: 'Resource not found.' }); return }
  const user = await currentUser(request)
  if (!canManageResource(request, user, resource.createdById)) { response.status(403).json({ error: 'Only the resource author or an admin can remove it.' }); return }
  await prisma.resource.delete({ where: { id: resource.id } })
  if (resource.storageName) await unlink(join(config.uploadDirectory, resource.storageName)).catch(() => undefined)
  response.status(204).end()
})

router.post('/resources/:id/bookmark', async (request, response) => {
  const user = await currentUser(request)
  const resourceId = routeParam(request.params.id)
  const resource = await prisma.resource.findUnique({ where: { id: resourceId } })
  if (!resource || (!resource.isVisible && !isAdmin(request))) { response.status(404).json({ error: 'Resource not found.' }); return }
  const existing = await prisma.bookmark.findUnique({ where: { userId_resourceId: { userId: user.id, resourceId } } })
  if (existing) await prisma.bookmark.delete({ where: { id: existing.id } })
  else await prisma.bookmark.create({ data: { userId: user.id, resourceId } })
  response.json({ bookmarked: !existing })
})

router.get('/me/bookmarks', async (request, response) => {
  const user = await currentUser(request)
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: user.id }, orderBy: { createdAt: 'desc' },
    include: { resource: { include: { ...resourceInclude(user.id), certification: { select: { id: true, title: true, provider: true, code: true } } } } },
  })
  response.json(bookmarks.filter((bookmark) => bookmark.resource.isVisible || isAdmin(request)).map((bookmark) => ({
    ...resourceDto(bookmark.resource), certification: bookmark.resource.certification,
  })))
})

router.post('/resources/:id/helpful', async (request, response) => {
  const user = await currentUser(request)
  const resourceId = routeParam(request.params.id)
  const resource = await prisma.resource.findUnique({ where: { id: resourceId } })
  if (!resource || (!resource.isVisible && !isAdmin(request))) { response.status(404).json({ error: 'Resource not found.' }); return }
  const existing = await prisma.resourceHelpfulVote.findUnique({ where: { userId_resourceId: { userId: user.id, resourceId } } })
  if (existing) await prisma.resourceHelpfulVote.delete({ where: { id: existing.id } })
  else await prisma.resourceHelpfulVote.create({ data: { userId: user.id, resourceId } })
  const helpfulCount = await prisma.resourceHelpfulVote.count({ where: { resourceId } })
  response.json({ helpful: !existing, helpfulCount })
})

router.post('/resources/:id/reports', async (request, response) => {
  const parsed = resourceReportSchema.safeParse(request.body)
  if (!parsed.success) { response.status(400).json({ error: 'Choose an issue type and check the details.' }); return }
  const resourceId = routeParam(request.params.id)
  const resource = await prisma.resource.findUnique({ where: { id: resourceId } })
  if (!resource || !resource.isVisible) { response.status(404).json({ error: 'Resource not found.' }); return }
  const user = await currentUser(request)
  const duplicate = await prisma.resourceReport.findFirst({ where: { resourceId, reporterId: user.id, status: 'OPEN' } })
  if (duplicate) { response.status(409).json({ error: 'You already have an open report for this resource.' }); return }
  const report = await prisma.resourceReport.create({ data: { ...parsed.data, resourceId, reporterId: user.id } })
  response.status(201).json({ id: report.id, status: report.status })
})

router.get('/admin/reports', async (request, response) => {
  if (!isAdmin(request)) { response.status(403).json({ error: 'Administrator access is required.' }); return }
  const user = await currentUser(request)
  const reports = await prisma.resourceReport.findMany({
    where: { status: 'OPEN' }, orderBy: { createdAt: 'asc' },
    include: { reporter: { select: { displayName: true } }, resource: { include: { ...resourceInclude(user.id), certification: { select: { id: true, title: true, code: true } } } } },
  })
  response.json(reports.map((report) => ({ id: report.id, category: report.category, message: report.message, createdAt: report.createdAt.toISOString(), reporterName: report.reporter.displayName, resource: { ...resourceDto(report.resource), certification: report.resource.certification } })))
})

router.patch('/admin/reports/:id', async (request, response) => {
  if (!isAdmin(request)) { response.status(403).json({ error: 'Administrator access is required.' }); return }
  const status = request.body?.status
  if (status !== 'RESOLVED' && status !== 'DISMISSED') { response.status(400).json({ error: 'Choose a valid report status.' }); return }
  const report = await prisma.resourceReport.update({ where: { id: routeParam(request.params.id) }, data: { status, resolvedAt: new Date() } }).catch(() => null)
  if (!report) { response.status(404).json({ error: 'Report not found.' }); return }
  response.json({ id: report.id, status: report.status })
})

router.patch('/admin/resources/:id', async (request, response) => {
  if (!isAdmin(request)) { response.status(403).json({ error: 'Administrator access is required.' }); return }
  const resourceId = routeParam(request.params.id)
  const user = await currentUser(request)
  const existing = await prisma.resource.findUnique({ where: { id: resourceId } })
  if (!existing) { response.status(404).json({ error: 'Resource not found.' }); return }
  const data: Prisma.ResourceUpdateInput = {}
  if (typeof request.body?.isVisible === 'boolean') {
    data.isVisible = request.body.isVisible
    data.hiddenAt = request.body.isVisible ? null : new Date()
    data.hiddenBy = request.body.isVisible ? { disconnect: true } : { connect: { id: user.id } }
  }
  if (typeof request.body?.reviewed === 'boolean') {
    data.reviewedAt = request.body.reviewed ? new Date() : null
    data.reviewedBy = request.body.reviewed ? { connect: { id: user.id } } : { disconnect: true }
  }
  const updated = await prisma.resource.update({ where: { id: resourceId }, data, include: resourceInclude(user.id) })
  response.json(resourceDto(updated))
})

router.get('/resources/:id/file', async (request, response) => {
  const resource = await prisma.resource.findUnique({ where: { id: routeParam(request.params.id) } })
  if (!resource || resource.type !== 'PDF' || !resource.storageName || (!resource.isVisible && !isAdmin(request))) { response.status(404).json({ error: 'PDF resource not found.' }); return }
  response.download(join(config.uploadDirectory, resource.storageName), resource.originalFileName ?? 'resource.pdf')
})

function isUniqueError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

export { router as apiRouter }