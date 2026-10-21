import cron, { type ScheduledTask } from 'node-cron'
import { config } from '../../config.js'
import { prisma } from '../../database.js'
import type { JobDto } from '../../lib/contracts/index.js'
import { enqueueJob, findActiveJob } from '../jobs/queue.js'
import { getServerOpenAIClient } from '../openai/client.js'
import { findStaleCertifications } from '../ops/stale.js'

export const SCHEDULED_REFRESH_LIMIT = 10
export const MAX_REFRESH_LIMIT = 25

/** Thrown by `refreshStaleBriefs` when `OPENAI_SERVER_API_KEY` is not configured. Routes map it to 412 `SERVER_KEY_MISSING`. */
export class ServerKeyMissingError extends Error {
  readonly code = 'SERVER_KEY_MISSING'
  constructor(message = 'OPENAI_SERVER_API_KEY is not configured, so briefs cannot be refreshed unattended.') {
    super(message)
    this.name = 'ServerKeyMissingError'
  }
}

export type RefreshTrigger = 'schedule' | 'admin'

export interface SchedulerStatus {
  enabled: boolean
  cron: string
  serverKeyAvailable: boolean
  /** True when a cron task is actually registered in this process. */
  active: boolean
  /** Why the scheduler is not active, when it is not. */
  inactiveReason: string | null
  nextRunAt: string | null
  lastRunAt: string | null
  lastRunEnqueued: number | null
  lastRunTrigger: RefreshTrigger | null
  lastRunError: string | null
}

let task: ScheduledTask | null = null
let warnedMissingKey = false
const lastRun: { at: Date | null; enqueued: number | null; trigger: RefreshTrigger | null; error: string | null } = { at: null, enqueued: null, trigger: null, error: null }

/** The system user (`system`/`system`, "Upskill") that owns unattended jobs. Upserted on demand. */
export async function getSystemUserId(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { tenantId_objectId: { tenantId: 'system', objectId: 'system' } },
    create: { tenantId: 'system', objectId: 'system', displayName: 'Upskill' },
    update: {},
    select: { id: true },
  })
  return user.id
}

export interface RefreshStaleResult {
  enqueued: JobDto[]
  skipped: { certificationId: string; reason: 'not_found' | 'job_active' }[]
}

/**
 * Enqueues `REFRESH` jobs (server key) for stale certifications. Without `certificationIds` it takes the
 * stale list (`findStaleCertifications`, followed only by default). With `certificationIds` it refreshes
 * exactly those certifications, stale or not, skipping unknown ones and ones with an active job.
 */
export async function refreshStaleBriefs(options: { limit?: number | undefined; requestedById?: string | undefined; certificationIds?: string[] | undefined; onlyFollowed?: boolean | undefined; trigger?: RefreshTrigger | undefined } = {}): Promise<RefreshStaleResult> {
  const trigger = options.trigger ?? 'admin'
  try {
    if (!getServerOpenAIClient()) throw new ServerKeyMissingError()
    const limit = Math.min(Math.max(options.limit ?? SCHEDULED_REFRESH_LIMIT, 1), MAX_REFRESH_LIMIT)
    const requestedById = options.requestedById ?? await getSystemUserId()
    const skipped: RefreshStaleResult['skipped'] = []
    let targetIds: string[]

    if (options.certificationIds?.length) {
      const wanted = [...new Set(options.certificationIds)].slice(0, limit)
      const existing = new Set((await prisma.certification.findMany({ where: { id: { in: wanted } }, select: { id: true } })).map((row) => row.id))
      targetIds = []
      for (const id of wanted) {
        if (!existing.has(id)) skipped.push({ certificationId: id, reason: 'not_found' })
        else targetIds.push(id)
      }
    } else {
      targetIds = (await findStaleCertifications({ onlyFollowed: options.onlyFollowed ?? true, limit })).map((item) => item.certificationId)
    }

    const enqueued: JobDto[] = []
    for (const certificationId of targetIds) {
      if (await findActiveJob({ certificationId })) { skipped.push({ certificationId, reason: 'job_active' }); continue }
      enqueued.push(await enqueueJob({ kind: 'REFRESH', requestedById, certificationId, useServerKey: true }))
    }

    Object.assign(lastRun, { at: new Date(), enqueued: enqueued.length, trigger, error: null })
    console.log(`[scheduler] refresh-stale (${trigger}): enqueued ${enqueued.length} REFRESH job(s), skipped ${skipped.length}, limit ${limit}.`)
    return { enqueued, skipped }
  } catch (error) {
    Object.assign(lastRun, { at: new Date(), enqueued: 0, trigger, error: error instanceof ServerKeyMissingError ? error.message : 'The refresh run failed. See the server log.' })
    throw error
  }
}

async function runScheduledRefresh() {
  try {
    await refreshStaleBriefs({ limit: SCHEDULED_REFRESH_LIMIT, requestedById: await getSystemUserId(), onlyFollowed: true, trigger: 'schedule' })
  } catch (error) {
    console.error('[scheduler] refresh-stale (schedule) failed:', error)
  }
}

function inactiveReason(): string | null {
  if (task) return null
  if (!config.schedulerEnabled) return 'SCHEDULER_ENABLED is not true.'
  if (!getServerOpenAIClient()) return 'OPENAI_SERVER_API_KEY is not configured.'
  if (!cron.validate(config.schedulerCron)) return `SCHEDULER_CRON "${config.schedulerCron}" is not a valid cron expression.`
  return 'The scheduler has not been started in this process.'
}

/** Registers the nightly stale-brief refresh. No-op unless `SCHEDULER_ENABLED=true` and a server key exists. Idempotent. */
export function startScheduler(): void {
  if (task || !config.schedulerEnabled) return
  if (!getServerOpenAIClient()) {
    if (!warnedMissingKey) console.warn('[scheduler] SCHEDULER_ENABLED=true but OPENAI_SERVER_API_KEY is not set; scheduled brief refresh is disabled (staleness is still reported on /admin/ops).')
    warnedMissingKey = true
    return
  }
  if (!cron.validate(config.schedulerCron)) {
    console.warn(`[scheduler] SCHEDULER_CRON "${config.schedulerCron}" is not a valid cron expression; scheduled brief refresh is disabled.`)
    return
  }
  task = cron.schedule(config.schedulerCron, runScheduledRefresh, { name: 'refresh-stale-briefs', noOverlap: true })
  console.log(`[scheduler] Stale brief refresh scheduled with cron "${config.schedulerCron}" (max ${SCHEDULED_REFRESH_LIMIT} per run).`)
}

export async function stopScheduler(): Promise<void> {
  const current = task
  task = null
  if (!current) return
  await current.stop()
  await current.destroy()
}

export function getSchedulerStatus(): SchedulerStatus {
  let nextRunAt: string | null
  try { nextRunAt = task?.getNextRun()?.toISOString() ?? null } catch { nextRunAt = null }
  return {
    enabled: config.schedulerEnabled,
    cron: config.schedulerCron,
    serverKeyAvailable: getServerOpenAIClient() !== null,
    active: task !== null,
    inactiveReason: inactiveReason(),
    nextRunAt,
    lastRunAt: lastRun.at?.toISOString() ?? null,
    lastRunEnqueued: lastRun.enqueued,
    lastRunTrigger: lastRun.trigger,
    lastRunError: lastRun.error,
  }
}
