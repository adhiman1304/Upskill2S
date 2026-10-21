export type ResourceKind = 'QUESTION_SET' | 'RICH_TEXT' | 'LINK' | 'PDF'

export interface Resource {
  id: string; type: ResourceKind; title: string; content: string
  createdById: string; createdByName: string; createdAt: string
  topics: string[]; language: string; estimatedMinutes: number | null
  sourceName: string | null; sourceUrl: string | null; rightsConfirmed: boolean
  originalFileName: string | null; isReviewed: boolean; reviewedAt: string | null; isVisible: boolean
  fileSize: number | null
  isBookmarked: boolean; isHelpful: boolean; helpfulCount: number
  certification?: { id: string; title: string; provider: string; code: string }
}

export interface Certification {
  id: string; provider: string; code: string; title: string; description: string
  status: 'ACTIVE' | 'RETIRED'; examVersion: string | null; examUpdatedAt: string | null; topics: string[]
  createdById: string; createdByName: string; resourceCount: number
  resources: Resource[]; updatedAt: string
}

export interface CertificationInput { provider: string; code: string; title: string; description: string; status: 'ACTIVE' | 'RETIRED'; examVersion: string; examUpdatedAt: string | null }
export interface ResourceInput { type: ResourceKind; title: string; content: Record<string, unknown>; topics: string[]; language: string; estimatedMinutes: number | null; sourceName: string; sourceUrl: string; rightsConfirmed: boolean }
export interface ResourceReport { id: string; category: string; message: string; createdAt: string; reporterName: string; resource: Resource }
export type CommunityPostKind = 'IDEA' | 'QUESTION'
export interface CommunityComment { id: string; body: string; authorId: string; authorName: string; createdAt: string }
export interface CommunityPost { id: string; kind: CommunityPostKind; title: string; body: string; authorId: string; authorName: string; createdAt: string; commentCount: number; comments: CommunityComment[] }
export interface ContributionSummary {
  counts: { certifications: number; resources: number; ideas: number; questions: number; comments: number; helpfulReceived: number }
  badges: { id: string; label: string; detail: string }[]
  activity: { id: string; kind: string; title: string; detail: string; createdAt: string }[]
}
type AuthenticatedRequest = <T>(path: string, init?: RequestInit) => Promise<T>

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new ApiError(body.error ?? `Request failed (${response.status}).`, response.status)
  }
  if (response.status === 204) return undefined as T
  if (response.headers.get('content-type')?.includes('application/json')) return response.json() as Promise<T>
  return response.blob() as Promise<T>
}

export function getCertifications(request: AuthenticatedRequest, query: string) { return request<Certification[]>(`/api/certifications${query ? `?${query}` : ''}`) }
export function getCertification(request: AuthenticatedRequest, id: string) { return request<Certification>(`/api/certifications/${encodeURIComponent(id)}`) }
export function createCertification(request: AuthenticatedRequest, input: CertificationInput) { return request<Certification>('/api/certifications', { method: 'POST', body: JSON.stringify(input) }) }
export function updateCertification(request: AuthenticatedRequest, id: string, input: CertificationInput) { return request<Certification>(`/api/certifications/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }) }
export function createResource(request: AuthenticatedRequest, certificationId: string, input: ResourceInput) { return request<Resource>(`/api/certifications/${encodeURIComponent(certificationId)}/resources`, { method: 'POST', body: JSON.stringify(input) }) }
export function deleteResource(request: AuthenticatedRequest, resourceId: string) { return request<void>(`/api/resources/${encodeURIComponent(resourceId)}`, { method: 'DELETE' }) }
export function getBookmarks(request: AuthenticatedRequest) { return request<Resource[]>('/api/me/bookmarks') }
export function toggleBookmark(request: AuthenticatedRequest, resourceId: string) { return request<{ bookmarked: boolean }>(`/api/resources/${encodeURIComponent(resourceId)}/bookmark`, { method: 'POST' }) }
export function toggleHelpful(request: AuthenticatedRequest, resourceId: string) { return request<{ helpful: boolean; helpfulCount: number }>(`/api/resources/${encodeURIComponent(resourceId)}/helpful`, { method: 'POST' }) }
export function reportResource(request: AuthenticatedRequest, resourceId: string, category: string, message: string) { return request<{ id: string; status: string }>(`/api/resources/${encodeURIComponent(resourceId)}/reports`, { method: 'POST', body: JSON.stringify({ category, message }) }) }
export function getOpenReports(request: AuthenticatedRequest) { return request<ResourceReport[]>('/api/admin/reports') }
export function resolveReport(request: AuthenticatedRequest, id: string, status: 'RESOLVED' | 'DISMISSED') { return request<{ id: string; status: string }>(`/api/admin/reports/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) }) }
export function moderateResource(request: AuthenticatedRequest, id: string, input: { isVisible?: boolean; reviewed?: boolean }) { return request<Resource>(`/api/admin/resources/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }) }
export function getCommunityPosts(request: AuthenticatedRequest) { return request<CommunityPost[]>('/api/community/posts') }
export function createCommunityPost(request: AuthenticatedRequest, input: { kind: CommunityPostKind; title: string; body: string }) { return request<CommunityPost>('/api/community/posts', { method: 'POST', body: JSON.stringify(input) }) }
export function createCommunityComment(request: AuthenticatedRequest, postId: string, body: string) { return request<CommunityComment>(`/api/community/posts/${encodeURIComponent(postId)}/comments`, { method: 'POST', body: JSON.stringify({ body }) }) }
export function getContributionSummary(request: AuthenticatedRequest) { return request<ContributionSummary>('/api/me/contributions') }

export async function downloadResource(request: AuthenticatedRequest, resourceId: string) {
  const blob = await request<Blob>(`/api/resources/${encodeURIComponent(resourceId)}/file`)
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl; anchor.download = 'resource.pdf'; anchor.click()
  URL.revokeObjectURL(objectUrl)
}