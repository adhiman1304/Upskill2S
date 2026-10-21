import { useEffect, useState } from 'react'
import { searchCatalog } from '../../lib/api/catalog'
import type { CatalogHitDto } from '../../lib/contracts'
import { useApi } from '../../session'
import { message } from '../legacy/utils'

export interface MyCertificationsState { loading: boolean; items: CatalogHitDto[]; error: string }

/** Followed certifications first, then recently researched ones (empty-query search). */
export function useMyCertifications() {
  const request = useApi()
  const [state, setState] = useState<MyCertificationsState>({ loading: true, items: [], error: '' })
  useEffect(() => {
    let active = true
    searchCatalog(request, '')
      .then((items) => { if (active) setState({ loading: false, items, error: '' }) })
      .catch((reason: unknown) => { if (active) setState({ loading: false, items: [], error: message(reason, 'Could not load your certifications.') }) })
    return () => { active = false }
  }, [request])
  return state
}
