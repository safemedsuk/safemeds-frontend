import { get, patch } from './client'

/**
 * testing-todo 15.1 — the platform-wide, cross-tenant half of distributor
 * linking (tenant-to-tenant case): browse every tenant's distributors,
 * get an auto-match suggestion when a same-named real SafeMeds tenant
 * exists, and link/unlink. A distributor that will never be a tenant
 * simply stays unlinked forever — nothing here forces a link.
 */
export interface PlatformDistributorSummary {
  id: string
  name: string
  ownerCompanyId: string
  ownerCompanyName: string
  distributorCompanyId: string | null
  distributorCompanyName: string | null
}

export interface TenantMatchSuggestion {
  companyId: string
  companyName: string
}

export async function listPlatformDistributors(params: { q?: string; unlinkedOnly?: boolean; page?: number; limit?: number } = {}): Promise<{
  distributors: PlatformDistributorSummary[]
  totalPages: number
  total: number
}> {
  const { data, meta } = await get<PlatformDistributorSummary[]>('/platform/distributors', {
    q: params.q || undefined,
    unlinkedOnly: params.unlinkedOnly || undefined,
    page: params.page ?? 1,
    limit: params.limit ?? 25,
  })
  return { distributors: data, totalPages: meta?.totalPages ?? 1, total: meta?.total ?? data.length }
}

export async function suggestTenantMatches(distributorId: string): Promise<TenantMatchSuggestion[]> {
  const { data } = await get<TenantMatchSuggestion[]>(`/platform/distributors/${distributorId}/suggestions`)
  return data
}

export async function linkDistributorTenant(distributorId: string, targetCompanyId: string | null): Promise<PlatformDistributorSummary> {
  const { data } = await patch<PlatformDistributorSummary>(`/platform/distributors/${distributorId}/link-tenant`, { targetCompanyId: targetCompanyId ?? undefined })
  return data
}
