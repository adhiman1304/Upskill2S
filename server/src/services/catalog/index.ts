// Owned by workstream D. Certification catalog: search over db rows + the seed catalog, and find-or-create.
import { readFileSync } from 'node:fs'
import { Prisma } from '../../generated/prisma/client.js'
import { config } from '../../config.js'
import { prisma } from '../../database.js'
import { catalogSeedEntrySchema, followStatusSchema, resolveCertificationInputSchema, type CatalogHitDto, type CatalogSeedEntry, type FollowStatus, type FreshnessStatus, type ResolveCertificationInput } from '../../lib/contracts/index.js'
import { certificationSchema, normalizeKey } from '../../lib/validation.js'
import { buildVocabulary, fuzzyScore, queryTokens } from './fuzzy.js'

const SEARCH_LIMIT = 15
/** Fuzzy (typo-tolerant) matches rank below every exact, prefix and substring match. */
const FUZZY_RANK = 5
const MINE_LIMIT = 12
const DAY_MS = 24 * 60 * 60 * 1000

/** Common alternative provider names, mapped to the provider name used in the catalog. */
const providerAliases: Record<string, string> = {
  amazon: 'aws',
  'amazon web services': 'aws',
  azure: 'microsoft',
  'microsoft azure': 'microsoft',
  google: 'google cloud',
  gcp: 'google cloud',
  'google cloud platform': 'google cloud',
  '(isc)2': 'isc2',
  '(isc)²': 'isc2',
  axelos: 'peoplecert',
  'the linux foundation': 'linux foundation',
  cncf: 'linux foundation',
  hashicorp: 'hashicorp',
  'red hat': 'red hat',
  redhat: 'red hat',
  'project management institute': 'pmi',
  claude: 'anthropic',
  'anthropic pbc': 'anthropic',
}

// --- seed catalog -------------------------------------------------------------------------------

// Same relative depth from src/services/catalog and dist/services/catalog: <repo>/prisma/seed/catalog.json.
const catalogFileUrl = new URL('../../../../prisma/seed/catalog.json', import.meta.url)
let catalogCache: CatalogSeedEntry[] | null = null

/** Entries from prisma/seed/catalog.json (validated, HTTPS-only URLs). Cached after the first read. */
export function listCatalogEntries(): CatalogSeedEntry[] {
  if (catalogCache) return catalogCache
  try {
    const parsed = catalogSeedEntrySchema.array().parse(JSON.parse(readFileSync(catalogFileUrl, 'utf8')))
    catalogCache = parsed.map((entry) => ({ ...entry, officialUrl: httpsOrNull(entry.officialUrl) }))
  } catch (error) {
    console.error('Could not load the certification seed catalog; catalog search will only use the database.', error)
    catalogCache = []
  }
  return catalogCache
}

// --- helpers ------------------------------------------------------------------------------------

export function httpsOrNull(value: string | null | undefined) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

/** Lower-case, alphanumerics (and '+') only: "DP-700" and "dp700" compare equal. */
export function compact(value: string) {
  return normalizeKey(value).replace(/[^\p{L}\p{N}+]/gu, '')
}

export function canonicalProviderKey(provider: string) {
  const key = normalizeKey(provider)
  return providerAliases[key] ?? key
}

function entryKey(providerKey: string, codeKey: string) {
  return `${providerKey}\u0000${codeKey}`
}

function parseAliases(raw: string): string[] {
  try {
    const value = JSON.parse(raw) as unknown
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function freshnessOf(generatedAt: Date | null | undefined): FreshnessStatus {
  if (!generatedAt) return 'missing'
  return Date.now() - generatedAt.getTime() <= config.briefStaleDays * DAY_MS ? 'fresh' : 'stale'
}

/** Generation time of the CURRENT brief per certification. */
async function currentBriefDates(certificationIds: string[]) {
  if (!certificationIds.length) return new Map<string, Date>()
  const briefs = await prisma.studyBrief.findMany({
    where: { certificationId: { in: certificationIds }, status: 'CURRENT' },
    select: { certificationId: true, generatedAt: true },
  })
  const dates = new Map<string, Date>()
  for (const brief of briefs) {
    const previous = dates.get(brief.certificationId)
    if (!previous || brief.generatedAt > previous) dates.set(brief.certificationId, brief.generatedAt)
  }
  return dates
}

/** The user's follow status per certification. */
async function followStatuses(userId: string, certificationIds: string[]) {
  if (!certificationIds.length) return new Map<string, FollowStatus>()
  const rows = await prisma.userCertification.findMany({
    where: { userId, certificationId: { in: certificationIds } },
    select: { certificationId: true, status: true },
  })
  const statuses = new Map<string, FollowStatus>()
  for (const row of rows) {
    const parsed = followStatusSchema.safeParse(row.status)
    if (parsed.success) statuses.set(row.certificationId, parsed.data)
  }
  return statuses
}

type CertificationRow = { id: string; provider: string; code: string; title: string; officialUrl: string | null; lastResearchedAt: Date | null }

function dbHit(row: CertificationRow, briefDates: Map<string, Date>, follows: Map<string, FollowStatus>): CatalogHitDto {
  const followStatus = follows.get(row.id)
  return {
    certificationId: row.id,
    provider: row.provider,
    code: row.code,
    title: row.title,
    officialUrl: httpsOrNull(row.officialUrl),
    source: 'db',
    briefStatus: freshnessOf(briefDates.get(row.id)),
    lastResearchedAt: row.lastResearchedAt?.toISOString() ?? null,
    following: followStatus ? { status: followStatus } : null,
  }
}

function catalogHit(entry: CatalogSeedEntry): CatalogHitDto {
  return { certificationId: null, provider: entry.provider, code: entry.code, title: entry.title, officialUrl: entry.officialUrl, source: 'catalog', briefStatus: 'missing', lastResearchedAt: null, following: null }
}

/**
 * Rank of a candidate for the query (lower is better), or null when it does not match.
 * 0 exact code, 1 exact alias/title, 2 code prefix, 3 alias/title/provider prefix or word start, 4 substring.
 */
function matchRank(query: string, candidate: { provider: string; code: string; title: string; aliases: string[] }): number | null {
  const q = normalizeKey(query)
  const qc = compact(query)
  if (!q) return null
  const code = normalizeKey(candidate.code)
  const codeCompact = compact(candidate.code)
  const names = [candidate.title, ...candidate.aliases].map(normalizeKey)
  const namesCompact = names.map(compact)

  if (code === q || (qc && codeCompact === qc)) return 0
  const qLoose = qc.replace(/\+/g, '')
  if (names.some((name, index) => name === q || (qLoose.length > 1 && (namesCompact[index] ?? '').replace(/\+/g, '') === qLoose))) return 1
  if (code.startsWith(q) || (qc && codeCompact.startsWith(qc))) return 2
  const words = [candidate.provider, ...names].map(normalizeKey)
  if (words.some((name) => name.startsWith(q) || name.split(/[\s:/()-]+/).some((word) => word && word.startsWith(q)))) return 3
  if (namesCompact.some((name) => qc.length > 1 && name.startsWith(qc))) return 3

  const haystack = [candidate.provider, candidate.code, ...names].map(normalizeKey).join(' ')
  const haystackCompact = compact(haystack)
  const tokens = q.split(/\s+/).filter(Boolean)
  if (tokens.every((token) => haystack.includes(token) || (compact(token) && haystackCompact.includes(compact(token))))) return 4
  return null
}

// --- search -------------------------------------------------------------------------------------

/**
 * Empty query: the user's followed certifications, then recently researched ones (max 12).
 * Otherwise: db certifications and not-yet-imported catalog entries matching provider, code, title or aliases (max 15).
 */
export async function searchCatalog(query: string, userId: string): Promise<CatalogHitDto[]> {
  const trimmed = query.trim()
  if (!trimmed) return myCertifications(userId)

  const rows = await prisma.certification.findMany({
    select: { id: true, provider: true, providerKey: true, code: true, codeKey: true, title: true, officialUrl: true, aliases: true, lastResearchedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 5000,
  })
  const dbKeys = new Set(rows.map((row) => entryKey(canonicalProviderKey(row.providerKey), row.codeKey)))

  // Rank 5 is the fuzzy tier (typo tolerant, see fuzzy.ts); `score` orders hits within it (higher is better).
  type Ranked = { rank: number; score: number; source: 'db' | 'catalog'; researched: number; code: string; row?: (typeof rows)[number]; entry?: CatalogSeedEntry }
  const ranked: Ranked[] = []
  const tokens = queryTokens(trimmed)
  const rankOf = (candidate: { provider: string; code: string; title: string; aliases: string[] }) => {
    const rank = matchRank(trimmed, candidate)
    if (rank !== null) return { rank, score: 1 }
    const score = fuzzyScore(tokens, buildVocabulary(candidate))
    return score === null ? null : { rank: FUZZY_RANK, score }
  }
  for (const row of rows) {
    const match = rankOf({ provider: row.provider, code: row.code, title: row.title, aliases: parseAliases(row.aliases) })
    if (match) ranked.push({ ...match, source: 'db', researched: row.lastResearchedAt?.getTime() ?? 0, code: row.code, row })
  }
  for (const entry of listCatalogEntries()) {
    if (dbKeys.has(entryKey(canonicalProviderKey(entry.provider), normalizeKey(entry.code)))) continue
    const match = rankOf(entry)
    if (match) ranked.push({ ...match, source: 'catalog', researched: 0, code: entry.code, entry })
  }

  ranked.sort((a, b) => a.rank - b.rank || b.score - a.score || b.researched - a.researched || (a.source === b.source ? 0 : a.source === 'db' ? -1 : 1) || a.code.localeCompare(b.code))
  const top = ranked.slice(0, SEARCH_LIMIT)
  const ids = top.flatMap((item) => (item.row ? [item.row.id] : []))
  const [briefDates, follows] = await Promise.all([currentBriefDates(ids), followStatuses(userId, ids)])
  return top.map((item) => (item.row ? dbHit(item.row, briefDates, follows) : catalogHit(item.entry!)))
}

async function myCertifications(userId: string): Promise<CatalogHitDto[]> {
  const select = { id: true, provider: true, code: true, title: true, officialUrl: true, lastResearchedAt: true } as const
  const followed = await prisma.userCertification.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: MINE_LIMIT,
    select: { certification: { select } },
  })
  const rows: CertificationRow[] = followed.map((item) => item.certification)
  if (rows.length < MINE_LIMIT) {
    const recent = await prisma.certification.findMany({
      where: { lastResearchedAt: { not: null }, id: { notIn: rows.map((row) => row.id) } },
      orderBy: { lastResearchedAt: 'desc' },
      take: MINE_LIMIT - rows.length,
      select,
    })
    rows.push(...recent)
  }
  const ids = rows.map((row) => row.id)
  const [briefDates, follows] = await Promise.all([currentBriefDates(ids), followStatuses(userId, ids)])
  return rows.map((row) => dbHit(row, briefDates, follows))
}

// --- resolve ------------------------------------------------------------------------------------

/** Seed catalog entry for a provider + code (exact code first, then a code-like alias such as "AZ900"). */
export function findCatalogEntry(provider: string, code: string): CatalogSeedEntry | null {
  const providerKey = canonicalProviderKey(provider)
  const codeKey = normalizeKey(code)
  const codeCompact = compact(code)
  const candidates = listCatalogEntries().filter((entry) => canonicalProviderKey(entry.provider) === providerKey)
  return candidates.find((entry) => normalizeKey(entry.code) === codeKey)
    ?? candidates.find((entry) => compact(entry.code) === codeCompact)
    ?? candidates.find((entry) => entry.aliases.some((alias) => /\d/.test(alias) && compact(alias) === codeCompact))
    ?? null
}

// The seed's system user ("Upskill"). Catalog rows created on someone's behalf without their authorship use it.
const SYSTEM_USER = { tenantId: 'system', objectId: 'system', displayName: 'Upskill' } as const
let systemUserIdCache: string | null = null

/** Id of the system user, created on first use if the seed has not run. */
export async function systemUserId(): Promise<string> {
  if (systemUserIdCache) return systemUserIdCache
  const user = await prisma.user.upsert({
    where: { tenantId_objectId: { tenantId: SYSTEM_USER.tenantId, objectId: SYSTEM_USER.objectId } },
    create: SYSTEM_USER,
    update: {},
    select: { id: true },
  })
  systemUserIdCache = user.id
  return user.id
}

export interface FindOrCreateOptions {
  /**
   * When the input matches a seed catalog entry and no row exists yet, create it as the system user instead of `userId`,
   * so saving a held certification does not count as a contribution (leaderboard points). Non-catalog rows still use `userId`.
   */
  catalogAsSystem?: boolean
}

/** Find-or-create by normalized provider + code. Reports whether a row was created. */
export async function findOrCreateCertification(input: ResolveCertificationInput, userId: string, options: FindOrCreateOptions = {}): Promise<{ id: string; created: boolean }> {
  const entry = findCatalogEntry(input.provider, input.code)
  const provider = entry?.provider ?? input.provider.trim()
  const code = (entry?.code ?? input.code.trim()).toUpperCase()
  const providerKey = normalizeKey(provider)
  const codeKey = normalizeKey(code)

  // Also accept a row stored under the provider/code exactly as the caller typed them (e.g. a legacy "Amazon Web Services" row).
  const providerKeys = [...new Set([providerKey, normalizeKey(input.provider)])]
  const codeKeys = [...new Set([codeKey, normalizeKey(input.code)])]
  const lookup = () => prisma.certification.findFirst({
    where: { providerKey: { in: providerKeys }, codeKey: { in: codeKeys } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  const existing = await lookup()
  if (existing) return { id: existing.id, created: false }

  try {
    const created = await prisma.certification.create({
      data: {
        provider,
        providerKey,
        code,
        codeKey,
        title: entry?.title ?? input.title.trim(),
        officialUrl: httpsOrNull(input.officialUrl) ?? entry?.officialUrl ?? null,
        aliases: JSON.stringify(entry?.aliases ?? []),
        isCatalog: Boolean(entry),
        createdById: entry && options.catalogAsSystem ? await systemUserId() : userId,
      },
      select: { id: true },
    })
    return { id: created.id, created: true }
  } catch (error) {
    // A concurrent request created the same certification first.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await lookup()
      if (raced) return { id: raced.id, created: false }
    }
    throw error
  }
}

/** Thrown by `resolveCertification` when the input fails `resolveCertificationRequestSchema`; the message is safe to show. */
export class CatalogInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CatalogInputError'
  }
}

// Mirrors the provider/code/title rules of the legacy certificationSchema so resolved rows stay editable there,
// and only accepts HTTPS official links.
export const resolveCertificationRequestSchema = resolveCertificationInputSchema.extend({
  provider: certificationSchema.shape.provider,
  code: certificationSchema.shape.code,
  title: certificationSchema.shape.title,
  officialUrl: resolveCertificationInputSchema.shape.officialUrl.refine(
    (value) => !value || /^https:\/\/[^\s]+$/i.test(value),
    'Official links must use HTTPS.',
  ),
})

/** Validates resolve input and returns either the parsed value or a user-facing error message. */
export function parseResolveInput(input: unknown): { ok: true; data: ResolveCertificationInput } | { ok: false; error: string } {
  const parsed = resolveCertificationRequestSchema.safeParse(input)
  if (parsed.success) return { ok: true, data: parsed.data }
  const issue = parsed.error.issues[0]
  const error = issue?.path[0] === 'code' && issue.code === 'invalid_format'
    ? 'Exam codes may only contain letters, numbers, dots, dashes and underscores.'
    : issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'Invalid certification.'
  return { ok: false, error }
}

/** Validated find-or-create. Throws `CatalogInputError` for invalid input. */
export async function resolveCertification(input: ResolveCertificationInput, userId: string): Promise<{ id: string }> {
  const parsed = parseResolveInput(input)
  if (!parsed.ok) throw new CatalogInputError(parsed.error)
  const { id } = await findOrCreateCertification(parsed.data, userId)
  return { id }
}
