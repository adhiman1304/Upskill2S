// Mirrors docs/AI_REWORK_PLAN.md section 5.2 (types only).
import type { FollowStatus, FreshnessStatus } from './brief'

export interface CatalogHitDto { certificationId: string | null; provider: string; code: string; title: string; officialUrl: string | null; source: 'db' | 'catalog'; briefStatus: FreshnessStatus; lastResearchedAt: string | null; following: { status: FollowStatus } | null }

/** One certification the identify agent found on the web for a free-text query. `catalogMatch.certificationId` is set when it already exists in the database. */
export interface IdentifyCandidate { provider: string; code: string; title: string; officialUrl: string | null; note: string; confidence: 'high' | 'medium' | 'low'; retired: boolean; successorCode: string | null; catalogMatch: { certificationId: string | null; code: string } | null }
export interface IdentifyResult { query: string; candidates: IdentifyCandidate[]; searchedAt: string; model: string }
