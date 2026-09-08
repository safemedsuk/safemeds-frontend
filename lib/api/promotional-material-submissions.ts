import { get, PaginationMeta, post } from './client'

/**
 * RegCloud (Phase 12) Stage 13 — Advertising & Promotion. Deliberately a
 * lighter-weight submission/review record than the master registration
 * lifecycle — no query/response loop, just draft → submitted →
 * approved/rejected, matching `PromotionalMaterialSubmission`'s own
 * backend schema doc comment.
 */

export interface TransitionLogEntry {
  fromStateKey: string | null
  toStateKey: string
  note: string | null
  actorName: string | null
  occurredAt: string
}

export interface PromotionalMaterialSubmission {
  id: string
  companyId: string
  productId: string
  product: { brandName: string }
  authorityId: string
  authority: { name: string; code: string }
  materialType: string
  materialDocumentId: string | null
  status: string
  version: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface PromotionalMaterialSubmissionDetail extends PromotionalMaterialSubmission {
  workflowInstanceId: string | null
  transitionHistory: TransitionLogEntry[]
}

export interface PromotionalMaterialSubmissionPage {
  rows: PromotionalMaterialSubmissionDetail[]
  meta: PaginationMeta
}

export const PROMOTIONAL_MATERIAL_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
}

export const PROMOTIONAL_MATERIAL_TYPE_LABELS: Record<string, string> = {
  print: 'Print',
  digital: 'Digital',
  broadcast: 'Broadcast',
}

export async function listPromotionalMaterialSubmissions(params: { productId?: string; page?: number; limit?: number } = {}): Promise<PromotionalMaterialSubmissionPage> {
  const { data, meta } = await get<PromotionalMaterialSubmissionDetail[]>('/promotional-material-submissions', params as Record<string, string | number | undefined>)
  return { rows: data, meta: meta! }
}

export async function getPromotionalMaterialSubmission(id: string): Promise<PromotionalMaterialSubmissionDetail> {
  const { data } = await get<PromotionalMaterialSubmissionDetail>(`/promotional-material-submissions/${id}`)
  return data
}

export async function createPromotionalMaterialSubmission(payload: {
  productId: string
  authorityId: string
  materialType: string
  materialDocumentId?: string
}): Promise<PromotionalMaterialSubmissionDetail> {
  const { data } = await post<PromotionalMaterialSubmissionDetail>('/promotional-material-submissions', payload)
  return data
}

export async function attachPromotionalMaterialDocument(id: string, documentId: string): Promise<PromotionalMaterialSubmissionDetail> {
  const { data } = await post<PromotionalMaterialSubmissionDetail>(`/promotional-material-submissions/${id}/material-document`, { documentId })
  return data
}
