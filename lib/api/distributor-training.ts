import { get, post, PaginationMeta } from './client'

/**
 * Real-usage request, 22 Sep 2026 (item 6) — "SDEA has reconciliation
 * and training — proof distributors are actually trained annually;
 * should essentially be a record checklist." A distributor-scoped
 * analog of `lib/api/training.ts` (which is for SafeMeds' own staff),
 * mirroring its shape exactly.
 */
export type DistributorTrainingComputedStatus = 'valid' | 'expiring' | 'expired'
export type DistributorTrainingStatus = DistributorTrainingComputedStatus | 'missing'

export interface DistributorTrainingRecord {
  id: string
  companyId: string
  distributorId: string
  trainingType: string
  title: string
  completionDate: string
  expiryDate: string | null
  certificateDocumentId: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  computedStatus: DistributorTrainingComputedStatus
}

export interface CreateDistributorTrainingRecordInput {
  distributorId: string
  trainingType: string
  title: string
  completionDate: string
  expiryDate?: string
}

export interface ListDistributorTrainingRecordsResult {
  records: DistributorTrainingRecord[]
  meta: PaginationMeta
}

export async function createDistributorTrainingRecord(input: CreateDistributorTrainingRecordInput): Promise<DistributorTrainingRecord> {
  const { data } = await post<DistributorTrainingRecord>('/distributor-training-records', input)
  return data
}

export async function attachDistributorTrainingCertificate(id: string, documentId: string): Promise<DistributorTrainingRecord> {
  const { data } = await post<DistributorTrainingRecord>(`/distributor-training-records/${id}/certificate`, { documentId })
  return data
}

export async function listDistributorTrainingRecords(distributorId?: string, page = 1, limit = 10): Promise<ListDistributorTrainingRecordsResult> {
  const { data, meta } = await get<DistributorTrainingRecord[]>('/distributor-training-records', { distributorId, page, limit })
  return { records: data, meta: meta ?? { page: 1, limit, total: data.length, totalPages: 1 } }
}

export async function getDistributorTrainingStatus(distributorId: string): Promise<{ status: DistributorTrainingStatus; record: DistributorTrainingRecord | null }> {
  const { data } = await get<{ status: DistributorTrainingStatus; record: DistributorTrainingRecord | null }>(`/distributor-training-records/status/${distributorId}`)
  return data
}
