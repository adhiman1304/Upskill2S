import { useEffect } from 'react'

/** Sets `document.title` to "<title> | Upskill" while the calling page is mounted. */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => { document.title = title ? `${title} | Upskill` : 'Upskill' }, [title])
}

/** Short page name for the mobile top bar, derived from the path. */
export function routeTitle(pathname: string) {
  if (pathname === '/') return 'Find a certification'
  if (pathname === '/intake') return 'Help me choose'
  if (pathname.startsWith('/intake/')) return 'Recommendations'
  if (pathname.startsWith('/certifications/')) return 'Study brief'
  if (pathname === '/my-certifications') return 'My certifications'
  if (pathname === '/settings') return 'Settings'
  if (pathname === '/library') return 'Library'
  if (pathname.startsWith('/library/')) return 'Library'
  if (pathname === '/saved') return 'Saved resources'
  if (pathname === '/community') return 'Ideas & questions'
  if (pathname === '/contributions') return 'My contributions'
  if (pathname === '/leaderboard') return 'Leaderboard'
  if (pathname === '/admin/reports') return 'Review queue'
  if (pathname === '/admin/ops') return 'Operations'
  return ''
}
