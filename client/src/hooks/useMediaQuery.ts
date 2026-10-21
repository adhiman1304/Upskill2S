import { useSyncExternalStore } from 'react'

/** The single layout breakpoint: below 900 px the sidebar becomes a top bar and pages switch to their mobile layout. */
export const MOBILE_QUERY = '(max-width: 899px)'

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** True below 900 px (same breakpoint as the mobile top bar in layout.css). */
export function useIsMobile() {
  return useMediaQuery(MOBILE_QUERY)
}
