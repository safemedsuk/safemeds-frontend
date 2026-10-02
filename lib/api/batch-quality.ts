import { get, post } from './client'

/** QualCloud (Phase 13) Stage 7 — Batch Traceability, Record Review & Disposition, the tenant-facing client. */

export const BATCH_RECORD_REVIEW_DISPOSITIONS = ['released', 'rejected', 'reworked'] as const
export type BatchRecordReviewDisposition = (typeof BATCH_RECORD_REVIEW_DISPOSITIONS)[number]

export interface BatchRecordReview {
  id: string
  companyId: string
  batchId: string
  mbrDocumentId: string | null
  reviewerUserId: string
  reviewFindings: string | null
  disposition: string | null
  dispositionedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateBatchRecordReviewInput {
  batchId: string
  mbrDocumentId?: string
  reviewFindings?: string
}

export interface RecordBatchDispositionInput {
  disposition: string
  intentStatement: string
  signatureToken: string
}

export async function listRecordReviewsForBatch(batchId: string): Promise<BatchRecordReview[]> {
  const { data } = await get<BatchRecordReview[]>(`/quality/batches/${batchId}/record-reviews`)
  return data
}

export async function getBatchRecordReview(id: string): Promise<BatchRecordReview> {
  const { data } = await get<BatchRecordReview>(`/quality/batch-record-reviews/${id}`)
  return data
}

export async function createBatchRecordReview(input: CreateBatchRecordReviewInput): Promise<BatchRecordReview> {
  const { data } = await post<BatchRecordReview>('/quality/batch-record-reviews', input)
  return data
}

export async function recordBatchDisposition(id: string, input: RecordBatchDispositionInput): Promise<BatchRecordReview> {
  const { data } = await post<BatchRecordReview>(`/quality/batch-record-reviews/${id}/disposition`, input)
  return data
}

export interface BatchTraceabilityBatchRef {
  id: string
  batchNumber: string
  qualityStatus: string
  productId: string
}

export interface BatchTraceabilityQualityEventRef {
  id: string
  status: string
  createdAt: string
}

export interface BatchTraceabilityResult {
  batch: BatchTraceabilityBatchRef & { parentBatchIds: string[] }
  upstreamBatches: BatchTraceabilityBatchRef[]
  unresolvedUpstreamIds: string[]
  downstreamBatches: BatchTraceabilityBatchRef[]
  deviations: (BatchTraceabilityQualityEventRef & { deviationNumber: string; title: string })[]
  changeControls: (BatchTraceabilityQualityEventRef & { changeNumber: string; title: string })[]
  complaints: (BatchTraceabilityQualityEventRef & { complaintNumber: string })[]
  oosRecords: (BatchTraceabilityQualityEventRef & { oosNumber: string })[]
  recallsOnSameProduct: (BatchTraceabilityQualityEventRef & { reason: string })[]
}

export async function getBatchTraceability(batchId: string): Promise<BatchTraceabilityResult> {
  const { data } = await get<BatchTraceabilityResult>(`/quality/batches/${batchId}/traceability`)
  return data
}
