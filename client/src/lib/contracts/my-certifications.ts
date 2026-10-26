// Mirrors server/src/lib/contracts/my-certifications.ts (types only).
import type { FollowStatus, FreshnessStatus } from './brief'

export type MyCertificationSource = 'manual' | 'resume' | 'follow'
export interface MyCertificationDto {
  certificationId: string
  provider: string
  code: string
  title: string
  officialUrl: string | null
  status: FollowStatus
  /** YYYY-MM-DD */
  targetDate: string | null
  /** Derived from the row's updatedAt while PASSED. */
  passedAt: string | null
  source: MyCertificationSource
  /** Year earned, when an intake extracted it from a resume (Passed only). */
  yearObtained: number | null
  brief: { freshness: FreshnessStatus; generatedAt: string | null; checklistTotal: number; checklistDone: number } | null
  updatedAt: string
}
export interface MyCertificationsDto { studying: MyCertificationDto[]; planning: MyCertificationDto[]; passed: MyCertificationDto[] }
export interface MyCertificationBulkItem { provider: string; code: string; title: string; officialUrl?: string | null; status: FollowStatus }
