import { get, PaginationMeta, post } from './client'
import type { Capa } from './internal-audits'
import type { QualityPage } from './quality'

/** QualCloud (Phase 13) Stage 6 — OOS/OOT Investigation, the tenant-facing client. */

export const OOS_BATCH_IMPACTS = ['no_impact', 'batch_rejected', 'batch_reworked', 'other_batches_affected'] as const
export type OosBatchImpact = (typeof OOS_BATCH_IMPACTS)[number]

export const OOS_BATCH_IMPACT_LABELS: Record<OosBatchImpact, string> = {
  no_impact: 'No Impact',
  batch_rejected: 'Batch Rejected',
  batch_reworked: 'Batch Reworked',
  other_batches_affected: 'Other Batches Affected',
}

export interface Oos {
  id: string
  companyId: string
  oosNumber: string
  batchId: string
  specificationId: string
  parameterId: string
  testResult: string
  investigationPhase: string
  phase1AssignableCauseFound: boolean | null
  phase1Findings: string | null
  retestAuthorized: boolean | null
  retestRationale: string | null
  phase2Triggered: boolean
  phase2Findings: string | null
  batchImpact: string | null
  capaId: string | null
  status: string
  closedAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface OosDetail extends Oos {
  workflowInstanceId: string | null
}

export interface CreateOosInput {
  batchId: string
  specificationId: string
  parameterId: string
  testResult: string
}

export async function listOos(
  params: { status?: string; batchId?: string; page?: number; limit?: number } = {},
): Promise<QualityPage<Oos>> {
  const { data, meta } = await get<Oos[]>('/quality/oos', params as Record<string, string | number | undefined>)
  return { rows: data, meta: meta as PaginationMeta }
}

export async function getOos(id: string): Promise<OosDetail> {
  const { data } = await get<OosDetail>(`/quality/oos/${id}`)
  return data
}

export async function createOos(input: CreateOosInput): Promise<Oos> {
  const { data } = await post<Oos>('/quality/oos', input)
  return data
}

export async function recordOosPhase1(id: string, input: { assignableCauseFound: boolean; findings?: string }): Promise<Oos> {
  const { data } = await post<Oos>(`/quality/oos/${id}/phase1`, input)
  return data
}

export async function recordOosRetest(id: string, input: { authorized: boolean; rationale: string }): Promise<Oos> {
  const { data } = await post<Oos>(`/quality/oos/${id}/retest`, input)
  return data
}

export async function recordOosPhase2(id: string, input: { findings?: string; batchImpact?: string }): Promise<Oos> {
  const { data } = await post<Oos>(`/quality/oos/${id}/phase2`, input)
  return data
}

export type OpenCapaForOosInput = import('./capa-allocation').CapaAllocationInput

export async function openCapaForOos(id: string, input: OpenCapaForOosInput): Promise<Capa> {
  const { data } = await post<Capa>(`/quality/oos/${id}/capa`, input)
  return data
}
