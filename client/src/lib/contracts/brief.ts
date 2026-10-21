// Mirrors docs/AI_REWORK_PLAN.md sections 5.1 and 5.2 (types only; the server owns the zod schemas).
import type { JobDto } from './jobs'

export type SourceKind = 'official' | 'community' | 'video' | 'forum' | 'blog' | 'course' | 'other'
export interface BriefSource { id: string; url: string; title: string; publisher: string | null; kind: SourceKind; retrievedAt: string; snippet: string | null }
export interface SkillArea { id: string; title: string; weightPercent: number | null; subtopics: string[]; sourceIds: string[] }
export interface LearningPathItem { id: string; title: string; url: string; type: 'learning_path' | 'module' | 'docs' | 'practice_assessment' | 'instructor_led' | 'exam_sandbox' | 'other'; estimatedMinutes: number | null; notes: string | null; sourceIds: string[] }
export interface CommunityResource { id: string; title: string; url: string; kind: 'video' | 'course' | 'blog' | 'practice_questions' | 'github' | 'podcast' | 'forum' | 'other'; author: string | null; publishedAt: string | null; whyRecommended: string; sourceIds: string[] }
export interface KnownGap { id: string; title: string; detail: string; recommendation: string; confidence: 'high' | 'medium' | 'low'; sourceIds: string[] }
export type ChecklistPhase = 'orient' | 'learn' | 'practice' | 'review' | 'exam_day'
export interface ChecklistItem { id: string; order: number; phase: ChecklistPhase; title: string; detail: string; estimatedMinutes: number | null; links: { label: string; url: string }[]; sourceIds: string[] }
export interface StudyBriefContent {
  certification: { provider: string; code: string; title: string; officialUrl: string | null; examVersion: string | null; lastOfficialUpdate: string | null; retirementNotice: string | null }
  summary: string
  examFormat: { durationMinutes: number | null; questionCount: string | null; passingScore: string | null; cost: string | null; languages: string[]; deliveryOptions: string[]; notes: string | null }
  skillsMeasured: SkillArea[]
  officialLearningPath: LearningPathItem[]
  communityResources: CommunityResource[]
  knownGaps: KnownGap[]
  checklist: ChecklistItem[]
  warnings: string[]
  sources: BriefSource[]
}

export interface StudyBriefDto { id: string; certificationId: string; version: number; status: 'CURRENT' | 'SUPERSEDED'; model: string; sourceCount: number; generatedAt: string; content: StudyBriefContent }
export type FreshnessStatus = 'fresh' | 'stale' | 'missing'
/** One row of GET /certifications/:id/brief/versions (newest first). */
export type BriefVersionSummary = Omit<StudyBriefDto, 'certificationId' | 'content'>
/** Star recommends an item; report flags a problem (needs a reason and a 3 to 500 character comment). */
export type FeedbackVerdict = 'star' | 'report'
export type FeedbackReportReason = 'wrong' | 'outdated' | 'broken_link' | 'other'
export interface FeedbackSummary { stars: number; reports: number; mine: FeedbackVerdict | null }
export type FeedbackItemType = 'brief' | 'checklist' | 'gap' | 'resource' | 'skill' | 'learning_path'
export type FollowStatus = 'PLANNING' | 'STUDYING' | 'PASSED'
export interface BriefPageDto {
  certification: { id: string; provider: string; code: string; title: string; officialUrl: string | null; status: string }
  brief: StudyBriefDto | null
  freshness: { status: FreshnessStatus; generatedAt: string | null; staleAfterDays: number; ageDays: number | null }
  activeJob: JobDto | null
  progress: { completedItemIds: string[] }
  feedback: Record<string, FeedbackSummary> // key `${itemType}:${itemId}`
  following: { status: FollowStatus; targetDate: string | null } | null
}
