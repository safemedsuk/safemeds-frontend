import { get } from './client'
import { WhoDrugTerm } from './pv-cases'

export interface SearchWhoDrugParams {
  q: string
  version?: string
}

/** VigiCloud Stage 7 — typeahead search against the WHODrug Global mock subset (real UMC subscription not yet purchased — see CLAUDE.md/needs.md). */
export async function searchWhoDrug(params: SearchWhoDrugParams): Promise<WhoDrugTerm[]> {
  const { data } = await get<WhoDrugTerm[]>('/who-drug/search', { q: params.q, version: params.version })
  return data
}
