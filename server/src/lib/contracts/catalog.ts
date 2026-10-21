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

// --- POST /api/catalog/identify (workstream F) --------------------------------------------------

/** Request body for POST /api/catalog/identify. */
export const identifyRequestSchema = z.object({
  query: z.string().trim().min(3).max(200),
})
export type IdentifyRequest = z.infer<typeof identifyRequestSchema>

export const identifyConfidenceSchema = z.enum(['high', 'medium', 'low'])
export type IdentifyConfidence = z.infer<typeof identifyConfidenceSchema>

/**
 * What the structuring model must return (strict, LLM-friendly: every key required, nullable instead of optional).
 * The server post-processes this into `IdentifyResult`.
 */
export const identifyModelOutputSchema = z.strictObject({
  candidates: z.array(z.strictObject({
    provider: z.string(),
    code: z.string(),
    title: z.string(),
    officialUrl: z.string().nullable(),
    note: z.string(),
    confidence: identifyConfidenceSchema,
    retired: z.boolean(),
    successorCode: z.string().nullable(),
  })).max(3),
})
export type IdentifyModelOutput = z.infer<typeof identifyModelOutputSchema>

export const identifyCandidateSchema = z.object({
  provider: z.string(),
  /** Official exam code, or a short slug when the vendor has none. Always passes the certification code regex, so it can go straight to /resolve. */
  code: z.string(),
  title: z.string(),
  /** HTTPS only; null when the model gave none or a non-HTTPS / blocked link. */
  officialUrl: z.string().nullable(),
  note: z.string(),
  confidence: identifyConfidenceSchema,
  retired: z.boolean(),
  successorCode: z.string().nullable(),
  /** Set when the candidate is already known: `certificationId` is the db row (navigate directly), or null for a catalog-only entry (call /resolve with `code`). */
  catalogMatch: z.object({ certificationId: z.string().nullable(), code: z.string() }).nullable(),
})
export type IdentifyCandidate = z.infer<typeof identifyCandidateSchema>

export const identifyResultSchema = z.object({
  query: z.string(),
  candidates: z.array(identifyCandidateSchema).max(3),
  searchedAt: z.string(),
  model: z.string(),
})
export type IdentifyResult = z.infer<typeof identifyResultSchema>
