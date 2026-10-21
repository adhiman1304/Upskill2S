// Study brief API (workstream B). Each function takes the authenticated `request` from `useApi()` first.
import type { AuthenticatedRequest } from './client'
import type { BriefPageDto, BriefVersionSummary, FeedbackItemType, FeedbackReportReason, FollowStatus, JobDto, StudyBriefDto } from '../contracts'

export type FeedbackSummary = BriefPageDto['feedback'][string]
export type Following = BriefPageDto['following']

const certPath = (certificationId: string) => `/api/certifications/${encodeURIComponent(certificationId)}`

export function getBriefPage(request: AuthenticatedRequest, certificationId: string) {
  return request<BriefPageDto>(`${certPath(certificationId)}/brief`)
}

/** 202 with the queued job. Errors: 412 OPENAI_KEY_MISSING, 409 JOB_ALREADY_RUNNING, 429 RATE_LIMITED. */
export function refreshBrief(request: AuthenticatedRequest, certificationId: string) {
  return request<JobDto>(`${certPath(certificationId)}/brief/refresh`, { method: 'POST' })
}

export function listBriefVersions(request: AuthenticatedRequest, certificationId: string) {
  return request<BriefVersionSummary[]>(`${certPath(certificationId)}/brief/versions`)
}

export function getBriefVersion(request: AuthenticatedRequest, certificationId: string, briefId: string) {
  return request<StudyBriefDto>(`${certPath(certificationId)}/brief/versions/${encodeURIComponent(briefId)}`)
}

export function setChecklistProgress(request: AuthenticatedRequest, certificationId: string, itemId: string, completed: boolean) {
  return request<{ completedItemIds: string[] }>(`${certPath(certificationId)}/brief/progress/${encodeURIComponent(itemId)}`, { method: 'PUT', body: JSON.stringify({ completed }) })
}

export type FeedbackInput =
  | { itemType: FeedbackItemType; itemId: string; verdict: 'star' }
  | { itemType: FeedbackItemType; itemId: string; verdict: 'report'; reason: FeedbackReportReason; comment: string }

/** Star toggles (posting it again removes the star). Report needs a reason and a 3 to 500 character comment (400 otherwise). */
export function sendBriefFeedback(request: AuthenticatedRequest, briefId: string, input: FeedbackInput) {
  return request<{ key: string; summary: FeedbackSummary }>(`/api/briefs/${encodeURIComponent(briefId)}/feedback`, { method: 'POST', body: JSON.stringify(input) })
}

export function followCertification(request: AuthenticatedRequest, certificationId: string, input: { status: FollowStatus; targetDate?: string | null }) {
  return request<NonNullable<Following>>(`${certPath(certificationId)}/follow`, { method: 'PUT', body: JSON.stringify(input) })
}

export function unfollowCertification(request: AuthenticatedRequest, certificationId: string) {
  return request<null>(`${certPath(certificationId)}/follow`, { method: 'DELETE' })
}
