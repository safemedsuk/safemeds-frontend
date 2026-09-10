import { get, PaginationMeta, post } from './client'

/**
 * RegCloud (Phase 12) Stage 16 — Reliance Pathways. A deliberately thin
 * grouping wrapper — "one application, several real per-authority
 * dossiers" — reusing the exact same `RegDossier` mechanics every other
 * registration goes through (see the backend `RelianceApplication`
 * model's own schema doc comment). ⚠️ Entirely Tier 2/3 priority — the
 * mechanism here is real, but no EAC/ZaZiBoNa/WHO CRP process-level
 * content is sourced or invented.
 */

export const PATHWAY_TYPE_LABELS: Record<string, string> = {
  eac_joint_assessment: 'EAC Joint Assessment',
  zaziboNa: 'ZaZiBoNa',
  who_crp: 'WHO Collaborative Registration Procedure',
}

export interface RelianceApplicationAuthorityStatus {
  authorityId: string
  authorityName: string
  authorityCode: string
  isLead: boolean
  dossier: { id: string; status: string } | null
}

export interface RelianceApplication {
  id: string
  companyId: string
  productId: string
  product: { brandName: string }
  pathwayType: string
  leadAuthorityId: string
  leadAuthority: { name: string; code: string }
  participatingAuthorityIds: string[]
  status: 'active' | 'closed'
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface RelianceApplicationDetail extends RelianceApplication {
  authorityStatuses: RelianceApplicationAuthorityStatus[]
}

export interface RelianceApplicationPage {
  rows: RelianceApplication[]
  meta: PaginationMeta
}

export async function listRelianceApplications(params: { productId?: string; page?: number; limit?: number } = {}): Promise<RelianceApplicationPage> {
  const { data, meta } = await get<RelianceApplication[]>('/reliance-applications', params as Record<string, string | number | undefined>)
  return { rows: data, meta: meta! }
}

export async function getRelianceApplication(id: string): Promise<RelianceApplicationDetail> {
  const { data } = await get<RelianceApplicationDetail>(`/reliance-applications/${id}`)
  return data
}

export async function createRelianceApplication(payload: {
  productId: string
  pathwayType: string
  leadAuthorityId: string
  participatingAuthorityIds?: string[]
  productClass: string
  route?: string
}): Promise<RelianceApplicationDetail & { leadDossier: { id: string } }> {
  const { data } = await post<RelianceApplicationDetail & { leadDossier: { id: string } }>('/reliance-applications', payload)
  return data
}

export async function addParticipatingAuthority(id: string, authorityId: string): Promise<RelianceApplicationDetail> {
  const { data } = await post<RelianceApplicationDetail>(`/reliance-applications/${id}/authorities`, { authorityId })
  return data
}

export async function startAuthorityDossier(id: string, payload: { authorityId: string; productClass: string; route?: string }): Promise<{ id: string }> {
  const { data } = await post<{ id: string }>(`/reliance-applications/${id}/start-dossier`, payload)
  return data
}

export async function closeRelianceApplication(id: string): Promise<RelianceApplication> {
  const { data } = await post<RelianceApplication>(`/reliance-applications/${id}/close`)
  return data
}
