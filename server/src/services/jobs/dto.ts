import type { ResearchJob } from '../../generated/prisma/client.js'
import { jobKindSchema, jobProgressEntrySchema, jobStatusSchema, type JobDto, type JobProgressEntry } from '../../lib/contracts/index.js'

export function parseJobProgress(value: string): JobProgressEntry[] {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((entry) => {
      const result = jobProgressEntrySchema.safeParse(entry)
      return result.success ? [result.data] : []
    })
  } catch {
    return []
  }
}

export function jobDto(row: ResearchJob): JobDto {
  return {
    id: row.id,
    kind: jobKindSchema.catch('BRIEF').parse(row.kind),
    status: jobStatusSchema.catch('FAILED').parse(row.status),
    certificationId: row.certificationId,
    intakeSessionId: row.intakeSessionId,
    resultBriefId: row.resultBriefId,
    progress: parseJobProgress(row.progress),
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
  }
}
