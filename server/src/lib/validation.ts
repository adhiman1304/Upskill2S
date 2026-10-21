import sanitizeHtml from 'sanitize-html'
import { z } from 'zod'

export const certificationSchema = z.object({
  provider: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).default(''),
  status: z.enum(['ACTIVE', 'RETIRED']).default('ACTIVE'),
  examVersion: z.string().trim().max(80).default(''),
  examUpdatedAt: z.string().datetime().nullable().default(null),
})

const questionSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  answer: z.string().trim().max(4000).default(''),
  explanation: z.string().trim().max(4000).default(''),
})

export const resourceMetadataSchema = z.object({
  topics: z.array(z.string().trim().min(1).max(32)).max(10).default([]),
  language: z.string().trim().min(2).max(15).default('en'),
  estimatedMinutes: z.preprocess((value) => value === '' || value === null ? undefined : Number(value), z.number().int().min(1).max(1000).optional()),
  sourceName: z.string().trim().max(120).default(''),
  sourceUrl: z.string().trim().max(2048).default(''),
  rightsConfirmed: z.boolean().default(false),
}).superRefine((value, context) => {
  if (value.sourceUrl) {
    try {
      if (new URL(value.sourceUrl).protocol !== 'https:') throw new Error()
    } catch {
      context.addIssue({ code: 'custom', path: ['sourceUrl'], message: 'Source URLs must use HTTPS.' })
    }
  }
})

export const resourceSchema = resourceMetadataSchema.extend({
  type: z.enum(['QUESTION_SET', 'RICH_TEXT', 'LINK']),
  title: z.string().trim().min(1).max(120),
  content: z.record(z.string(), z.unknown()),
})

export function validateResourceContent(type: 'QUESTION_SET' | 'RICH_TEXT' | 'LINK', content: Record<string, unknown>, rightsConfirmed: boolean) {
  if (type === 'QUESTION_SET') {
    if (!rightsConfirmed) throw new Error('Confirm that you created these questions or have permission to share them.')
    const parsed = z.object({ questions: z.array(questionSchema).min(1).max(100) }).safeParse(content)
    if (!parsed.success) throw new Error('Add at least one valid study question.')
    return JSON.stringify(parsed.data)
  }

  if (type === 'RICH_TEXT') {
    const parsed = z.object({ html: z.string().max(30000) }).safeParse(content)
    if (!parsed.success) throw new Error('Study notes are invalid or too long.')
    return JSON.stringify({ html: sanitizeHtml(parsed.data.html, {
      allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'a', 'code', 'pre'],
      allowedAttributes: { a: ['href', 'target', 'rel'] },
      allowedSchemes: ['https'],
    }) })
  }

  const parsed = z.object({ url: z.string().url().max(2048) }).safeParse(content)
  if (!parsed.success || new URL(parsed.data.url).protocol !== 'https:') {
    throw new Error('Resource links must use HTTPS.')
  }
  return JSON.stringify(parsed.data)
}

export const resourceReportSchema = z.object({
  category: z.enum(['BROKEN_LINK', 'OUTDATED', 'INCORRECT', 'RIGHTS_CONCERN', 'OTHER']),
  message: z.string().trim().max(1000).default(''),
})

export const communityPostSchema = z.object({
  kind: z.enum(['IDEA', 'QUESTION']),
  title: z.string().trim().min(5).max(120),
  body: z.string().trim().min(1).max(4000),
})

export const communityCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
})

export function normalizeKey(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase('en-US')
}