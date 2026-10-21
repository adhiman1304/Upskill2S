import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Active tab stored in a URL search param (default `?tab=`), so refresh and back keep it.
 * The default tab is represented by the absence of the param. Switching tabs replaces the
 * current history entry: browser back (and the top-bar back arrow) leaves the page instead of
 * stepping through tabs, and returns to whichever tab you were on.
 */
export function useTabParam(ids: readonly string[], defaultId: string = ids[0], param = 'tab') {
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get(param)
  const active = raw && ids.includes(raw) ? raw : defaultId
  const select = useCallback((id: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (id === defaultId) next.delete(param)
      else next.set(param, id)
      return next
    }, { replace: true, preventScrollReset: true })
  }, [defaultId, param, setSearchParams])
  return [active, select] as const
}
