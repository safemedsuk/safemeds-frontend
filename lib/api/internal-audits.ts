import { get, patch, post, type PaginationMeta } from './client'

export type AuditScope = 'internal' | 'supplier' | 'regulatory'
export const AUDIT_SCOPE_LABELS: Record<AuditScope, string> = {
  internal: 'Internal',
  supplier: 'Supplier',
  regulatory: 'Regulatory',
}

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
  auditScope: AuditScope
  supplierId: string | null
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
  sourceRecordType: string | null
  sourceRecordId: string | null
  title: string
  rootCause: string | null
  correction: string | null
  correctiveAction: string
  preventiveAction: string | null
  rootCauseCategory: string | null
  ownerUserId: string | null
  owner?: { id: string; fullName: string } | null
  correctiveActionDueDate: string | null
  preventiveActionDueDate: string | null
  dueDate: string | null
  regulatoryApproverUserId: string | null
  status: CapaStatus
  approvedBy: string | null
  approvedAt: string | null
  implementedAt: string | null
  requiresRegulatoryApproval: boolean
  regulatoryApprovedBy: string | null
  regulatoryApprovedAt: string | null
  flaggedRecurring: boolean
  recurringFlagReason: string | null
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
  auditScope?: AuditScope
  supplierId?: string
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

export type CreateCapaInput = import('./capa-allocation').CapaAllocationInput & {
  sourceRecordType?: string
  sourceRecordId?: string
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
  rootCause?: string
  rootCauseCategory?: string
  rootCauseOther?: string
  correctiveAction?: string
  preventiveAction?: string
  ownerUserId?: string
  correctiveActionDueDate?: string
  preventiveActionDueDate?: string
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

export interface AssignCapaActionInput {
  correction?: string
  correctiveAction?: string
  preventiveAction?: string
  rootCauseCategory?: string
}

export async function assignCapaAction(id: string, input: AssignCapaActionInput): Promise<Capa> {
  const { data } = await post<Capa>(`/capas/${id}/action`, input)
  return data
}

export async function approveCapa(id: string, requiresRegulatoryApproval?: boolean): Promise<Capa> {
  const { data } = await post<Capa>(`/capas/${id}/approve`, { requiresRegulatoryApproval })
  return data
}

export async function regulatoryApproveCapa(id: string): Promise<Capa> {
  const { data } = await post<Capa>(`/capas/${id}/regulatory-approve`, {})
  return data
}

export async function implementCapa(id: string): Promise<Capa> {
  const { data } = await post<Capa>(`/capas/${id}/implement`, {})
  return data
}

// ── QualCloud Stage 9 — conduct-mode checklist ──────────────────────────

export type ChecklistResponseStatus = 'not_reviewed' | 'compliant' | 'non_compliant' | 'not_applicable'
export const CHECKLIST_RESPONSE_STATUS_LABELS: Record<ChecklistResponseStatus, string> = {
  not_reviewed: 'Not Reviewed',
  compliant: 'Compliant',
  non_compliant: 'Non-Compliant',
  not_applicable: 'Not Applicable',
}

export interface InternalAuditChecklistResponse {
  id: string
  auditId: string
  checklistTemplateId: string
  status: ChecklistResponseStatus
  observations: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  checklistTemplate: { title: string; description: string | null; sortOrder: number }
}

export async function startAuditConduct(auditId: string): Promise<InternalAuditChecklistResponse[]> {
  const { data } = await post<InternalAuditChecklistResponse[]>(`/internal-audits/${auditId}/checklist/start`)
  return data
}

export async function listAuditChecklist(auditId: string): Promise<InternalAuditChecklistResponse[]> {
  const { data } = await get<InternalAuditChecklistResponse[]>(`/internal-audits/${auditId}/checklist`)
  return data
}

export async function respondToChecklistItem(
  auditId: string,
  responseId: string,
  input: { status: ChecklistResponseStatus; observations?: string },
): Promise<InternalAuditChecklistResponse> {
  const { data } = await patch<InternalAuditChecklistResponse>(
    `/internal-audits/${auditId}/checklist/${responseId}`,
    input,
  )
  return data
}

// ── QualCloud Stage 9 — regulatory-scope inspection responses ───────────

export interface RegulatoryInspectionResponse {
  id: string
  auditId: string
  findingId: string | null
  responseDueDate: string | null
  responseText: string | null
  evidenceDocumentId: string | null
  submittedAt: string | null
  submittedBy: string | null
}

export async function listRegulatoryInspectionResponses(auditId: string): Promise<RegulatoryInspectionResponse[]> {
  const { data } = await get<RegulatoryInspectionResponse[]>(`/internal-audits/${auditId}/regulatory-responses`)
  return data
}

export async function createRegulatoryInspectionResponse(
  auditId: string,
  input: { findingId?: string; responseDueDate?: string },
): Promise<RegulatoryInspectionResponse> {
  const { data } = await post<RegulatoryInspectionResponse>(`/internal-audits/${auditId}/regulatory-responses`, input)
  return data
}

export async function submitRegulatoryInspectionResponse(
  auditId: string,
  responseId: string,
  responseText: string,
  file?: File,
): Promise<RegulatoryInspectionResponse> {
  const formData = new FormData()
  formData.append('responseText', responseText)
  if (file) formData.append('file', file)
  const { data } = await post<RegulatoryInspectionResponse>(
    `/internal-audits/${auditId}/regulatory-responses/${responseId}/submit`,
    formData,
  )
  return data
}
