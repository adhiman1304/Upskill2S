import type { AuthenticatedRequest } from './client'
import type { CatalogHitDto, IdentifyResult } from '../contracts'

export interface ResolveCertificationInput { provider: string; code: string; title: string; officialUrl?: string | null }

/** GET /api/catalog/search. An empty query returns the user's followed and recently researched certifications. */
export function searchCatalog(request: AuthenticatedRequest, query: string, init?: RequestInit) {
  return request<CatalogHitDto[]>(`/api/catalog/search?q=${encodeURIComponent(query.trim().slice(0, 100))}`, init)
}

/** POST /api/catalog/resolve: find-or-create by provider + code. */
export function resolveCertification(request: AuthenticatedRequest, input: ResolveCertificationInput) {
  return request<{ id: string }>('/api/catalog/resolve', { method: 'POST', body: JSON.stringify(input) })
}

/** POST /api/catalog/identify: asks the agent to identify a certification from free text (3 to 200 chars). Can take up to a minute.
 * Errors: 412 OPENAI_KEY_MISSING, 429 RATE_LIMITED, 400 bad query. */
export function identifyCertification(request: AuthenticatedRequest, query: string, init?: RequestInit) {
  return request<IdentifyResult>('/api/catalog/identify', { ...init, method: 'POST', body: JSON.stringify({ query: query.trim().slice(0, 200) }) })
}
