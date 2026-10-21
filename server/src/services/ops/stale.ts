import { config } from '../../config.js'
import { prisma } from '../../database.js'

const DAY_MS = 24 * 60 * 60 * 1000
const ACTIVE_STATUSES = ['QUEUED', 'RUNNING']

export interface StaleCertification {
  certificationId: string
  provider: string
  code: string
  title: string
  followers: number
  /** `stale`: the CURRENT brief is older than `BRIEF_STALE_DAYS`; `missing`: followed but no brief yet. */
  reason: 'stale' | 'missing'
  briefId: string | null
  briefGeneratedAt: string | null
  briefAgeDays: number | null
}

export function staleCutoff(now = new Date()): Date {
  return new Date(now.getTime() - config.briefStaleDays * DAY_MS)
}

/**
 * Certifications whose CURRENT brief is older than `config.briefStaleDays`, plus followed certifications
 * with no brief at all. Certifications with a QUEUED or RUNNING job are excluded. Sorted by follower count
 * (desc), then missing briefs first, then oldest brief first.
 */
export async function findStaleCertifications(options: { onlyFollowed?: boolean; limit?: number } = {}): Promise<StaleCertification[]> {
  const { onlyFollowed = false, limit = 50 } = options
  const now = new Date()
  const cutoff = staleCutoff(now)
  const rows = await prisma.certification.findMany({
    where: {
      OR: [
        { studyBriefs: { some: { status: 'CURRENT', generatedAt: { lt: cutoff } } } },
        { followers: { some: {} }, studyBriefs: { none: { status: 'CURRENT' } } },
      ],
      ...(onlyFollowed ? { followers: { some: {} } } : {}),
      researchJobs: { none: { status: { in: ACTIVE_STATUSES } } },
    },
    select: {
      id: true,
      provider: true,
      code: true,
      title: true,
      _count: { select: { followers: true } },
      studyBriefs: { where: { status: 'CURRENT' }, orderBy: { version: 'desc' }, take: 1, select: { id: true, generatedAt: true } },
    },
    take: 1000,
  })

  const items = rows.map((row): StaleCertification => {
    const brief = row.studyBriefs[0] ?? null
    return {
      certificationId: row.id,
      provider: row.provider,
      code: row.code,
      title: row.title,
      followers: row._count.followers,
      reason: brief ? 'stale' : 'missing',
      briefId: brief?.id ?? null,
      briefGeneratedAt: brief?.generatedAt.toISOString() ?? null,
      briefAgeDays: brief ? Math.floor((now.getTime() - brief.generatedAt.getTime()) / DAY_MS) : null,
    }
  })

  items.sort((a, b) => (b.followers - a.followers) || ((b.briefAgeDays ?? Infinity) - (a.briefAgeDays ?? Infinity)) || a.code.localeCompare(b.code))
  return items.slice(0, Math.max(0, limit))
}
