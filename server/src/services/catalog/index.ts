// STUB owned by workstream D (catalog). S0 placeholder; replace wholesale.
import type { CatalogHitDto, ResolveCertificationInput } from '../../lib/contracts/index.js'

export async function searchCatalog(_query: string, _userId: string): Promise<CatalogHitDto[]> {
  return []
}

export async function resolveCertification(_input: ResolveCertificationInput, _userId: string): Promise<{ id: string }> {
  throw new Error('Catalog resolve not implemented yet (workstream D).')
}
