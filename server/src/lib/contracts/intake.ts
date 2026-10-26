import { z } from 'zod'

// intakeModelOutputSchema is an LLM output contract (workstream C, extended by M), so it follows the
// same JSON-Schema friendly rules as studyBriefContentSchema. intakeResultSchema is the stored/returned shape.

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

/** A certification the person already holds, as the model extracts it (strict, LLM-friendly). */
export const intakeModelHeldCertificationSchema = z.strictObject({
  provider: z.string(),
  code: z.string(),
  title: z.string(),
  yearObtained: z.number().int().min(1950).max(2100).nullable(),
  evidence: z.string(),
})

/** What the intake model must return. The server post-processes it into `IntakeResult`. */
export const intakeModelOutputSchema = z.strictObject({
  profileSummary: z.string(),
  detectedSkills: z.array(z.string()),
  goals: z.array(z.string()),
  heldCertifications: z.array(intakeModelHeldCertificationSchema),
  recommendations: z.array(intakeRecommendationSchema),
  followUpQuestions: z.array(z.string()),
})
export type IntakeModelOutput = z.infer<typeof intakeModelOutputSchema>

/** A held certification after post-processing (workstream M). */
export const heldCertificationSchema = z.object({
  provider: z.string(),
  /** Always passes the certification code regex, so it can go straight to find-or-create. */
  code: z.string(),
  title: z.string(),
  yearObtained: z.number().int().nullable(),
  /** Short quote from the text or documents that shows the person holds it. */
  evidence: z.string(),
  /** Set when the certification is known: `certificationId` is the db row, or null for a catalog-only entry. */
  catalogMatch: z.object({ certificationId: z.string().nullable(), code: z.string() }).nullable(),
  /** True once saved to My certifications through POST /api/intake/:id/held. */
  saved: z.boolean().default(false),
})
export type HeldCertification = z.infer<typeof heldCertificationSchema>

/** Stored and returned intake result. Results stored before workstream M have no `heldCertifications`; they parse as []. */
export const intakeResultSchema = z.object({
  profileSummary: z.string(),
  detectedSkills: z.array(z.string()),
  goals: z.array(z.string()),
  heldCertifications: z.array(heldCertificationSchema).default([]),
  recommendations: z.array(intakeRecommendationSchema),
  followUpQuestions: z.array(z.string()),
})
export type IntakeResult = z.infer<typeof intakeResultSchema>

/** POST /api/intake/:id/held */
export const saveHeldRequestSchema = z.object({ indexes: z.array(z.number().int().min(0).max(50)).min(1).max(25) })

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
