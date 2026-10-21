// Workstream M: /api/me/certifications. Each function takes the authenticated `request` from `useApi()` first.
import type { AuthenticatedRequest } from './client'
import type { FollowStatus, MyCertificationBulkItem, MyCertificationsDto } from '../contracts'

const base = '/api/me/certifications'

export function listMyCertifications(request: AuthenticatedRequest) {
  return request<MyCertificationsDto>(base)
}

/** Upserts the follow row; `targetDate` undefined keeps the stored date. Returns the regrouped list. */
export function setMyCertification(request: AuthenticatedRequest, certificationId: string, input: { status: FollowStatus; targetDate?: string | null }) {
  return request<MyCertificationsDto>(`${base}/${encodeURIComponent(certificationId)}`, { method: 'PUT', body: JSON.stringify(input) })
}

export function removeMyCertification(request: AuthenticatedRequest, certificationId: string) {
  return request<MyCertificationsDto>(`${base}/${encodeURIComponent(certificationId)}`, { method: 'DELETE' })
}

/** Find-or-creates each certification and saves it with its status. 400 INVALID_REQUEST for a bad code. */
export function saveMyCertifications(request: AuthenticatedRequest, items: MyCertificationBulkItem[]) {
  return request<MyCertificationsDto>(`${base}/bulk`, { method: 'POST', body: JSON.stringify({ items }) })
}
