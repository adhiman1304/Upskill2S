import { ApiError } from '../../lib/api'
import type { ResourceKind } from '../../lib/api'

export const labels: Record<ResourceKind, string> = { QUESTION_SET: 'Question set', RICH_TEXT: 'Study notes', LINK: 'Link', PDF: 'PDF' }

export function parseResourceContent(value: string): Record<string, unknown> { try { return JSON.parse(value) as Record<string, unknown> } catch { return {} } }

export function message(error: unknown, fallback: string) { return error instanceof ApiError || error instanceof Error ? error.message : fallback }
export function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Recently' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date) }
