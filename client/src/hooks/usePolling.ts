import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Polls `fetcher` every `intervalMs` while `enabled` is true. The next poll is scheduled only after the
 * previous one settles, so slow requests never overlap. The latest `fetcher` is always used, so it can be an
 * inline arrow. Set `enabled` to false (e.g. when a job reaches a terminal status) to stop polling; `data`
 * keeps its last value. `refresh()` fetches once immediately, independent of `enabled`.
 */
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number, enabled: boolean) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const fetcherRef = useRef(fetcher)
  const mounted = useRef(true)
  useEffect(() => { fetcherRef.current = fetcher }, [fetcher])
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const refresh = useCallback(async (): Promise<T | null> => {
    try {
      const result = await fetcherRef.current()
      if (mounted.current) { setData(result); setError(null) }
      return result
    } catch (reason) {
      if (mounted.current) setError(reason instanceof Error ? reason : new Error(String(reason)))
      return null
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = async () => {
      try {
        const result = await fetcherRef.current()
        if (active) { setData(result); setError(null) }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason : new Error(String(reason)))
      } finally {
        if (active) timer = setTimeout(() => void tick(), intervalMs)
      }
    }
    void tick()
    return () => { active = false; if (timer) clearTimeout(timer) }
  }, [enabled, intervalMs])

  return { data, error, refresh }
}
