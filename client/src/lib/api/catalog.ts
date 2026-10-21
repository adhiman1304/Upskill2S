import type { AuthenticatedRequest } from './client'
import type { CatalogHitDto } from '../contracts'

export interface ResolveCertificationInput { provider: string; code: string; title: string; officialUrl?: string | null }

/** GET /api/catalog/search. An empty query returns the user's followed and recently researched certifications. */
export function searchCatalog(request: AuthenticatedRequest, query: string, init?: RequestInit) {
  return request<CatalogHitDto[]>(`/api/catalog/search?q=${encodeURIComponent(query.trim().slice(0, 100))}`, init)
}

/** POST /api/catalog/resolve: find-or-create by provider + code. */
export function resolveCertification(request: AuthenticatedRequest, input: ResolveCertificationInput) {
  return request<{ id: string }>('/api/catalog/resolve', { method: 'POST', body: JSON.stringify(input) })
}
