// Mirrors docs/AI_REWORK_PLAN.md section 5.2 (types only).
import type { FollowStatus, FreshnessStatus } from './brief'

export interface CatalogHitDto { certificationId: string | null; provider: string; code: string; title: string; officialUrl: string | null; source: 'db' | 'catalog'; briefStatus: FreshnessStatus; lastResearchedAt: string | null; following: { status: FollowStatus } | null }
