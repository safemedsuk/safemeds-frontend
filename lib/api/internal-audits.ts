import { get, patch, post, type PaginationMeta } from './client'

export type InternalAuditStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
export type AuditFindingSeverity = 'critical' | 'major' | 'minor' | 'observation'
export type AuditFindingStatus = 'open' | 'capa_assigned' | 'closed'
export type CapaStatus = 'open' | 'in_progress' | 'pending_effectiveness_check' | 'closed'
export type CapaEffectivenessResult = 'effective' | 'not_effective'

export const INTERNAL_AUDIT_STATUS_LABELS: Record<InternalAuditStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const AUDIT_FINDING_SEVERITY_LABELS: Record<AuditFindingSeverity, string> = {
  critical: 'Critical',
  major: 'Major',
  minor: 'Minor',
  observation: 'Observation',
}

export const CAPA_STATUS_LABELS: Record<CapaStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  pending_effectiveness_check: 'Pending Effectiveness Check',
  closed: 'Closed',
}

export interface InternalAudit {
  id: string
  companyId: string
  title: string
  scope: string | null
  scheduledDate: string
  status: InternalAuditStatus
  leadAuditorUserId: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface AuditFinding {
  id: string
  companyId: string
  auditId: string
  description: string
  severity: AuditFindingSeverity
  status: AuditFindingStatus
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface InternalAuditWithFindings extends InternalAudit {
  findings: AuditFinding[]
}

export interface Capa {
  id: string
  companyId: string
  findingId: string | null
  title: string
  correctiveAction: string
  preventiveAction: string | null
  ownerUserId: string | null
  dueDate: string | null
  status: CapaStatus
  effectivenessCheckDueAt: string | null
  effectivenessCheckedAt: string | null
  effectivenessCheckedBy: string | null
  effectivenessCheckResult: CapaEffectivenessResult | null
  effectivenessCheckNote: string | null
  closedAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateInternalAuditInput {
  title: string
  scope?: string
  scheduledDate: string
  leadAuditorUserId?: string
}

export async function createInternalAudit(input: CreateInternalAuditInput): Promise<InternalAudit> {
  const { data } = await post<InternalAudit>('/internal-audits', input)
  return data
}

export interface ListInternalAuditsResult {
  audits: InternalAudit[]
  meta: PaginationMeta
}

export async function listInternalAudits(page = 1, limit = 10): Promise<ListInternalAuditsResult> {
  const { data, meta } = await get<InternalAudit[]>('/internal-audits', { page, limit })
  return { audits: data, meta: meta ?? { page: 1, limit, total: data.length, totalPages: 1 } }
}

export async function getInternalAudit(id: string): Promise<InternalAuditWithFindings> {
  const { data } = await get<InternalAuditWithFindings>(`/internal-audits/${id}`)
  return data
}

export async function updateInternalAudit(id: string, input: { status?: InternalAuditStatus; scope?: string }): Promise<InternalAudit> {
  const { data } = await patch<InternalAudit>(`/internal-audits/${id}`, input)
  return data
}

export interface CreateAuditFindingInput {
  description: string
  severity: AuditFindingSeverity
}

export async function addAuditFinding(auditId: string, input: CreateAuditFindingInput): Promise<AuditFinding> {
  const { data } = await post<AuditFinding>(`/internal-audits/${auditId}/findings`, input)
  return data
}

export interface ListAuditFindingsResult {
  findings: AuditFinding[]
  meta: PaginationMeta
}

export async function listAuditFindings(page = 1, limit = 10): Promise<ListAuditFindingsResult> {
  const { data, meta } = await get<AuditFinding[]>('/internal-audits/findings', { page, limit })
  return { findings: data, meta: meta ?? { page: 1, limit, total: data.length, totalPages: 1 } }
}

export interface CreateCapaInput {
  findingId?: string
  title: string
  correctiveAction: string
  preventiveAction?: string
  ownerUserId?: string
  dueDate?: string
}

export async function createCapa(input: CreateCapaInput): Promise<Capa> {
  const { data } = await post<Capa>('/capas', input)
  return data
}

export interface ListCapasResult {
  capas: Capa[]
  meta: PaginationMeta
}

export async function listCapas(page = 1, limit = 10): Promise<ListCapasResult> {
  const { data, meta } = await get<Capa[]>('/capas', { page, limit })
  return { capas: data, meta: meta ?? { page: 1, limit, total: data.length, totalPages: 1 } }
}

export async function getCapa(id: string): Promise<Capa> {
  const { data } = await get<Capa>(`/capas/${id}`)
  return data
}

export interface UpdateCapaInput {
  correctiveAction?: string
  preventiveAction?: string
  ownerUserId?: string
  dueDate?: string
  status?: Exclude<CapaStatus, 'closed'>
}

export async function updateCapa(id: string, input: UpdateCapaInput): Promise<Capa> {
  const { data } = await patch<Capa>(`/capas/${id}`, input)
  return data
}

export async function recordCapaEffectivenessCheck(id: string, result: CapaEffectivenessResult, note?: string): Promise<Capa> {
  const { data } = await post<Capa>(`/capas/${id}/effectiveness-check`, { result, note })
  return data
}

export async function closeCapa(id: string): Promise<Capa> {
  const { data } = await post<Capa>(`/capas/${id}/close`, {})
  return data
}
