import type { AuthenticatedRequest } from './client'
import type { IntakeSessionDto } from '../contracts'

/** POST /api/intake (multipart). Field `text` plus up to 3 files in `files[]`. Responds 202 with the queued session. */
export function createIntake(request: AuthenticatedRequest, input: { text: string; files: File[] }) {
  const body = new FormData()
  body.append('text', input.text)
  for (const file of input.files) body.append('files[]', file, file.name)
  return request<IntakeSessionDto>('/api/intake', { method: 'POST', body })
}

export function getIntake(request: AuthenticatedRequest, id: string) {
  return request<IntakeSessionDto>(`/api/intake/${encodeURIComponent(id)}`)
}

export function listMyIntakes(request: AuthenticatedRequest) {
  return request<IntakeSessionDto[]>('/api/me/intake')
}

export function selectRecommendation(request: AuthenticatedRequest, id: string, recommendationIndex: number) {
  return request<{ certificationId: string }>(`/api/intake/${encodeURIComponent(id)}/select`, { method: 'POST', body: JSON.stringify({ recommendationIndex }) })
}

/** POST /api/intake/:id/held: saves the chosen held certifications as Passed; returns the session with them marked `saved`. */
export function saveHeldCertifications(request: AuthenticatedRequest, id: string, indexes: number[]) {
  return request<IntakeSessionDto>(`/api/intake/${encodeURIComponent(id)}/held`, { method: 'POST', body: JSON.stringify({ indexes }) })
}
