// Non-component helpers for the study brief page (kept out of .tsx files for react-refresh).
import type { BriefPageDto, BriefSource, ChecklistItem, FeedbackVerdict, FreshnessStatus, JobDto } from '../../lib/contracts'
import type { FeedbackSummary } from '../../lib/api/briefs'

/** Returns the URL only when it is an absolute HTTPS URL; anything else is not rendered as a link. */
export function safeUrl(value: string | null | undefined) {
  if (!value) return undefined
  try { return new URL(value).protocol === 'https:' ? value : undefined } catch { return undefined }
}

export function ageLabel(ageDays: number | null) {
  if (ageDays === null) return ''
  if (ageDays < 1) return 'today'
  return ageDays === 1 ? '1 day old' : `${Math.round(ageDays)} days old`
}

export function freshnessLabel(freshness: BriefPageDto['freshness']) {
  const labels: Record<FreshnessStatus, string> = { fresh: 'Fresh', stale: 'Stale', missing: 'No brief yet' }
  const age = ageLabel(freshness.ageDays)
  return freshness.status === 'missing' || !age ? labels[freshness.status] : `${labels[freshness.status]} · ${age}`
}

export const phaseLabels: Record<ChecklistItem['phase'], string> = { orient: 'Orient', learn: 'Learn', practice: 'Practice', review: 'Review', exam_day: 'Exam day' }
export const phaseOrder: ChecklistItem['phase'][] = ['orient', 'learn', 'practice', 'review', 'exam_day']

export function groupChecklist(items: ChecklistItem[]) {
  return phaseOrder
    .map((phase) => ({ phase, items: items.filter((item) => item.phase === phase).sort((a, b) => a.order - b.order) }))
    .filter((group) => group.items.length > 0)
}

export function formatMinutes(minutes: number | null) {
  if (minutes === null) return ''
  if (minutes < 60) return `${minutes} min`
  const hours = minutes / 60
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`
}

export function sourceIndex(sources: BriefSource[]) {
  return new Map(sources.map((source, index) => [source.id, { n: index + 1, source }]))
}

export const terminalStatuses: ReadonlySet<JobDto['status']> = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED'])
export const isTerminal = (job: JobDto | null) => Boolean(job && terminalStatuses.has(job.status))

export const emptyFeedback = (): FeedbackSummary => ({ accurate: 0, inaccurate: 0, outdated: 0, mine: null })

/** Local (optimistic / fixture) application of a user's vote to a summary. */
export function applyVote(summary: FeedbackSummary | undefined, verdict: FeedbackVerdict): FeedbackSummary {
  const next = { ...(summary ?? emptyFeedback()) }
  if (next.mine === verdict) return next
  if (next.mine) next[next.mine] = Math.max(0, next[next.mine] - 1)
  next[verdict] += 1
  next.mine = verdict
  return next
}

const fixtureSteps = [
  'Started.',
  'Reading the official exam page and skills outline.',
  'Reading the official learning path and practice assessment.',
  'Collecting community notes from forums, videos and blogs.',
  'Checking third-party resources and filtering blocked domains.',
  'Structuring the study brief and validating sources.',
  'Finished.',
]

/** Fixture mode only: advances a fake job by one progress step per poll. */
export function advanceFixtureJob(job: JobDto): JobDto {
  const step = job.progress.length - 1
  const at = new Date().toISOString()
  if (step >= fixtureSteps.length) return { ...job, status: 'SUCCEEDED', finishedAt: at }
  return { ...job, status: 'RUNNING', startedAt: job.startedAt ?? at, progress: [...job.progress, { at, message: fixtureSteps[step] }] }
}

export function createFixtureJob(certificationId: string): JobDto {
  const at = new Date().toISOString()
  return { id: `fixture-job-${at}`, kind: 'REFRESH', status: 'QUEUED', certificationId, intakeSessionId: null, resultBriefId: null, progress: [{ at, message: 'Queued.' }], error: null, createdAt: at, startedAt: null, finishedAt: null }
}
