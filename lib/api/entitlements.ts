import { get, post } from './client'

export interface Entitlement {
  id: string
  companyId: string
  moduleKey: string
  /** `"*"` = module-level grant, otherwise a specific feature within the module. */
  featureKey: string
  enabled: boolean
  grantedBy: string
  grantedAt: string
  updatedAt: string
}

export interface CompanySummary {
  id: string
  name: string
  companyType: string
  status: string
  homeCountryName: string
  homeCountryIsoCode: string
}

/** Tenant self-service — which modules/features the caller's own company currently has. */
export async function getMyEntitlements(): Promise<Entitlement[]> {
  const { data } = await get<Entitlement[]>('/entitlements/mine')
  return data
}

/** Platform-only (super_admin) — the entitlement console's company picker. */
export async function listCompanies(q?: string, page = 1): Promise<{ companies: CompanySummary[]; totalPages: number }> {
  const { data, meta } = await get<CompanySummary[]>('/platform/companies', { q, page, limit: 25 })
  return { companies: data, totalPages: meta?.totalPages ?? 1 }
}

/** Platform-only (super_admin) — a specific company's current entitlement rows. */
export async function listCompanyEntitlements(companyId: string): Promise<Entitlement[]> {
  const { data } = await get<Entitlement[]>(`/platform/companies/${companyId}/entitlements`)
  return data
}

/** Platform-only (super_admin) — grant or revoke a module/feature entitlement. Omit `featureKey` for a module-level grant. */
export async function grantEntitlement(companyId: string, moduleKey: string, enabled: boolean, featureKey?: string): Promise<Entitlement> {
  const { data } = await post<Entitlement>(`/platform/companies/${companyId}/entitlements`, { moduleKey, featureKey, enabled })
  return data
}
