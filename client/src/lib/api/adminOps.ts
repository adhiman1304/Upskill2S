// Admin operations API (workstream E). Mirrors server/src/routes/admin-ops.ts and server/src/services/{ops,scheduler}.
import type { AuthenticatedRequest } from './client'
import type { JobDto, JobKind, JobStatus } from '../contracts'

export type { JobKind, JobStatus }
export const jobKinds: JobKind[] = ['BRIEF', 'REFRESH', 'INTAKE']
export const jobStatuses: JobStatus[] = ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED']

export interface TokenTotals { input: number; output: number }

export interface SchedulerStatus {
  enabled: boolean
  cron: string
  serverKeyAvailable: boolean
  active: boolean
  inactiveReason: string | null
  nextRunAt: string | null
  lastRunAt: string | null
  lastRunEnqueued: number | null
  lastRunTrigger: 'schedule' | 'admin' | null
  lastRunError: string | null
}

export interface OpsSummary {
  generatedAt: string
  briefs: { total: number; fresh: number; stale: number; certificationsWithoutBrief: number; followedWithoutBrief: number; staleAfterDays: number }
  jobs: { last24h: Record<JobStatus, number> & { total: number } }
  tokens: { last7Days: TokenTotals & { jobs: number }; byKind: Record<JobKind, TokenTotals & { jobs: number }> }
  scheduler: SchedulerStatus
  followers: { total: number; certifications: number }
}

export type AdminJobDto = JobDto & {
  requestedByName: string
  certification: { id: string; provider: string; code: string; title: string } | null
  useServerKey: boolean
  inputTokens: number | null
  outputTokens: number | null
}

export interface StaleCertification {
  certificationId: string
  provider: string
  code: string
  title: string
  followers: number
  reason: 'stale' | 'missing'
  briefId: string | null
  briefGeneratedAt: string | null
  briefAgeDays: number | null
}

export interface StaleListDto { staleAfterDays: number; items: StaleCertification[] }

export interface RefreshStaleInput { limit?: number; certificationIds?: string[]; onlyFollowed?: boolean }
export interface RefreshStaleResult { enqueued: JobDto[]; skipped: { certificationId: string; reason: 'not_found' | 'job_active' }[] }

export function getOpsSummary(request: AuthenticatedRequest) {
  return request<OpsSummary>('/api/admin/ops/summary')
}

export function listAdminJobs(request: AuthenticatedRequest, filters: { status?: JobStatus | ''; kind?: JobKind | ''; limit?: number } = {}) {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.kind) params.set('kind', filters.kind)
  if (filters.limit) params.set('limit', String(filters.limit))
  const query = params.toString()
  return request<AdminJobDto[]>(`/api/admin/ops/jobs${query ? `?${query}` : ''}`)
}

export function getStaleCertifications(request: AuthenticatedRequest, options: { onlyFollowed?: boolean; limit?: number } = {}) {
  const params = new URLSearchParams()
  if (options.onlyFollowed !== undefined) params.set('onlyFollowed', String(options.onlyFollowed))
  if (options.limit) params.set('limit', String(options.limit))
  const query = params.toString()
  return request<StaleListDto>(`/api/admin/ops/stale${query ? `?${query}` : ''}`)
}

export function refreshStale(request: AuthenticatedRequest, input: RefreshStaleInput = {}) {
  return request<RefreshStaleResult>('/api/admin/ops/refresh-stale', { method: 'POST', body: JSON.stringify(input) })
}

export function cancelAdminJob(request: AuthenticatedRequest, id: string) {
  return request<AdminJobDto>(`/api/admin/ops/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST' })
}
