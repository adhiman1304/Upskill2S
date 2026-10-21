import type { ApiErrorCode } from '../contracts'

export type AuthenticatedRequest = <T>(path: string, init?: RequestInit) => Promise<T>

export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number
  readonly code?: ApiErrorCode

  constructor(message: string, status: number, code?: ApiErrorCode) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string; code?: string }
    throw new ApiError(body.error ?? `Request failed (${response.status}).`, response.status, typeof body.code === 'string' ? body.code as ApiErrorCode : undefined)
  }
  if (response.status === 204) return undefined as T
  if (response.headers.get('content-type')?.includes('application/json')) return response.json() as Promise<T>
  return response.blob() as Promise<T>
}
