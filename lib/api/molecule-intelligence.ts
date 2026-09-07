import { get } from './client'

export interface OwnMoleculeCaseSummary {
  totalCases: number
  byCountry: { countryId: string; countryName: string; caseCount: number }[]
  bySeriousness: { seriousnessClass: string | null; caseCount: number }[]
  byMonth: { month: string; caseCount: number }[]
}

// testing-todo 19.1 — the cross-portfolio (other-tenant) aggregate was
// deliberately removed 17 Aug 2026: showing any cross-company statistics
// to another SafeMeds tenant, even count-only and anonymized, was judged
// not acceptable — a risk to client trust. This view is now purely
// tenant-scoped.
export interface MoleculeIntelligenceView {
  moleculeName: string
  own: OwnMoleculeCaseSummary
}

export async function listOwnMolecules(): Promise<string[]> {
  const { data } = await get<string[]>('/pv/molecule-intelligence/molecules')
  return data
}

export async function getMoleculeView(moleculeName: string): Promise<MoleculeIntelligenceView> {
  const { data } = await get<MoleculeIntelligenceView>(`/pv/molecule-intelligence/${encodeURIComponent(moleculeName)}`)
  return data
}
