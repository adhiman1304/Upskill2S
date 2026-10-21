import type { StudyBriefContent } from '../../lib/contracts/index.js'
import { prisma } from '../../database.js'

export interface PersistBriefInput {
  certificationId: string
  content: StudyBriefContent
  model: string
  inputTokens: number
  outputTokens: number
  jobId: string | null
  requestedById: string
  now?: Date
}

/** Parses an ISO-ish date (YYYY-MM-DD or full ISO); returns null for anything else. */
function parseOfficialDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}(-\d{2})?/.test(value)) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isHttps(value: string | null): value is string {
  if (!value) return false
  try { return new URL(value).protocol === 'https:' } catch { return false }
}

/**
 * Saves a new CURRENT brief version, supersedes the previous one, and back-fills
 * certification metadata that is still empty. Runs in one transaction; the
 * `(certificationId, version)` unique index guards against concurrent writers.
 */
export async function persistBrief(input: PersistBriefInput): Promise<{ briefId: string; version: number }> {
  const now = input.now ?? new Date()
  return prisma.$transaction(async (tx) => {
    const certification = await tx.certification.findUnique({
      where: { id: input.certificationId },
      select: { id: true, officialUrl: true, examVersion: true, examUpdatedAt: true },
    })
    if (!certification) throw new Error(`Certification ${input.certificationId} no longer exists.`)

    const latest = await tx.studyBrief.aggregate({ where: { certificationId: input.certificationId }, _max: { version: true } })
    const version = (latest._max.version ?? 0) + 1

    await tx.studyBrief.updateMany({ where: { certificationId: input.certificationId, status: 'CURRENT' }, data: { status: 'SUPERSEDED' } })
    const brief = await tx.studyBrief.create({
      data: {
        certificationId: input.certificationId,
        version,
        status: 'CURRENT',
        content: JSON.stringify(input.content),
        model: input.model,
        sourceCount: input.content.sources.length,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        jobId: input.jobId,
        requestedById: input.requestedById,
        generatedAt: now,
      },
      select: { id: true },
    })

    const facts = input.content.certification
    const examUpdatedAt = parseOfficialDate(facts.lastOfficialUpdate)
    await tx.certification.update({
      where: { id: input.certificationId },
      data: {
        lastResearchedAt: now,
        ...(!certification.officialUrl && isHttps(facts.officialUrl) ? { officialUrl: facts.officialUrl } : {}),
        ...(!certification.examVersion && facts.examVersion ? { examVersion: facts.examVersion.slice(0, 120) } : {}),
        ...(!certification.examUpdatedAt && examUpdatedAt ? { examUpdatedAt } : {}),
      },
    })

    return { briefId: brief.id, version }
  })
}
