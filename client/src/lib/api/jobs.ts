// Job status API (workstream B). Poll `getJob` while a job is QUEUED or RUNNING.
import type { AuthenticatedRequest } from './client'
import type { JobDto } from '../contracts'

export const terminalJobStatuses: ReadonlySet<JobDto['status']> = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED'])

export function getJob(request: AuthenticatedRequest, id: string) {
  return request<JobDto>(`/api/jobs/${encodeURIComponent(id)}`)
}

export function listMyJobs(request: AuthenticatedRequest) {
  return request<JobDto[]>('/api/me/jobs')
}
