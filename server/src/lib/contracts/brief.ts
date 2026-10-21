import { z } from 'zod'
import { jobDtoSchema } from './jobs.js'

// StudyBriefContent (plan section 5.1). The raw `studyBriefContentSchema` is kept
// JSON-Schema friendly (strict objects, every key required, nullable instead of
// optional, no transforms/refinements, no string formats or length limits) so
// workstream A can derive an OpenAI strict JSON schema from it. Cross-field rules
// live in `validateBriefContent`.

/** Stable kebab-case slug, e.g. `review-skills-outline`. */
export const slugIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const sourceIdsSchema = z.array(slugIdSchema)

export const sourceKindSchema = z.enum(['official', 'community', 'video', 'forum', 'blog', 'course', 'other'])

export const briefSourceSchema = z.strictObject({
  id: slugIdSchema,
  url: z.string(),
  title: z.string(),
  publisher: z.string().nullable(),
  kind: sourceKindSchema,
  retrievedAt: z.string(),
  snippet: z.string().nullable(),
})

export const skillAreaSchema = z.strictObject({
  id: slugIdSchema,
  title: z.string(),
  weightPercent: z.number().min(0).max(100).nullable(),
  subtopics: z.array(z.string()),
  sourceIds: sourceIdsSchema,
})

export const learningPathItemTypeSchema = z.enum(['learning_path', 'module', 'docs', 'practice_assessment', 'instructor_led', 'exam_sandbox', 'other'])

export const learningPathItemSchema = z.strictObject({
  id: slugIdSchema,
  title: z.string(),
  url: z.string(),
  type: learningPathItemTypeSchema,
  estimatedMinutes: z.number().int().min(0).max(100000).nullable(),
  notes: z.string().nullable(),
  sourceIds: sourceIdsSchema,
})

export const communityResourceKindSchema = z.enum(['video', 'course', 'blog', 'practice_questions', 'github', 'podcast', 'forum', 'other'])

export const communityResourceSchema = z.strictObject({
  id: slugIdSchema,
  title: z.string(),
  url: z.string(),
  kind: communityResourceKindSchema,
  author: z.string().nullable(),
  publishedAt: z.string().nullable(),
  whyRecommended: z.string(),
  sourceIds: sourceIdsSchema,
})

export const confidenceSchema = z.enum(['high', 'medium', 'low'])

export const knownGapSchema = z.strictObject({
  id: slugIdSchema,
  title: z.string(),
  detail: z.string(),
  recommendation: z.string(),
  confidence: confidenceSchema,
  sourceIds: sourceIdsSchema,
})

export const checklistPhaseSchema = z.enum(['orient', 'learn', 'practice', 'review', 'exam_day'])

export const checklistLinkSchema = z.strictObject({ label: z.string(), url: z.string() })

export const checklistItemSchema = z.strictObject({
  id: slugIdSchema,
  order: z.number().int().min(0).max(1000),
  phase: checklistPhaseSchema,
  title: z.string(),
  detail: z.string(),
  estimatedMinutes: z.number().int().min(0).max(100000).nullable(),
  links: z.array(checklistLinkSchema),
  sourceIds: sourceIdsSchema,
})

export const briefCertificationSchema = z.strictObject({
  provider: z.string(),
  code: z.string(),
  title: z.string(),
  officialUrl: z.string().nullable(),
  examVersion: z.string().nullable(),
  lastOfficialUpdate: z.string().nullable(),
  retirementNotice: z.string().nullable(),
})

export const examFormatSchema = z.strictObject({
  durationMinutes: z.number().int().min(0).max(10000).nullable(),
  questionCount: z.string().nullable(),
  passingScore: z.string().nullable(),
  cost: z.string().nullable(),
  languages: z.array(z.string()),
  deliveryOptions: z.array(z.string()),
  notes: z.string().nullable(),
})

export const studyBriefContentSchema = z.strictObject({
  certification: briefCertificationSchema,
  summary: z.string(),
  examFormat: examFormatSchema,
  skillsMeasured: z.array(skillAreaSchema),
  officialLearningPath: z.array(learningPathItemSchema),
  communityResources: z.array(communityResourceSchema),
  knownGaps: z.array(knownGapSchema),
  checklist: z.array(checklistItemSchema).min(10).max(25),
  warnings: z.array(z.string()),
  sources: z.array(briefSourceSchema),
})

export type SourceKind = z.infer<typeof sourceKindSchema>
export type BriefSource = z.infer<typeof briefSourceSchema>
export type SkillArea = z.infer<typeof skillAreaSchema>
export type LearningPathItem = z.infer<typeof learningPathItemSchema>
export type CommunityResource = z.infer<typeof communityResourceSchema>
export type KnownGap = z.infer<typeof knownGapSchema>
export type ChecklistPhase = z.infer<typeof checklistPhaseSchema>
export type ChecklistItem = z.infer<typeof checklistItemSchema>
export type StudyBriefContent = z.infer<typeof studyBriefContentSchema>

function isHttpsUrl(value: string) {
  try { return new URL(value).protocol === 'https:' } catch { return false }
}

/** Raw schema plus cross-field rules: sourceIds resolve, ids unique per section, links are HTTPS. */
export const validatedStudyBriefContentSchema = studyBriefContentSchema.superRefine((content, context) => {
  const sourceIds = new Set(content.sources.map((source) => source.id))
  const issue = (path: (string | number)[], message: string) => context.addIssue({ code: 'custom', path, message })

  if (sourceIds.size !== content.sources.length) issue(['sources'], 'Source ids must be unique.')
  content.sources.forEach((source, index) => { if (!isHttpsUrl(source.url)) issue(['sources', index, 'url'], 'Source URLs must use HTTPS.') })
  if (content.certification.officialUrl !== null && !isHttpsUrl(content.certification.officialUrl)) issue(['certification', 'officialUrl'], 'Official URL must use HTTPS.')

  const sections = ['skillsMeasured', 'officialLearningPath', 'communityResources', 'knownGaps', 'checklist'] as const
  for (const section of sections) {
    const items: { id: string; sourceIds: string[]; url?: string; links?: { url: string }[] }[] = content[section]
    const seen = new Set<string>()
    items.forEach((item, index) => {
      if (seen.has(item.id)) issue([section, index, 'id'], `Duplicate id "${item.id}" in ${section}.`)
      seen.add(item.id)
      item.sourceIds.forEach((sourceId, sourceIndex) => {
        if (!sourceIds.has(sourceId)) issue([section, index, 'sourceIds', sourceIndex], `Unknown source id "${sourceId}".`)
      })
      if (item.url !== undefined && !isHttpsUrl(item.url)) issue([section, index, 'url'], 'Links must use HTTPS.')
      item.links?.forEach((link, linkIndex) => { if (!isHttpsUrl(link.url)) issue([section, index, 'links', linkIndex, 'url'], 'Links must use HTTPS.') })
    })
  }
})

export function validateBriefContent(content: unknown) {
  return validatedStudyBriefContentSchema.safeParse(content)
}

// DTOs (plan section 5.2)

export const freshnessStatusSchema = z.enum(['fresh', 'stale', 'missing'])
export type FreshnessStatus = z.infer<typeof freshnessStatusSchema>

export const studyBriefDtoSchema = z.object({
  id: z.string(),
  certificationId: z.string(),
  version: z.number().int(),
  status: z.enum(['CURRENT', 'SUPERSEDED']),
  model: z.string(),
  sourceCount: z.number().int(),
  generatedAt: z.string(),
  content: studyBriefContentSchema,
})
export type StudyBriefDto = z.infer<typeof studyBriefDtoSchema>

export const feedbackVerdictSchema = z.enum(['accurate', 'inaccurate', 'outdated'])
export type FeedbackVerdict = z.infer<typeof feedbackVerdictSchema>
export const feedbackItemTypeSchema = z.enum(['brief', 'checklist', 'gap', 'resource', 'skill', 'learning_path'])
export type FeedbackItemType = z.infer<typeof feedbackItemTypeSchema>
export const followStatusSchema = z.enum(['PLANNING', 'STUDYING', 'PASSED'])
export type FollowStatus = z.infer<typeof followStatusSchema>

export const briefPageDtoSchema = z.object({
  certification: z.object({ id: z.string(), provider: z.string(), code: z.string(), title: z.string(), officialUrl: z.string().nullable(), status: z.string() }),
  brief: studyBriefDtoSchema.nullable(),
  freshness: z.object({ status: freshnessStatusSchema, generatedAt: z.string().nullable(), staleAfterDays: z.number().int(), ageDays: z.number().nullable() }),
  activeJob: jobDtoSchema.nullable(),
  progress: z.object({ completedItemIds: z.array(z.string()) }),
  /** Keyed by `${itemType}:${itemId}`. */
  feedback: z.record(z.string(), z.object({ accurate: z.number().int(), inaccurate: z.number().int(), outdated: z.number().int(), mine: feedbackVerdictSchema.nullable() })),
  following: z.object({ status: followStatusSchema, targetDate: z.string().nullable() }).nullable(),
})
export type BriefPageDto = z.infer<typeof briefPageDtoSchema>
