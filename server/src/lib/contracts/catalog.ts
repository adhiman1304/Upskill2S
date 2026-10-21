import { z } from 'zod'
import { followStatusSchema, freshnessStatusSchema } from './brief.js'

export const catalogHitDtoSchema = z.object({
  certificationId: z.string().nullable(),
  provider: z.string(),
  code: z.string(),
  title: z.string(),
  officialUrl: z.string().nullable(),
  source: z.enum(['db', 'catalog']),
  briefStatus: freshnessStatusSchema,
  lastResearchedAt: z.string().nullable(),
  /** The requesting user's follow of this certification (always null for catalog-only hits). */
  following: z.object({ status: followStatusSchema }).nullable(),
})
export type CatalogHitDto = z.infer<typeof catalogHitDtoSchema>

/** Shape of one entry in prisma/seed/catalog.json. */
export const catalogSeedEntrySchema = z.object({
  provider: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(160),
  officialUrl: z.string().nullable(),
  aliases: z.array(z.string()),
})
export type CatalogSeedEntry = z.infer<typeof catalogSeedEntrySchema>

/** Input for resolveCertification / POST /api/catalog/resolve. */
export const resolveCertificationInputSchema = z.object({
  provider: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(160),
  officialUrl: z.string().trim().max(2048).nullable().optional(),
})
export type ResolveCertificationInput = z.infer<typeof resolveCertificationInputSchema>
