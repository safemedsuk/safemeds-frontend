import { get, post, PaginationMeta } from './client'

// RegCloud (Phase 12) Stage 8 — Post-Market & Obligations.

export interface RegPostMarketObligationFulfillment {
  id: string
  obligationId: string
  fulfilledAt: string
  fulfilledBy: string | null
  evidenceDocumentId: string | null
  generatedReportId: string | null
  note: string | null
  createdAt: string
}

export interface RegPostMarketObligation {
  id: string
  companyId: string
  productRegistrationId: string
  obligationType: string
  dueAt: string
  status: string
  notifiedOverdueAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  fulfillments: RegPostMarketObligationFulfillment[]
}

export interface RegPostMarketObligationPage {
  rows: RegPostMarketObligation[]
  meta: PaginationMeta
}

export async function listRegPostMarketObligations(params: { productRegistrationId?: string; status?: string; page?: number; limit?: number } = {}): Promise<RegPostMarketObligationPage> {
  const { data, meta } = await get<RegPostMarketObligation[]>('/reg-post-market-obligations', params as Record<string, string | number | undefined>)
  return { rows: data, meta: meta! }
}

export async function getRegPostMarketObligation(id: string): Promise<RegPostMarketObligation> {
  const { data } = await get<RegPostMarketObligation>(`/reg-post-market-obligations/${id}`)
  return data
}

export async function createRegPostMarketObligation(payload: { productRegistrationId: string; obligationType: string; dueAt?: string }): Promise<RegPostMarketObligation> {
  const { data } = await post<RegPostMarketObligation>('/reg-post-market-obligations', payload)
  return data
}

export async function fulfillRegPostMarketObligation(
  id: string,
  payload: { evidenceDocumentId?: string; generateFilingRecord?: boolean; note?: string },
): Promise<RegPostMarketObligation> {
  const { data } = await post<RegPostMarketObligation>(`/reg-post-market-obligations/${id}/fulfill`, payload)
  return data
}
