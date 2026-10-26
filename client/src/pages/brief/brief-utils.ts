// Non-component helpers for the study brief page (kept out of .tsx files for react-refresh).
import type { BriefPageDto, BriefSource, ChecklistItem, FeedbackReportReason, FeedbackSummary, FreshnessStatus, JobDto } from '../../lib/contracts'

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

export const emptyFeedback = (): FeedbackSummary => ({ stars: 0, reports: 0, mine: null })

/** Local (optimistic / fixture) toggle of the user's star, mirroring the server: a star replaces the user's report. */
export function applyStar(summary: FeedbackSummary | undefined): FeedbackSummary {
  const next = { ...(summary ?? emptyFeedback()) }
  if (next.mine === 'star') return { ...next, stars: Math.max(0, next.stars - 1), mine: null }
  if (next.mine === 'report') next.reports = Math.max(0, next.reports - 1)
  return { ...next, stars: next.stars + 1, mine: 'star' }
}

/** Local (fixture) application of a report: replaces the user's star. */
export function applyReport(summary: FeedbackSummary | undefined): FeedbackSummary {
  const next = { ...(summary ?? emptyFeedback()) }
  if (next.mine === 'report') return next
  if (next.mine === 'star') next.stars = Math.max(0, next.stars - 1)
  return { ...next, reports: next.reports + 1, mine: 'report' }
}

export const reportReasons: { value: FeedbackReportReason; label: string }[] = [
  { value: 'wrong', label: 'Wrong or misleading' },
  { value: 'outdated', label: 'Outdated' },
  { value: 'broken_link', label: 'Broken link' },
  { value: 'other', label: 'Something else' },
]

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
