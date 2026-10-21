// Workstream C: intake and recommendations.
// Mounted in routes/api.ts at the API root, so paths here are FULL paths. Every route applies requireAuth itself.
import { Router, type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import { z } from 'zod'
import type { IntakeSession } from '../generated/prisma/client.js'
import { config } from '../config.js'
import { prisma } from '../database.js'
import { intakeAttachmentSchema, intakeResultSchema, intakeStatusSchema, type IntakeAttachment, type IntakeSessionDto } from '../lib/contracts/index.js'
import { currentUser, isAdmin } from '../lib/permissions.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { CatalogInputError, resolveCertification } from '../services/catalog/index.js'
import { combineExtractedText, extractText, IntakeFileError, isSupportedIntakeFileName, type ExtractedFile } from '../services/intake/extract.js'
import { enqueueJob } from '../services/jobs/queue.js'

export const intakeRouter = Router()

const MAX_INPUT_TEXT_CHARS = 20_000
const routeParam = (value: string | string[] | undefined) => typeof value === 'string' ? value : value?.[0] ?? ''

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.intakeMaxFileBytes, files: config.intakeMaxFiles, fields: 5, fieldSize: 200_000 },
  fileFilter: (_request, file, callback) => {
    if (!isSupportedIntakeFileName(file.originalname)) { callback(new IntakeFileError('Only PDF, DOCX, TXT and Markdown files are supported.')); return }
    callback(null, true)
  },
})
const uploadFiles = upload.array('files[]', config.intakeMaxFiles)

function parseUpload(request: Request, response: Response, next: NextFunction) {
  uploadFiles(request, response, (error: unknown) => {
    if (!error) { next(); return }
    if (error instanceof IntakeFileError) { response.status(400).json({ error: error.message }); return }
    if (error instanceof multer.MulterError) {
      const maxMb = Math.round(config.intakeMaxFileBytes / 1024 / 1024)
      const messages: Partial<Record<multer.ErrorCode, string>> = {
        LIMIT_FILE_SIZE: `Each file must be ${maxMb} MB or smaller.`,
        LIMIT_FILE_COUNT: `Upload at most ${config.intakeMaxFiles} files.`,
        LIMIT_UNEXPECTED_FILE: `Upload at most ${config.intakeMaxFiles} files in the "files[]" field.`,
        LIMIT_FIELD_VALUE: 'The description is too long.',
      }
      response.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: messages[error.code] ?? 'The upload could not be processed.' })
      return
    }
    next(error)
  })
}

function parseJsonArray<T>(value: string, schema: z.ZodType<T>): T[] {
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.flatMap((item) => { const result = schema.safeParse(item); return result.success ? [result.data] : [] }) : []
  } catch { return [] }
}

function parseResult(value: string | null) {
  if (!value) return null
  try {
    const result = intakeResultSchema.safeParse(JSON.parse(value))
    return result.success ? result.data : null
  } catch { return null }
}

function intakeSessionDto(session: IntakeSession, jobId: string | null): IntakeSessionDto {
  return {
    id: session.id,
    status: intakeStatusSchema.catch('FAILED').parse(session.status),
    inputText: session.inputText,
    attachments: parseJsonArray(session.attachments, intakeAttachmentSchema),
    result: parseResult(session.result),
    error: session.error,
    jobId,
    createdAt: session.createdAt.toISOString(),
  }
}

async function latestJobIds(sessionIds: string[]) {
  const jobs = await prisma.researchJob.findMany({ where: { intakeSessionId: { in: sessionIds } }, orderBy: { createdAt: 'desc' }, select: { id: true, intakeSessionId: true } })
  const map = new Map<string, string>()
  for (const job of jobs) if (job.intakeSessionId && !map.has(job.intakeSessionId)) map.set(job.intakeSessionId, job.id)
  return map
}

async function loadOwnedSession(request: Request, response: Response) {
  const user = await currentUser(request)
  const session = await prisma.intakeSession.findUnique({ where: { id: routeParam(request.params.id) } })
  if (!session || (session.userId !== user.id && !isAdmin(request))) { response.status(404).json({ error: 'Intake session not found.' }); return null }
  return { user, session }
}

intakeRouter.post('/intake', requireAuth, parseUpload, async (request, response) => {
  const user = await currentUser(request)
  const body = (request.body ?? {}) as Record<string, unknown>
  const inputText = typeof body.text === 'string' ? body.text.trim() : ''
  const files = Array.isArray(request.files) ? request.files : []
  if (inputText.length > MAX_INPUT_TEXT_CHARS) { response.status(400).json({ error: `Keep the description under ${MAX_INPUT_TEXT_CHARS.toLocaleString('en-US')} characters.` }); return }
  if (!inputText && !files.length) { response.status(400).json({ error: 'Describe your background and goals, or attach at least one file.' }); return }

  const extracted: ExtractedFile[] = []
  try {
    for (const file of files) extracted.push(await extractText(file))
  } catch (error) {
    if (error instanceof IntakeFileError) { response.status(400).json({ error: error.message }); return }
    throw error
  }
  if (!inputText && extracted.every((file) => !file.text)) { response.status(400).json({ error: 'No text could be found in the attached files. Add a description instead.' }); return }

  const key = await prisma.userProviderKey.findUnique({ where: { userId_provider: { userId: user.id, provider: 'openai' } }, select: { id: true } })
  if (!key) { response.status(412).json({ error: 'Add your OpenAI API key in Settings to get recommendations.', code: 'OPENAI_KEY_MISSING' }); return }

  const attachments: IntakeAttachment[] = extracted.map(({ name, mimeType, size, chars }) => ({ name, mimeType, size, chars }))
  const session = await prisma.intakeSession.create({
    data: { userId: user.id, inputText, attachments: JSON.stringify(attachments), extractedText: combineExtractedText(extracted), status: 'QUEUED' },
  })
  const job = await enqueueJob({ kind: 'INTAKE', requestedById: user.id, intakeSessionId: session.id })
  response.status(202).json(intakeSessionDto(session, job.id))
})

intakeRouter.get('/intake/:id', requireAuth, async (request, response) => {
  const loaded = await loadOwnedSession(request, response)
  if (!loaded) return
  const jobIds = await latestJobIds([loaded.session.id])
  response.json(intakeSessionDto(loaded.session, jobIds.get(loaded.session.id) ?? null))
})

intakeRouter.get('/me/intake', requireAuth, async (request, response) => {
  const user = await currentUser(request)
  const sessions = await prisma.intakeSession.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 10 })
  const jobIds = await latestJobIds(sessions.map((session) => session.id))
  response.json(sessions.map((session) => intakeSessionDto(session, jobIds.get(session.id) ?? null)))
})

const selectSchema = z.object({ recommendationIndex: z.number().int().min(0).max(50) })

intakeRouter.post('/intake/:id/select', requireAuth, async (request, response) => {
  const parsed = selectSchema.safeParse(request.body)
  if (!parsed.success) { response.status(400).json({ error: 'Choose a recommendation.' }); return }
  const loaded = await loadOwnedSession(request, response)
  if (!loaded) return
  const recommendation = parseResult(loaded.session.result)?.recommendations[parsed.data.recommendationIndex]
  if (loaded.session.status !== 'SUCCEEDED' || !recommendation) { response.status(404).json({ error: 'Recommendation not found.' }); return }
  // Model output may use a spaced name as the code (for example Google exams); turn it into a slug the catalog accepts.
  const code = recommendation.code.trim().replace(/\s+/g, '-').replace(/[^A-Za-z0-9._-]/g, '').replace(/^[^A-Za-z0-9]+/, '').slice(0, 40)
  try {
    const certification = await resolveCertification({
      provider: recommendation.provider.trim().slice(0, 80),
      code,
      title: recommendation.title.trim().slice(0, 160),
      officialUrl: recommendation.officialUrl?.startsWith('https://') ? recommendation.officialUrl.slice(0, 2048) : null,
    }, loaded.user.id)
    response.json({ certificationId: certification.id })
  } catch (error) {
    if (error instanceof CatalogInputError) {
      response.status(422).json({ error: `This recommendation could not be added to the catalog (${error.message}). Search for it on the home page instead.`, code: 'INVALID_REQUEST' })
      return
    }
    throw error
  }
})
