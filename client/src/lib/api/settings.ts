import type { AuthenticatedRequest } from './client'
import type { OpenAiKeyStatusDto } from '../contracts'

export function getOpenAiKeyStatus(request: AuthenticatedRequest) {
  return request<OpenAiKeyStatusDto>('/api/settings/openai-key')
}

/** Validates the key against OpenAI before storing it. Rejects with ApiError code OPENAI_KEY_INVALID. */
export function saveOpenAiKey(request: AuthenticatedRequest, apiKey: string) {
  return request<OpenAiKeyStatusDto>('/api/settings/openai-key', { method: 'PUT', body: JSON.stringify({ apiKey }) })
}

export function deleteOpenAiKey(request: AuthenticatedRequest) {
  return request<void>('/api/settings/openai-key', { method: 'DELETE' })
}
