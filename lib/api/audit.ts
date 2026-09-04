import { get, PaginationMeta } from './client'

export interface AuditEntry {
  id: string
  companyId: string | null
  actorUserId: string | null
  actorName: string | null
  actorType: 'user' | 'system'
  action: string
  recordType: string
  recordId: string | null
  oldValue: Record<string, unknown> | null
  newValue: Record<string, unknown> | null
  ip: string | null
  occurredAt: string
}

export interface AuditQueryFilters {
  recordType?: string
  recordId?: string
  actorId?: string
  action?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

export interface AuditPage {
  entries: AuditEntry[]
  meta: PaginationMeta
}

export async function getAuditEntries(filters: AuditQueryFilters = {}): Promise<AuditPage> {
  const { data, meta } = await get<AuditEntry[]>('/audit', filters as Record<string, string | number | boolean | undefined>)
  return { entries: data, meta: meta! }
}

export async function getRecordHistory(
  recordType: string,
  recordId: string,
  pagination: { page?: number; limit?: number } = {},
): Promise<AuditPage> {
  const { data, meta } = await get<AuditEntry[]>(
    `/records/${encodeURIComponent(recordType)}/${encodeURIComponent(recordId)}/history`,
    pagination,
  )
  return { entries: data, meta: meta! }
}
