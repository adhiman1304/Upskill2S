import { z } from 'zod'

// IntakeResult is also an LLM output contract (workstream C), so it follows the
// same JSON-Schema friendly rules as studyBriefContentSchema.

export const intakeLevelSchema = z.enum(['fundamental', 'associate', 'professional', 'specialty', 'expert', 'unknown'])

export const intakeRecommendationSchema = z.strictObject({
  rank: z.number().int().min(1).max(100),
  provider: z.string(),
  code: z.string(),
  title: z.string(),
  officialUrl: z.string().nullable(),
  level: intakeLevelSchema,
  whyFit: z.string(),
  prerequisites: z.array(z.string()),
  estimatedPrepWeeks: z.number().int().min(0).max(520).nullable(),
  matchedSignals: z.array(z.string()),
})
export type IntakeRecommendation = z.infer<typeof intakeRecommendationSchema>

export const intakeResultSchema = z.strictObject({
  profileSummary: z.string(),
  detectedSkills: z.array(z.string()),
  goals: z.array(z.string()),
  recommendations: z.array(intakeRecommendationSchema),
  followUpQuestions: z.array(z.string()),
})
export type IntakeResult = z.infer<typeof intakeResultSchema>

export const intakeAttachmentSchema = z.object({ name: z.string(), mimeType: z.string(), size: z.number().int(), chars: z.number().int() })
export type IntakeAttachment = z.infer<typeof intakeAttachmentSchema>

export const intakeStatusSchema = z.enum(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED'])
export type IntakeStatus = z.infer<typeof intakeStatusSchema>

export const intakeSessionDtoSchema = z.object({
  id: z.string(),
  status: intakeStatusSchema,
  inputText: z.string(),
  attachments: z.array(intakeAttachmentSchema),
  result: intakeResultSchema.nullable(),
  error: z.string().nullable(),
  jobId: z.string().nullable(),
  createdAt: z.string(),
})
export type IntakeSessionDto = z.infer<typeof intakeSessionDtoSchema>
