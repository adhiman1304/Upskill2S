import type OpenAI from 'openai'
import type { BriefSource, SourceKind } from '../../lib/contracts/index.js'
import { isBlockedUrl } from './filters.js'

type ResponseLike = Pick<OpenAI.Responses.Response, 'output'>

const MAX_SNIPPET_CHARS = 280
const MAX_TITLE_CHARS = 200
const MAX_SLUG_CHARS = 60

/** Strips tracking parameters (web search adds `utm_source=openai`) and fragments so duplicates collapse. */
export function normalizeSourceUrl(url: string): string | null {
  let parsed: URL
  try { parsed = new URL(url.trim()) } catch { return null }
  parsed.hash = ''
  for (const key of [...parsed.searchParams.keys()]) {
    if (/^utm_/i.test(key) || key === 'ref' || key === 'fbclid' || key === 'gclid') parsed.searchParams.delete(key)
  }
  parsed.hostname = parsed.hostname.toLowerCase()
  return parsed.toString()
}

export function slugify(value: string, fallback = 'source'): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!slug) return fallback
  if (slug.length <= MAX_SLUG_CHARS) return slug
  const cut = slug.slice(0, MAX_SLUG_CHARS)
  const lastHyphen = cut.lastIndexOf('-')
  return (lastHyphen > 20 ? cut.slice(0, lastHyphen) : cut).replace(/-+$/, '')
}

/** Returns `base`, or `base-2`, `base-3`, ... so that ids stay unique within `taken`. */
export function uniqueSlug(base: string, taken: Set<string>): string {
  let candidate = base
  for (let counter = 2; taken.has(candidate); counter += 1) candidate = `${base}-${counter}`
  taken.add(candidate)
  return candidate
}

const VIDEO_HOSTS = ['youtube.com', 'youtu.be', 'vimeo.com', 'twitch.tv']
const FORUM_HOSTS = ['reddit.com', 'redd.it', 'stackoverflow.com', 'stackexchange.com', 'quora.com', 'techcommunity.microsoft.com', 'community.fabric.microsoft.com', 'repost.aws', 'discord.com', 'news.ycombinator.com']
const COURSE_HOSTS = ['udemy.com', 'coursera.org', 'pluralsight.com', 'acloudguru.com', 'cloudacademy.com', 'whizlabs.com', 'edx.org', 'tutorialsdojo.com', 'measureup.com', 'kodekloud.com', 'oreilly.com', 'educative.io', 'datacamp.com', 'skillsoft.com', 'cbtnuggets.com', 'itpro.tv', 'acitpro.com', 'freecodecamp.org']
const BLOG_HOSTS = ['medium.com', 'dev.to', 'hashnode.dev', 'hashnode.com', 'substack.com', 'blogspot.com', 'wordpress.com', 'towardsdatascience.com']
const COMMUNITY_HOSTS = ['github.com', 'gitlab.com', 'linkedin.com', 'x.com', 'twitter.com', 'meetup.com']
/** Certification providers and their exam delivery partners. */
const OFFICIAL_HOSTS = [
  'microsoft.com', 'azure.com', 'aka.ms', 'amazon.com', 'aws.amazon.com', 'cloud.google.com', 'google.com', 'grow.google', 'comptia.org', 'cisco.com',
  'isc2.org', 'isaca.org', 'pmi.org', 'peoplecert.org', 'axelos.com', 'linuxfoundation.org', 'cncf.io', 'hashicorp.com', 'redhat.com', 'oracle.com',
  'salesforce.com', 'databricks.com', 'snowflake.com', 'pearsonvue.com', 'certiport.com', 'credly.com', 'kubernetes.io', 'terraform.io',
]

function hostMatches(host: string, list: readonly string[]) {
  return list.some((domain) => host === domain || host.endsWith(`.${domain}`))
}

/** Infers the source kind from the URL. `officialHosts` adds the certification's own official domain. */
export function inferSourceKind(url: string, officialHosts: readonly string[] = []): SourceKind {
  let parsed: URL
  try { parsed = new URL(url) } catch { return 'other' }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
  const path = parsed.pathname.toLowerCase()
  if (hostMatches(host, VIDEO_HOSTS)) return 'video'
  if (hostMatches(host, FORUM_HOSTS) || /^(forum|forums|community|discuss)\./.test(host) || path.includes('/answers/')) return 'forum'
  if (hostMatches(host, COURSE_HOSTS) || (hostMatches(host, ['linkedin.com']) && path.startsWith('/learning'))) return 'course'
  if (path.includes('/shows/')) return hostMatches(host, OFFICIAL_HOSTS) ? 'video' : 'other'
  if (hostMatches(host, officialHosts) || hostMatches(host, OFFICIAL_HOSTS)) return 'official'
  if (hostMatches(host, BLOG_HOSTS) || host.startsWith('blog.') || path.includes('/blog')) return 'blog'
  if (hostMatches(host, COMMUNITY_HOSTS)) return 'community'
  return 'other'
}

/** The registrable-ish domain of an official URL (last two labels), used to treat its whole site as official. */
export function officialHostsFor(officialUrl: string | null): string[] {
  if (!officialUrl) return []
  try {
    const labels = new URL(officialUrl).hostname.toLowerCase().replace(/^www\./, '').split('.')
    return labels.length >= 2 ? [labels.slice(-2).join('.')] : []
  } catch {
    return []
  }
}

function publisherOf(url: string): string | null {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, '') } catch { return null }
}

function clean(text: string, max: number) {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  return collapsed.length > max ? `${collapsed.slice(0, max - 1).trimEnd()}…` : collapsed
}

/** The sentence or bullet that a citation marker is attached to (the text just before the marker). */
function citedClaim(text: string, start: number): string {
  const before = text.slice(Math.max(0, start - 600), start)
  const trimmed = before.replace(/[\s(]+$/, '')
  const lastBreak = Math.max(trimmed.lastIndexOf('\n'), trimmed.lastIndexOf('. '), trimmed.lastIndexOf('! '), trimmed.lastIndexOf('? '))
  const sentence = trimmed.slice(lastBreak + 1)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>]+/g, '')
    .replace(/^\s*[-\d.)]+\s*/, '')
    .replace(/[\s(]+$/, '')
  return clean(sentence, MAX_SNIPPET_CHARS)
}

/**
 * Collects `url_citation` annotations from a Responses API result, drops blocked and
 * non-HTTPS URLs, and deduplicates by normalized URL. Ids are provisional; the
 * orchestrator re-assigns globally unique ids when merging investigations.
 */
export function extractCitedSources(response: ResponseLike, options: { retrievedAt: string; officialHosts?: readonly string[]; blockedDomains?: readonly string[] }): BriefSource[] {
  const byUrl = new Map<string, BriefSource>()
  const taken = new Set<string>()
  for (const item of response.output) {
    if (item.type !== 'message') continue
    for (const part of item.content) {
      if (part.type !== 'output_text') continue
      for (const annotation of part.annotations) {
        if (annotation.type !== 'url_citation') continue
        const url = normalizeSourceUrl(annotation.url)
        if (!url || isBlockedUrl(url, options.blockedDomains)) continue
        const existing = byUrl.get(url)
        const cited = citedClaim(part.text, annotation.start_index)
        if (existing) {
          if (!existing.snippet && cited) existing.snippet = cited
          continue
        }
        const title = clean(annotation.title || publisherOf(url) || url, MAX_TITLE_CHARS)
        byUrl.set(url, {
          id: uniqueSlug(slugify(title), taken),
          url,
          title,
          publisher: publisherOf(url),
          kind: inferSourceKind(url, options.officialHosts),
          retrievedAt: options.retrievedAt,
          snippet: cited || null,
        })
      }
    }
  }
  return [...byUrl.values()]
}

/** Merges per-investigation sources: dedupe by URL (first wins), then assign globally unique slug ids. */
export function mergeSources(groups: BriefSource[][], limit: number): BriefSource[] {
  const byUrl = new Map<string, BriefSource>()
  for (const group of groups) {
    for (const source of group) {
      const existing = byUrl.get(source.url)
      if (!existing) byUrl.set(source.url, { ...source })
      else if (!existing.snippet && source.snippet) existing.snippet = source.snippet
    }
  }
  const taken = new Set<string>()
  return [...byUrl.values()].slice(0, limit).map((source) => ({ ...source, id: uniqueSlug(slugify(source.title), taken) }))
}
