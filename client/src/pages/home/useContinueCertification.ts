import { useEffect, useState } from 'react'
import { listMyCertifications } from '../../lib/api/myCertifications'
import type { MyCertificationDto } from '../../lib/contracts'
import { useApi } from '../../session'

export interface ContinueState { loading: boolean; item: MyCertificationDto | null }

/** The most recently updated Studying certification (GET /api/me/certifications), for Home's Continue card. */
export function useContinueCertification() {
  const request = useApi()
  const [state, setState] = useState<ContinueState>({ loading: true, item: null })
  useEffect(() => {
    let active = true
    listMyCertifications(request)
      .then((groups) => { if (active) setState({ loading: false, item: groups.studying[0] ?? null }) })
      .catch(() => { if (active) setState({ loading: false, item: null }) })
    return () => { active = false }
  }, [request])
  return state
}
