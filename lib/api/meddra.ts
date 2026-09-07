import { get } from './client'
import { MeddraLevel, MeddraTerm } from './pv-cases'

export interface SearchMeddraParams {
  q: string
  level?: MeddraLevel
  version?: string
}

/** VigiCloud Stage 7 — typeahead search against the MedDRA hierarchy (mock subset until a real MSSO licence exists — see CLAUDE.md/needs.md). */
export async function searchMeddra(params: SearchMeddraParams): Promise<MeddraTerm[]> {
  const { data } = await get<MeddraTerm[]>('/meddra/search', { q: params.q, level: params.level, version: params.version })
  return data
}
