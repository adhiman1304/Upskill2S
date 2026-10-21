import { useEffect } from 'react'

/**
 * Sets `document.title` to "<title> | Upskill" while the calling page is mounted.
 * Pass `enabled = false` when the page is embedded in a hub that owns the title.
 */
export function useDocumentTitle(title: string | null | undefined, enabled = true) {
  useEffect(() => { if (enabled) document.title = title ? `${title} | Upskill` : 'Upskill' }, [title, enabled])
}

/** Short page name for the mobile top bar, derived from the path. */
export function routeTitle(pathname: string) {
  if (pathname === '/') return 'Find a certification'
  if (pathname === '/intake') return 'Help me choose'
  if (pathname.startsWith('/intake/')) return 'Recommendations'
  if (pathname.startsWith('/certifications/')) return 'Study brief'
  if (pathname === '/my-certifications') return 'My certifications'
  if (pathname === '/settings') return 'Settings'
  if (pathname === '/community') return 'Community'
  if (pathname.startsWith('/library/')) return 'Library'
  if (pathname === '/admin') return 'Admin'
  return ''
}
