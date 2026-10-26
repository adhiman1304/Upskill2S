import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Hub pages: `param` belongs to one tab (for example `?provider=` to Library). Drop it from the URL
 * while another tab is open so it does not linger. `defaultTab` is the tab shown when `?tab=` is absent.
 */
export function useScopedParam(param: string, ownerTab: string, defaultTab: string) {
  const [searchParams, setSearchParams] = useSearchParams()
  const stray = searchParams.has(param) && (searchParams.get('tab') ?? defaultTab) !== ownerTab
  useEffect(() => {
    if (!stray) return
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.delete(param)
      return next
    }, { replace: true, preventScrollReset: true })
  }, [stray, param, setSearchParams])
}
