import { get, post } from './client'

/**
 * QualCloud (Phase 13) Stage 13 — Annual Product Quality Review (APQR). Renamed from PQR in
 * Phase 2 Pass C; the API path (`/quality/pqr`) is unchanged.
 */

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
  recallCount?: number
  openQualityTrendFlags: string[]
  stabilityNote: string
  /** The frozen cross-module snapshot (sections 1–14). Shape is owned by the backend's apqr-sections.ts. */
  snapshot?: Record<string, unknown>
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

/** Dates are optional: omitted = 1 January to 31 December of the current year, UTC. */
export async function assemblePqr(input: {
  productId: string
  periodStart?: string
  periodEnd?: string
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

/** Short-lived link to the archived file of a signed APQR. Refused (409) while still a draft. */
export async function getApqrDownloadUrl(id: string, format: 'pdf' | 'xlsx'): Promise<{ url: string; filename: string }> {
  const { data } = await get<{ url: string; filename: string }>(`/quality/pqr/${id}/download`, { format })
  return data
}
