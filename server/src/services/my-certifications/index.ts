// Workstream M. The user's certifications (UserCertification rows) grouped by status, plus bulk save.
import { config } from '../../config.js'
import { prisma } from '../../database.js'
import {
  followStatusSchema,
  intakeResultSchema,
  type FollowStatus,
  type MyCertificationBulkItem,
  type MyCertificationDto,
  type MyCertificationsDto,
} from '../../lib/contracts/index.js'
import { findOrCreateCertification, httpsOrNull, parseResolveInput } from '../catalog/index.js'

const DAY_MS = 24 * 60 * 60 * 1000

/** Thrown when a bulk item fails validation; the message is safe to show. */
export class MyCertificationInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MyCertificationInputError'
  }
}

/** Checklist item ids of a stored brief's content, or [] if the JSON is unreadable. */
function checklistItemIds(content: string): string[] {
  try {
    const parsed = JSON.parse(content) as { checklist?: unknown }
    if (!Array.isArray(parsed.checklist)) return []
    return parsed.checklist.flatMap((item: unknown) => (item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string' ? [(item as { id: string }).id] : []))
  } catch {
    return []
  }
}

/**
 * Certification ids the user saved from an intake's "Certifications you already hold" section. There is no source
 * column (no migration), so `source: 'resume'` is derived from saved held certifications in the user's intake results.
 */
async function resumeCertifications(userId: string): Promise<Map<string, { yearObtained: number | null }>> {
  const sessions = await prisma.intakeSession.findMany({ where: { userId, status: 'SUCCEEDED', result: { contains: '"saved":true' } }, select: { result: true } })
  const found = new Map<string, { yearObtained: number | null }>()
  for (const session of sessions) {
    try {
      const parsed = intakeResultSchema.safeParse(JSON.parse(session.result ?? 'null'))
      if (!parsed.success) continue
      for (const held of parsed.data.heldCertifications) {
        const id = held.saved ? held.catalogMatch?.certificationId : null
        if (id && !found.get(id)?.yearObtained) found.set(id, { yearObtained: held.yearObtained })
      }
    } catch { /* unreadable result: ignore */ }
  }
  return found
}

export async function listMyCertifications(userId: string): Promise<MyCertificationsDto> {
  const rows = await prisma.userCertification.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: { certification: { select: { id: true, provider: true, code: true, title: true, officialUrl: true } } },
  })
  const ids = rows.map((row) => row.certificationId)
  const [briefs, progress, fromResume] = await Promise.all([
    ids.length ? prisma.studyBrief.findMany({ where: { certificationId: { in: ids }, status: 'CURRENT' }, orderBy: { version: 'desc' }, select: { certificationId: true, generatedAt: true, content: true } }) : [],
    ids.length ? prisma.checklistProgress.findMany({ where: { userId, certificationId: { in: ids } }, select: { certificationId: true, itemId: true } }) : [],
    resumeCertifications(userId),
  ])
  const briefByCert = new Map<string, { generatedAt: Date; itemIds: Set<string> }>()
  for (const brief of briefs) if (!briefByCert.has(brief.certificationId)) briefByCert.set(brief.certificationId, { generatedAt: brief.generatedAt, itemIds: new Set(checklistItemIds(brief.content)) })
  const doneByCert = new Map<string, string[]>()
  for (const item of progress) doneByCert.set(item.certificationId, [...(doneByCert.get(item.certificationId) ?? []), item.itemId])

  const grouped: MyCertificationsDto = { studying: [], planning: [], passed: [] }
  for (const row of rows) {
    const status = followStatusSchema.catch('STUDYING').parse(row.status)
    const brief = briefByCert.get(row.certificationId)
    const dto: MyCertificationDto = {
      certificationId: row.certification.id,
      provider: row.certification.provider,
      code: row.certification.code,
      title: row.certification.title,
      officialUrl: httpsOrNull(row.certification.officialUrl),
      status,
      targetDate: row.targetDate ? row.targetDate.toISOString().slice(0, 10) : null,
      passedAt: status === 'PASSED' ? row.updatedAt.toISOString() : null,
      source: fromResume.has(row.certificationId) ? 'resume' : 'follow',
      yearObtained: status === 'PASSED' ? fromResume.get(row.certificationId)?.yearObtained ?? null : null,
      brief: brief ? {
        freshness: Date.now() - brief.generatedAt.getTime() <= config.briefStaleDays * DAY_MS ? 'fresh' : 'stale',
        generatedAt: brief.generatedAt.toISOString(),
        checklistTotal: brief.itemIds.size,
        checklistDone: (doneByCert.get(row.certificationId) ?? []).filter((id) => brief.itemIds.has(id)).length,
      } : null,
      updatedAt: row.updatedAt.toISOString(),
    }
    grouped[status === 'PASSED' ? 'passed' : status === 'PLANNING' ? 'planning' : 'studying'].push(dto)
  }
  return grouped
}

/** Upserts the user's follow row. `targetDate` undefined keeps the stored date; null clears it. */
export async function setMyCertification(userId: string, certificationId: string, status: FollowStatus, targetDate?: string | null) {
  const date = targetDate === undefined ? undefined : targetDate ? new Date(`${targetDate}T00:00:00.000Z`) : null
  await prisma.userCertification.upsert({
    where: { userId_certificationId: { userId, certificationId } },
    create: { userId, certificationId, status, targetDate: date ?? null },
    update: { status, ...(date !== undefined ? { targetDate: date } : {}) },
  })
}

/**
 * Validates every item first (all or nothing), then find-or-creates each certification (catalog matches are created
 * as the system user, so saving does not earn contribution points) and upserts the follow row with the item's status.
 * Returns the certification id per item, in order.
 */
export async function saveMyCertifications(userId: string, items: MyCertificationBulkItem[]): Promise<string[]> {
  const parsed = items.map((item, index) => {
    const result = parseResolveInput({ provider: item.provider, code: item.code, title: item.title, officialUrl: item.officialUrl ?? null })
    if (!result.ok) throw new MyCertificationInputError(items.length > 1 ? `Item ${index + 1}: ${result.error}` : result.error)
    return { input: result.data, status: item.status }
  })
  const ids: string[] = []
  for (const { input, status } of parsed) {
    const { id } = await findOrCreateCertification(input, userId, { catalogAsSystem: true })
    await setMyCertification(userId, id, status)
    ids.push(id)
  }
  return ids
}
