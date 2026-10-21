import { APIUserAbortError, AuthenticationError, RateLimitError } from 'openai'
import { prisma } from '../../database.js'
import type { JobDto, JobKind, JobProgressEntry } from '../../lib/contracts/index.js'
import { MissingApiKeyError } from '../openai/client.js'
import { jobDto, parseJobProgress } from './dto.js'
import { withChildSignal } from '../../lib/abort.js'

export type { JobKind } from '../../lib/contracts/index.js'

export interface JobContext {
  jobId: string
  requestedById: string
  certificationId: string | null
  intakeSessionId: string | null
  useServerKey: boolean
  /** Appends `{ at, message }` to the job's progress log (visible to the client). Never log secrets. */
  log: (message: string) => Promise<void>
  /** Fires when the server shuts down. Pass it to OpenAI calls (`{ signal }`). */
  signal: AbortSignal
}

export type JobHandler = (ctx: JobContext) => Promise<{ resultBriefId?: string; inputTokens?: number; outputTokens?: number }>

/** Throw this from a handler when the message is safe and useful to show to the user. */
export class UserFacingJobError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserFacingJobError'
  }
}

const POLL_INTERVAL_MS = 1500
const CONCURRENCY = 2
const SHUTDOWN_GRACE_MS = 5000
const ACTIVE_STATUSES = ['QUEUED', 'RUNNING']

const handlers = new Map<JobKind, JobHandler>()
const running = new Map<string, Promise<void>>()
let timer: NodeJS.Timeout | null = null
let ticking = false
let shutdownController = new AbortController()

export function registerJobHandler(kind: JobKind, handler: JobHandler): void {
  handlers.set(kind, handler)
}

export async function enqueueJob(input: { kind: JobKind; requestedById: string; certificationId?: string; intakeSessionId?: string; useServerKey?: boolean }): Promise<JobDto> {
  const row = await prisma.researchJob.create({
    data: {
      kind: input.kind,
      requestedById: input.requestedById,
      certificationId: input.certificationId ?? null,
      intakeSessionId: input.intakeSessionId ?? null,
      useServerKey: input.useServerKey ?? false,
      progress: JSON.stringify([{ at: new Date().toISOString(), message: 'Queued.' }]),
    },
  })
  if (timer) setImmediate(() => void tick())
  return jobDto(row)
}

export async function getJob(jobId: string): Promise<JobDto | null> {
  const row = await prisma.researchJob.findUnique({ where: { id: jobId } })
  return row ? jobDto(row) : null
}

export async function findActiveJob(where: { certificationId?: string; intakeSessionId?: string }): Promise<JobDto | null> {
  if (!where.certificationId && !where.intakeSessionId) return null
  const row = await prisma.researchJob.findFirst({
    where: {
      status: { in: ACTIVE_STATUSES },
      ...(where.certificationId ? { certificationId: where.certificationId } : {}),
      ...(where.intakeSessionId ? { intakeSessionId: where.intakeSessionId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })
  return row ? jobDto(row) : null
}

/** On boot, any RUNNING job belongs to a dead process: mark it FAILED. */
export async function recoverInterruptedJobs(): Promise<void> {
  const now = new Date()
  const { count } = await prisma.researchJob.updateMany({
    where: { status: 'RUNNING' },
    data: { status: 'FAILED', error: 'The server restarted while this job was running. Start it again.', finishedAt: now },
  })
  if (count) console.warn(`Marked ${count} interrupted job(s) as FAILED.`)
}

export function startJobWorker(): void {
  if (timer) return
  if (shutdownController.signal.aborted) shutdownController = new AbortController()
  timer = setInterval(() => void tick(), POLL_INTERVAL_MS)
  void tick()
}

/** Stops polling, aborts running jobs, and waits briefly for them to settle. */
export async function stopJobWorker(): Promise<void> {
  if (timer) clearInterval(timer)
  timer = null
  shutdownController.abort(new Error('Server is shutting down.'))
  if (!running.size) return
  await Promise.race([
    Promise.allSettled([...running.values()]),
    new Promise((resolve) => setTimeout(resolve, SHUTDOWN_GRACE_MS).unref()),
  ])
}

async function tick() {
  if (ticking || !timer) return
  ticking = true
  try {
    while (running.size < CONCURRENCY && timer) {
      const claimed = await claimNextJob()
      if (!claimed) break
      const promise = runJob(claimed).finally(() => running.delete(claimed.id))
      running.set(claimed.id, promise)
    }
  } catch (error) {
    console.error('Job worker poll failed:', error)
  } finally {
    ticking = false
  }
}

async function claimNextJob() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const next = await prisma.researchJob.findFirst({ where: { status: 'QUEUED' }, orderBy: { createdAt: 'asc' } })
    if (!next) return null
    const startedAt = new Date()
    const { count } = await prisma.researchJob.updateMany({ where: { id: next.id, status: 'QUEUED' }, data: { status: 'RUNNING', startedAt } })
    if (count === 1) return { ...next, status: 'RUNNING', startedAt }
  }
  return null
}

function createLogger(jobId: string, initial: JobProgressEntry[]) {
  const entries = [...initial]
  let chain: Promise<void> = Promise.resolve()
  return (message: string) => {
    entries.push({ at: new Date().toISOString(), message: message.slice(0, 500) })
    const snapshot = JSON.stringify(entries)
    chain = chain.then(async () => { await prisma.researchJob.update({ where: { id: jobId }, data: { progress: snapshot } }) }).catch((error: unknown) => {
      console.error(`Could not write progress for job ${jobId}:`, error)
    })
    return chain
  }
}

function userSafeError(error: unknown, signal: AbortSignal) {
  if (signal.aborted || error instanceof APIUserAbortError) return 'The server shut down while this job was running. Start it again.'
  if (error instanceof UserFacingJobError || error instanceof MissingApiKeyError) return error.message
  if (error instanceof AuthenticationError) return 'OpenAI rejected the API key. Update it in Settings.'
  if (error instanceof RateLimitError) return 'OpenAI rate limit or quota exceeded. Try again later.'
  return 'The job failed unexpectedly. Try again later.'
}

async function runJob(row: { id: string; kind: string; requestedById: string; certificationId: string | null; intakeSessionId: string | null; useServerKey: boolean; progress: string }) {
  // One listener per running job on the shared shutdown signal; handlers derive per-call signals from this one.
  await withChildSignal(shutdownController.signal, (signal) => runJobWithSignal(row, signal))
}

async function runJobWithSignal(row: { id: string; kind: string; requestedById: string; certificationId: string | null; intakeSessionId: string | null; useServerKey: boolean; progress: string }, signal: AbortSignal) {
  const log = createLogger(row.id, parseJobProgress(row.progress))
  const handler = handlers.get(row.kind as JobKind)
  try {
    if (!handler) throw new UserFacingJobError(`No handler is registered for job kind ${row.kind}.`)
    await log('Started.')
    const result = await handler({
      jobId: row.id,
      requestedById: row.requestedById,
      certificationId: row.certificationId,
      intakeSessionId: row.intakeSessionId,
      useServerKey: row.useServerKey,
      log,
      signal,
    })
    await log('Finished.')
    await prisma.researchJob.update({
      where: { id: row.id },
      data: {
        status: 'SUCCEEDED',
        resultBriefId: result.resultBriefId ?? null,
        inputTokens: result.inputTokens ?? null,
        outputTokens: result.outputTokens ?? null,
        finishedAt: new Date(),
      },
    })
  } catch (error) {
    console.error(`Job ${row.id} (${row.kind}) failed:`, error)
    const message = userSafeError(error, signal)
    await log(`Failed: ${message}`)
    await prisma.researchJob.update({ where: { id: row.id }, data: { status: 'FAILED', error: message, finishedAt: new Date() } }).catch((updateError: unknown) => {
      console.error(`Could not mark job ${row.id} as failed:`, updateError)
    })
  }
}
