import { z } from 'zod'
import { followStatusSchema, freshnessStatusSchema } from './brief.js'

// Workstream M: GET/PUT/DELETE /api/me/certifications and POST /api/me/certifications/bulk.

/** How a follow row came to exist. Derived, not stored: see docs/handoff/M.md. */
export const myCertificationSourceSchema = z.enum(['manual', 'resume', 'follow'])
export type MyCertificationSource = z.infer<typeof myCertificationSourceSchema>

export const myCertificationDtoSchema = z.object({
  certificationId: z.string(),
  provider: z.string(),
  code: z.string(),
  title: z.string(),
  officialUrl: z.string().nullable(),
  status: followStatusSchema,
  /** YYYY-MM-DD or null. */
  targetDate: z.string().nullable(),
  /** ISO time; the row's updatedAt while status is PASSED (the schema has no passedAt column), else null. */
  passedAt: z.string().nullable(),
  source: myCertificationSourceSchema,
  /** Year the certification was earned, when an intake extracted it from a resume (PASSED rows only). */
  yearObtained: z.number().int().nullable(),
  brief: z.object({
    freshness: freshnessStatusSchema,
    generatedAt: z.string().nullable(),
    checklistTotal: z.number().int(),
    checklistDone: z.number().int(),
  }).nullable(),
  updatedAt: z.string(),
})
export type MyCertificationDto = z.infer<typeof myCertificationDtoSchema>

export const myCertificationsDtoSchema = z.object({
  studying: z.array(myCertificationDtoSchema),
  planning: z.array(myCertificationDtoSchema),
  passed: z.array(myCertificationDtoSchema),
})
export type MyCertificationsDto = z.infer<typeof myCertificationsDtoSchema>

/** PUT /api/me/certifications/:certificationId */
export const myCertificationUpdateSchema = z.object({
  status: followStatusSchema,
  targetDate: z.iso.date().nullable().optional(),
})
export type MyCertificationUpdate = z.infer<typeof myCertificationUpdateSchema>

/** POST /api/me/certifications/bulk */
export const myCertificationBulkItemSchema = z.object({
  provider: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(160),
  officialUrl: z.string().trim().max(2048).nullable().optional(),
  status: followStatusSchema,
})
export const myCertificationBulkSchema = z.object({ items: z.array(myCertificationBulkItemSchema).min(1).max(25) })
export type MyCertificationBulkItem = z.infer<typeof myCertificationBulkItemSchema>
export type MyCertificationBulk = z.infer<typeof myCertificationBulkSchema>
