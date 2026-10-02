import { get, post } from './client'

/** QualCloud (Phase 13) Stage 13 — Product Quality Review & Quality Risk Management. */

export type PqrStatus = 'draft' | 'reviewed'

export interface PqrAssembledData {
  batchCount: number
  deviationCount: number
  capaCount: number
  oosCount: number
  complaintCount: number
  changeControlCount: number
  regSubmissionCount: number
  regVariationCount: number
  openQualityTrendFlags: string[]
  stabilityNote: string
}

export interface PqrRecommendedAction {
  description: string
  capaOpened: boolean
}

export interface Pqr {
  id: string
  companyId: string
  productId: string
  periodStart: string
  periodEnd: string
  status: PqrStatus
  assembledData: PqrAssembledData | null
  conclusionsNarrative: string | null
  trendsNarrative: string | null
  recommendedActions: PqrRecommendedAction[] | null
  reviewedBy: string | null
  reviewedAt: string | null
  nextReviewDueAt: string | null
  generatedReportId: string | null
  createdAt: string
}

export async function listPqrs(productId?: string): Promise<Pqr[]> {
  const { data } = await get<Pqr[]>('/quality/pqr', productId ? { productId } : undefined)
  return data
}

export async function getPqr(id: string): Promise<Pqr> {
  const { data } = await get<Pqr>(`/quality/pqr/${id}`)
  return data
}

export async function assemblePqr(input: {
  productId: string
  periodStart: string
  periodEnd: string
}): Promise<Pqr> {
  const { data } = await post<Pqr>('/quality/pqr/assemble', input)
  return data
}

export async function reviewPqr(
  id: string,
  input: {
    conclusionsNarrative?: string
    trendsNarrative?: string
    recommendedActions?: { description: string; ownerUserId?: string; openCapa?: boolean; rootCauseCategory?: string }[]
    intentStatement: string
    signatureToken: string
  },
): Promise<Pqr> {
  const { data } = await post<Pqr>(`/quality/pqr/${id}/review`, input)
  return data
}
