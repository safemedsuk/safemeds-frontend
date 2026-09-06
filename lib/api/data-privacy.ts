import { get, post } from './client'

export type DataSubjectRequestType = 'export' | 'erasure'
export type DataSubjectRequestStatus = 'pending' | 'completed' | 'blocked'

export interface DataSubjectRequest {
  id: string
  companyId: string
  recordType: string
  recordId: string
  requestType: DataSubjectRequestType
  status: DataSubjectRequestStatus
  requestedBy: string
  blockedReason: string | null
  completedAt: string | null
  createdAt: string
}

export async function createDataSubjectRequest(
  recordType: string,
  recordId: string,
  requestType: DataSubjectRequestType,
): Promise<DataSubjectRequest> {
  const { data } = await post<DataSubjectRequest>('/data-subject-requests', { recordType, recordId, requestType })
  return data
}

export async function listDataSubjectRequests(
  status?: DataSubjectRequestStatus,
  page = 1,
): Promise<{ requests: DataSubjectRequest[]; totalPages: number }> {
  const { data, meta } = await get<DataSubjectRequest[]>('/data-subject-requests', { status, page, limit: 25 })
  return { requests: data, totalPages: meta?.totalPages ?? 1 }
}
