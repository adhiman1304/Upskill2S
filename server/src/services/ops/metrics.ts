import { prisma } from '../../database.js'
import { jobKindSchema, jobStatusSchema, type JobKind, type JobStatus } from '../../lib/contracts/index.js'
import { getSchedulerStatus, type SchedulerStatus } from '../scheduler/index.js'
import { staleCutoff } from './stale.js'

const DAY_MS = 24 * 60 * 60 * 1000

export interface TokenTotals { input: number; output: number }

export interface OpsSummary {
  generatedAt: string
  briefs: { total: number; fresh: number; stale: number; certificationsWithoutBrief: number; followedWithoutBrief: number; staleAfterDays: number }
  jobs: { last24h: Record<JobStatus, number> & { total: number } }
  tokens: { last7Days: TokenTotals & { jobs: number }; byKind: Record<JobKind, TokenTotals & { jobs: number }> }
  scheduler: SchedulerStatus
  followers: { total: number; certifications: number }
}

function emptyStatusCounts(): Record<JobStatus, number> {
  return Object.fromEntries(jobStatusSchema.options.map((status) => [status, 0])) as Record<JobStatus, number>
}

function emptyKindTotals(): Record<JobKind, TokenTotals & { jobs: number }> {
  return Object.fromEntries(jobKindSchema.options.map((kind) => [kind, { input: 0, output: 0, jobs: 0 }])) as Record<JobKind, TokenTotals & { jobs: number }>
}

export async function getOpsSummary(): Promise<OpsSummary> {
  const now = new Date()
  const cutoff = staleCutoff(now)
  const dayAgo = new Date(now.getTime() - DAY_MS)
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS)

  const [briefTotal, briefFresh, withoutBrief, followedWithoutBrief, jobsByStatus, tokensByKind, followerTotal, followedCertifications] = await Promise.all([
    prisma.studyBrief.count({ where: { status: 'CURRENT' } }),
    prisma.studyBrief.count({ where: { status: 'CURRENT', generatedAt: { gte: cutoff } } }),
    prisma.certification.count({ where: { studyBriefs: { none: { status: 'CURRENT' } } } }),
    prisma.certification.count({ where: { followers: { some: {} }, studyBriefs: { none: { status: 'CURRENT' } } } }),
    prisma.researchJob.groupBy({ by: ['status'], where: { createdAt: { gte: dayAgo } }, _count: { _all: true } }),
    prisma.researchJob.groupBy({ by: ['kind'], where: { finishedAt: { gte: weekAgo } }, _sum: { inputTokens: true, outputTokens: true }, _count: { _all: true } }),
    prisma.userCertification.count(),
    prisma.certification.count({ where: { followers: { some: {} } } }),
  ])

  const last24h = emptyStatusCounts()
  let jobTotal = 0
  for (const row of jobsByStatus) {
    const status = jobStatusSchema.safeParse(row.status)
    if (status.success) last24h[status.data] += row._count._all
    jobTotal += row._count._all
  }

  const byKind = emptyKindTotals()
  const last7Days = { input: 0, output: 0, jobs: 0 }
  for (const row of tokensByKind) {
    const input = row._sum.inputTokens ?? 0
    const output = row._sum.outputTokens ?? 0
    const kind = jobKindSchema.safeParse(row.kind)
    if (kind.success) byKind[kind.data] = { input, output, jobs: row._count._all }
    last7Days.input += input
    last7Days.output += output
    last7Days.jobs += row._count._all
  }

  return {
    generatedAt: now.toISOString(),
    briefs: { total: briefTotal, fresh: briefFresh, stale: briefTotal - briefFresh, certificationsWithoutBrief: withoutBrief, followedWithoutBrief, staleAfterDays: Math.round((now.getTime() - cutoff.getTime()) / DAY_MS) },
    jobs: { last24h: { ...last24h, total: jobTotal } },
    tokens: { last7Days, byKind },
    scheduler: getSchedulerStatus(),
    followers: { total: followerTotal, certifications: followedCertifications },
  }
}
