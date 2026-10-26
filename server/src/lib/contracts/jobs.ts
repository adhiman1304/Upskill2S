import { z } from 'zod'

export const jobKindSchema = z.enum(['BRIEF', 'REFRESH', 'INTAKE'])
export type JobKind = z.infer<typeof jobKindSchema>

export const jobStatusSchema = z.enum(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'])
export type JobStatus = z.infer<typeof jobStatusSchema>

export const jobProgressEntrySchema = z.object({ at: z.string(), message: z.string() })
export type JobProgressEntry = z.infer<typeof jobProgressEntrySchema>

export const jobDtoSchema = z.object({
  id: z.string(),
  kind: jobKindSchema,
  status: jobStatusSchema,
  certificationId: z.string().nullable(),
  intakeSessionId: z.string().nullable(),
  resultBriefId: z.string().nullable(),
  progress: z.array(jobProgressEntrySchema),
  error: z.string().nullable(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
})
export type JobDto = z.infer<typeof jobDtoSchema>
