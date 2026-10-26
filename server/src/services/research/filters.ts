import { config } from '../../config.js'

function hostnameOf(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.hostname.toLowerCase().replace(/\.$/, '')
  } catch {
    return null
  }
}

/** True when the hostname equals a blocked domain or is a subdomain of one. */
export function isBlockedHost(hostname: string, blockedDomains: readonly string[] = config.blockedResearchDomains): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, '')
  return blockedDomains.some((domain) => {
    const blocked = domain.toLowerCase().replace(/^www\./, '')
    return host === blocked || host.endsWith(`.${blocked}`)
  })
}

/** True for unparseable URLs, non-HTTPS URLs, and URLs on a blocked (braindump) domain. */
export function isBlockedUrl(url: string, blockedDomains: readonly string[] = config.blockedResearchDomains): boolean {
  let parsed: URL
  try { parsed = new URL(url) } catch { return true }
  if (parsed.protocol !== 'https:') return true
  const host = hostnameOf(url)
  return !host || isBlockedHost(host, blockedDomains)
}

export function filterAllowedUrls<T extends { url: string }>(items: T[], blockedDomains: readonly string[] = config.blockedResearchDomains): T[] {
  return items.filter((item) => !isBlockedUrl(item.url, blockedDomains))
}
