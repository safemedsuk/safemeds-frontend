import { get, post, type PaginationMeta } from './client'

export type SdeaStatus = 'draft' | 'active' | 'expired' | 'superseded'
export type SdeaDistributorStatus = 'active' | 'expiring' | 'expired' | 'missing'

export const SDEA_STATUS_LABELS: Record<SdeaStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  expired: 'Expired',
  superseded: 'Superseded',
}

export interface Sdea {
  id: string
  companyId: string
  distributorId: string
  title: string
  counterpartyName: string
  templateUsed: string | null
  version: number
  status: SdeaStatus
  documentId: string | null
  effectiveDate: string | null
  expiryDate: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateSdeaInput {
  distributorId: string
  title: string
  counterpartyName: string
  templateUsed?: string
  effectiveDate?: string
  expiryDate?: string
}

export async function createSdea(input: CreateSdeaInput): Promise<Sdea> {
  const { data } = await post<Sdea>('/sdea', input)
  return data
}

export async function attachSdeaDocument(id: string, documentId: string): Promise<Sdea> {
  const { data } = await post<Sdea>(`/sdea/${id}/document`, { documentId })
  return data
}

export async function activateSdea(id: string): Promise<Sdea> {
  const { data } = await post<Sdea>(`/sdea/${id}/activate`, {})
  return data
}

export interface ListSdeasResult {
  sdeas: Sdea[]
  meta: PaginationMeta
}

export async function listSdeas(page = 1, limit = 10): Promise<ListSdeasResult> {
  const { data, meta } = await get<Sdea[]>('/sdea', { page, limit })
  return { sdeas: data, meta: meta ?? { page: 1, limit, total: data.length, totalPages: 1 } }
}

export async function getSdea(id: string): Promise<Sdea> {
  const { data } = await get<Sdea>(`/sdea/${id}`)
  return data
}

export interface SdeaDistributorStatusResult {
  status: SdeaDistributorStatus
  sdea: Sdea | null
}

export async function getSdeaStatusForDistributor(distributorId: string): Promise<SdeaDistributorStatusResult> {
  const { data } = await get<SdeaDistributorStatusResult>(`/sdea/distributor/${distributorId}/status`)
  return data
}
