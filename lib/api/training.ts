import { get, post, type PaginationMeta } from './client'

export type TrainingRecordComputedStatus = 'valid' | 'expiring' | 'expired'

export const TRAINING_STATUS_LABELS: Record<TrainingRecordComputedStatus, string> = {
  valid: 'Valid',
  expiring: 'Expiring',
  expired: 'Expired',
}

export interface TrainingRecord {
  id: string
  companyId: string
  userId: string
  trainingType: string
  title: string
  completionDate: string
  expiryDate: string | null
  certificateDocumentId: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  computedStatus: TrainingRecordComputedStatus
}

export interface CreateTrainingRecordInput {
  userId: string
  trainingType: string
  title: string
  completionDate: string
  expiryDate?: string
}

export async function createTrainingRecord(input: CreateTrainingRecordInput): Promise<TrainingRecord> {
  const { data } = await post<TrainingRecord>('/training-records', input)
  return data
}

export async function attachTrainingCertificate(id: string, documentId: string): Promise<TrainingRecord> {
  const { data } = await post<TrainingRecord>(`/training-records/${id}/certificate`, { documentId })
  return data
}

export interface ListTrainingRecordsResult {
  records: TrainingRecord[]
  meta: PaginationMeta
}

export async function listTrainingRecords(page = 1, limit = 10, q?: string): Promise<ListTrainingRecordsResult> {
  const { data, meta } = await get<TrainingRecord[]>('/training-records', { page, limit, q: q || undefined })
  return { records: data, meta: meta ?? { page: 1, limit, total: data.length, totalPages: 1 } }
}

export async function getTrainingRecord(id: string): Promise<TrainingRecord> {
  const { data } = await get<TrainingRecord>(`/training-records/${id}`)
  return data
}
