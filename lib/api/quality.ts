import { get, PaginationMeta, patch, post } from './client'

/** QualCloud (Phase 13) Stage 0 — Foundation Layer, the tenant-facing client. */

export interface QualityPage<T> {
  rows: T[]
  meta: PaginationMeta
}

// ── Suppliers (0.1) ──────────────────────────────────────────────────────

export type SupplierCriticality = 'critical' | 'non_critical'
export type SupplierApprovalStatus = 'pending' | 'approved' | 'suspended' | 'disqualified'

export interface Supplier {
  id: string
  companyId: string
  name: string
  supplierType: string
  countryId: string | null
  address: string | null
  criticality: SupplierCriticality
  approvalStatus: SupplierApprovalStatus
  manufacturerId: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  /** Pass B (D1) — approval requires this to be set. */
  gmpCertificateDocumentId?: string | null
  lastQualifiedAt?: string | null
  nextRequalificationDueAt?: string | null
}

/** Pass B (D2/D3) — one biennial performance review, with its checklist document. */
export interface SupplierReview {
  id: string
  supplierId: string
  performanceFlags: string[]
  notes: string | null
  reviewedAt: string
  nextReviewDueAt: string
  checklistDocument: { id: string; title: string } | null
}

export interface CreateSupplierInput {
  name: string
  supplierType: string
  countryId?: string
  address?: string
  criticality?: SupplierCriticality
  manufacturerId?: string
}

export interface UpdateSupplierInput extends Partial<CreateSupplierInput> {
  approvalStatus?: SupplierApprovalStatus
}

export async function listSuppliers(
  params: { q?: string; criticality?: string; approvalStatus?: string; page?: number; limit?: number } = {},
): Promise<QualityPage<Supplier>> {
  const { data, meta } = await get<Supplier[]>('/quality/suppliers', params as Record<string, string | number | undefined>)
  return { rows: data, meta: meta! }
}

export async function createSupplier(input: CreateSupplierInput): Promise<Supplier> {
  const { data } = await post<Supplier>('/quality/suppliers', input)
  return data
}

export async function updateSupplier(id: string, input: UpdateSupplierInput): Promise<Supplier> {
  const { data } = await patch<Supplier>(`/quality/suppliers/${id}`, input)
  return data
}

export async function deactivateSupplier(id: string): Promise<Supplier> {
  const { data } = await post<Supplier>(`/quality/suppliers/${id}/deactivate`)
  return data
}

// ── Equipment (0.1) ──────────────────────────────────────────────────────

export type EquipmentQualificationStatus =
  | 'not_qualified'
  | 'dq_complete'
  | 'iq_complete'
  | 'oq_complete'
  | 'pq_complete'
  | 'qualified'
  | 'requalification_due'
  | 'disqualified'

export interface Equipment {
  id: string
  companyId: string
  facilityId: string | null
  name: string
  equipmentType: string
  assetTag: string | null
  qualificationStatus: EquipmentQualificationStatus
  calibrationDueAt: string | null
  lastCalibratedAt: string | null
  maintenanceDueAt: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  /** Pass B (C1/C2) — derived live by the backend from the due dates. */
  calibrationStatus?: 'not_scheduled' | 'current' | 'due_soon' | 'overdue'
  maintenanceStatus?: 'not_scheduled' | 'current' | 'due_soon' | 'overdue'
  latestMaintenance?: MaintenanceRecord | null
}

export interface CreateEquipmentInput {
  facilityId?: string
  name: string
  equipmentType: string
  assetTag?: string
  qualificationStatus?: EquipmentQualificationStatus
  calibrationDueAt?: string
  lastCalibratedAt?: string
  maintenanceDueAt?: string
}

export type UpdateEquipmentInput = Partial<CreateEquipmentInput>

export async function listEquipment(
  params: { q?: string; facilityId?: string; qualificationStatus?: string; page?: number; limit?: number } = {},
): Promise<QualityPage<Equipment>> {
  const { data, meta } = await get<Equipment[]>('/quality/equipment', params as Record<string, string | number | undefined>)
  return { rows: data, meta: meta! }
}

export async function createEquipment(input: CreateEquipmentInput): Promise<Equipment> {
  const { data } = await post<Equipment>('/quality/equipment', input)
  return data
}

export async function updateEquipment(id: string, input: UpdateEquipmentInput): Promise<Equipment> {
  const { data } = await patch<Equipment>(`/quality/equipment/${id}`, input)
  return data
}

export async function deactivateEquipment(id: string): Promise<Equipment> {
  const { data } = await post<Equipment>(`/quality/equipment/${id}/deactivate`)
  return data
}

// ── Supplier Qualification (Stage 11) ──────────────────────────────────

export interface SupplierQuestionnaireCriterion {
  question: string
  weight: number
  score: number
  notes?: string
}

export interface SupplierQuestionnaire {
  id: string
  supplierId: string
  title: string
  criteria: SupplierQuestionnaireCriterion[]
  overallScore: number | null
  assessedBy: string | null
  assessedAt: string
}

export async function assessSupplier(
  supplierId: string,
  input: { title: string; criteria: SupplierQuestionnaireCriterion[] },
): Promise<SupplierQuestionnaire> {
  const { data } = await post<SupplierQuestionnaire>(
    `/quality/supplier-qualification/${supplierId}/assess`,
    input,
  )
  return data
}

export async function listSupplierQuestionnaires(supplierId: string): Promise<SupplierQuestionnaire[]> {
  const { data } = await get<SupplierQuestionnaire[]>(
    `/quality/supplier-qualification/${supplierId}/questionnaires`,
  )
  return data
}

export async function scheduleSupplierAudit(
  supplierId: string,
  input: { scheduledDate: string; leadAuditorUserId?: string },
): Promise<{ id: string }> {
  const { data } = await post<{ id: string }>(
    `/quality/supplier-qualification/${supplierId}/schedule-audit`,
    input,
  )
  return data
}

export async function approveSupplier(
  supplierId: string,
  input: { approvalStatus: 'approved' | 'suspended' | 'disqualified'; note?: string },
): Promise<Supplier> {
  const { data } = await post<Supplier>(`/quality/supplier-qualification/${supplierId}/approve`, input)
  return data
}

/** Pass B (D2) — a biennial review needs its checklist uploaded first (`uploadSupplierReviewChecklist`). */
export async function monitorSupplier(
  supplierId: string,
  input: { flag: string; checklistDocumentId: string; notes?: string },
): Promise<Supplier> {
  const { data } = await post<Supplier>(`/quality/supplier-qualification/${supplierId}/monitor`, input)
  return data
}

/** Pass B (D1) — uploads the supplier's GMP certificate. Approval is refused until one is on file. */
export async function uploadSupplierGmpCertificate(supplierId: string, file: File): Promise<Supplier> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await post<Supplier>(`/quality/supplier-qualification/${supplierId}/gmp-certificate`, formData)
  return data
}

/** Pass B (D2) — uploads the review checklist; returns its id for `monitorSupplier`. */
export async function uploadSupplierReviewChecklist(supplierId: string, file: File): Promise<{ documentId: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await post<{ documentId: string }>(
    `/quality/supplier-qualification/${supplierId}/review-checklist`,
    formData,
  )
  return data
}

export async function listSupplierReviews(supplierId: string): Promise<SupplierReview[]> {
  const { data } = await get<SupplierReview[]>(`/quality/supplier-qualification/${supplierId}/reviews`)
  return data
}

export async function listApprovedSuppliers(): Promise<Supplier[]> {
  const { data } = await get<Supplier[]>('/quality/supplier-qualification/approved-list')
  return data
}

export interface CertificateOfAnalysisResult {
  parameterId: string
  parameterName: string
  resultValue: string
  pass?: boolean
}

export interface CertificateOfAnalysis {
  id: string
  supplierId: string
  materialSpecificationId: string
  batchOrLotNumber: string
  results: CertificateOfAnalysisResult[]
  disposition: 'accepted' | 'rejected' | 'quarantined'
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
}

export async function createCoa(input: {
  supplierId: string
  materialSpecificationId: string
  batchOrLotNumber: string
  results: { parameterId: string; parameterName: string; resultValue: string }[]
}): Promise<CertificateOfAnalysis> {
  const { data } = await post<CertificateOfAnalysis>('/quality/certificates-of-analysis', input)
  return data
}

export async function listCoa(supplierId?: string): Promise<CertificateOfAnalysis[]> {
  const { data } = await get<CertificateOfAnalysis[]>('/quality/certificates-of-analysis', supplierId ? { supplierId } : undefined)
  return data
}

export async function reviewCoa(
  id: string,
  disposition: 'accepted' | 'rejected' | 'quarantined',
): Promise<CertificateOfAnalysis> {
  const { data } = await post<CertificateOfAnalysis>(`/quality/certificates-of-analysis/${id}/review`, {
    disposition,
  })
  return data
}

// ── Equipment Qualification, Calibration, Maintenance (Stage 14) ──────

export interface EquipmentQualificationEvent {
  id: string
  equipmentId: string
  stage: 'dq' | 'iq' | 'oq' | 'pq'
  result: 'pass' | 'fail'
  notes: string | null
  performedBy: string | null
  performedAt: string
}

/** Pass B (C3) — uploads a validation report for this equipment; a passing step cites the returned id. */
export async function uploadEquipmentValidationReport(
  equipmentId: string,
  file: File,
): Promise<{ documentId: string; title: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await post<{ documentId: string; title: string }>(
    `/quality/equipment/${equipmentId}/validation-reports`,
    formData,
  )
  return data
}

export async function recordEquipmentQualificationEvent(
  equipmentId: string,
  input: { stage: 'dq' | 'iq' | 'oq' | 'pq'; result?: 'pass' | 'fail'; notes?: string; reportDocumentId?: string },
): Promise<EquipmentQualificationEvent> {
  const { data } = await post<EquipmentQualificationEvent>(
    `/quality/equipment/${equipmentId}/qualification-events`,
    input,
  )
  return data
}

export async function listEquipmentQualificationEvents(
  equipmentId: string,
): Promise<EquipmentQualificationEvent[]> {
  const { data } = await get<EquipmentQualificationEvent[]>(
    `/quality/equipment/${equipmentId}/qualification-events`,
  )
  return data
}

export interface MaintenanceRecord {
  id: string
  equipmentId: string
  maintenanceDate: string
  description: string
  performedBy: string | null
  nextDueAt: string | null
  createdAt: string
}

export async function recordMaintenance(
  equipmentId: string,
  input: { maintenanceDate: string; description: string; nextDueAt?: string },
): Promise<MaintenanceRecord> {
  const { data } = await post<MaintenanceRecord>(`/quality/equipment/${equipmentId}/maintenance-records`, input)
  return data
}

export async function listMaintenanceRecords(equipmentId: string): Promise<MaintenanceRecord[]> {
  const { data } = await get<MaintenanceRecord[]>(`/quality/equipment/${equipmentId}/maintenance-records`)
  return data
}

// ── Controlled documents / Sop (0.1, 0.2) ───────────────────────────────
// Bare CRUD only — status always starts and stays `draft` until Stage 1's
// real Draft→Review&Approve→Effective→Read&Understand→Revise/Retire
// workflow ships; `update()` only succeeds while `status === 'draft'`.

export interface Sop {
  id: string
  companyId: string
  documentNumber: string
  title: string
  documentType: string
  productId: string | null
  processArea: string | null
  currentVersion: number
  status: string
  effectiveDate: string | null
  nextPeriodicReviewDueAt: string | null
  supersedesDocumentId: string | null
  acknowledgmentWindowDays: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface SopDetail extends Sop {
  workflowInstanceId: string | null
}

export interface CreateSopInput {
  title: string
  documentType: string
  /** Optional manual number. Omit to let SafeMeds generate one from the company scheme. */
  documentNumber?: string
  productId?: string
  processArea?: string
  nextPeriodicReviewDueAt?: string
}

export type UpdateSopInput = Partial<CreateSopInput>

export async function listSops(
  params: { q?: string; productId?: string; documentType?: string; status?: string; page?: number; limit?: number } = {},
): Promise<QualityPage<Sop>> {
  const { data, meta } = await get<Sop[]>('/quality/sops', params as Record<string, string | number | undefined>)
  return { rows: data, meta: meta! }
}

export async function createSop(input: CreateSopInput): Promise<Sop> {
  const { data } = await post<Sop>('/quality/sops', input)
  return data
}

export async function getSop(id: string): Promise<SopDetail> {
  const { data } = await get<SopDetail>(`/quality/sops/${id}`)
  return data
}

export async function updateSop(id: string, input: UpdateSopInput): Promise<Sop> {
  const { data } = await patch<Sop>(`/quality/sops/${id}`, input)
  return data
}

export async function reviseSop(id: string): Promise<Sop> {
  const { data } = await post<Sop>(`/quality/sops/${id}/revise`)
  return data
}

// ── Document acknowledgments (Stage 1) — read-and-understand tracking ───

export interface DocumentAcknowledgment {
  id: string
  companyId: string
  sopId: string
  userId: string
  versionAcknowledged: number
  assignedAt: string
  acknowledgedAt: string | null
  overdue: boolean
}

export async function listAcknowledgmentsForDocument(sopId: string): Promise<DocumentAcknowledgment[]> {
  const { data } = await get<DocumentAcknowledgment[]>(`/quality/sops/${sopId}/acknowledgments`)
  return data
}

/** Pass A: minimal active-user list for the reader picker (no users.view needed). */
export interface AssignableReader {
  id: string
  fullName: string
  email: string
}
export async function listAssignableReaders(): Promise<AssignableReader[]> {
  const { data } = await get<AssignableReader[]>('/quality/sops/assignable-readers')
  return data
}

export async function assignReaders(sopId: string, userIds: string[]): Promise<DocumentAcknowledgment[]> {
  const { data } = await post<DocumentAcknowledgment[]>(`/quality/sops/${sopId}/acknowledgments/assign`, { userIds })
  return data
}

export async function acknowledgeDocument(sopId: string): Promise<DocumentAcknowledgment> {
  const { data } = await post<DocumentAcknowledgment>(`/quality/sops/${sopId}/acknowledgments/acknowledge`)
  return data
}

export async function listOverdueAcknowledgments(): Promise<(DocumentAcknowledgment & { sopTitle: string })[]> {
  const { data } = await get<(DocumentAcknowledgment & { sopTitle: string })[]>('/quality/document-acknowledgments/overdue')
  return data
}

// ── Specifications (0.1) ─────────────────────────────────────────────────

export interface SpecificationParameter {
  id: string
  parameterName: string
  testMethod: string | null
  lowerLimit: string | null
  upperLimit: string | null
  unit: string | null
  sortOrder: number
}

export interface Specification {
  id: string
  companyId: string
  specificationNumber: string
  title: string
  specificationType: string
  productId: string | null
  supplierId: string | null
  version: number
  status: string
  effectiveDate: string | null
  parameters: SpecificationParameter[]
  createdAt: string
  updatedAt: string
}

export interface SpecificationParameterInput {
  parameterName: string
  testMethod?: string
  lowerLimit?: string
  upperLimit?: string
  unit?: string
  sortOrder?: number
}

export interface CreateSpecificationInput {
  specificationNumber: string
  title: string
  specificationType: string
  productId?: string
  supplierId?: string
  parameters?: SpecificationParameterInput[]
}

export interface UpdateSpecificationInput {
  title?: string
  specificationType?: string
  productId?: string
  supplierId?: string
  parameters?: SpecificationParameterInput[]
}

export async function listSpecifications(
  params: { q?: string; productId?: string; supplierId?: string; specificationType?: string; page?: number; limit?: number } = {},
): Promise<QualityPage<Specification>> {
  const { data, meta } = await get<Specification[]>('/quality/specifications', params as Record<string, string | number | undefined>)
  return { rows: data, meta: meta! }
}

export async function createSpecification(input: CreateSpecificationInput): Promise<Specification> {
  const { data } = await post<Specification>('/quality/specifications', input)
  return data
}

export async function updateSpecification(id: string, input: UpdateSpecificationInput): Promise<Specification> {
  const { data } = await patch<Specification>(`/quality/specifications/${id}`, input)
  return data
}

// ── Retention policies (0.2) — ALCOA+ ────────────────────────────────────

export interface RetentionPolicy {
  id: string
  companyId: string
  recordType: string
  retentionYears: number
  createdAt: string
  updatedAt: string
}

export async function listRetentionPolicies(
  params: { page?: number; limit?: number } = {},
): Promise<QualityPage<RetentionPolicy>> {
  const { data, meta } = await get<RetentionPolicy[]>('/quality/retention-policies', params as Record<string, number | undefined>)
  return { rows: data, meta: meta! }
}

export async function getRetentionPolicyDefault(recordType: string): Promise<{ recordType: string; retentionYears: number | null }> {
  const { data } = await get<{ recordType: string; retentionYears: number | null }>(
    `/quality/retention-policies/defaults/${recordType}`,
  )
  return data
}

export async function upsertRetentionPolicy(recordType: string, retentionYears: number): Promise<RetentionPolicy> {
  const { data } = await post<RetentionPolicy>('/quality/retention-policies', { recordType, retentionYears })
  return data
}

/**
 * Mirrors `RETENTION_POLICY_DEFAULT_YEARS` in
 * `retention-policy.service.ts` exactly — the coded WHO-GMP-aligned
 * defaults every company starts with until it sets its own override.
 * `training_record`'s real default ("duration of employment plus 3
 * years") isn't a flat year count and is deliberately left out of this
 * list, same honest-deferral reasoning as the backend constant's own
 * doc comment.
 */
export const RETENTION_RECORD_TYPES: { key: string; label: string; defaultYears: number }[] = [
  { key: 'controlled_document', label: 'Controlled Documents (SOPs)', defaultYears: 10 },
  { key: 'master_batch_record', label: 'Master Batch Records', defaultYears: 10 },
  { key: 'deviation', label: 'Deviations', defaultYears: 5 },
  { key: 'capa', label: 'CAPAs', defaultYears: 5 },
  { key: 'complaint', label: 'Complaints', defaultYears: 5 },
  { key: 'oos_oot', label: 'OOS / OOT Investigations', defaultYears: 5 },
]

// ── Risk assessments (0.3) — ICH Q9 live risk register ───────────────────

export type RiskMethod = 'fmea' | 'fault_tree' | 'risk_matrix_2x2' | 'haccp' | 'other'
export type RiskLevel = 'low' | 'medium' | 'high'

export interface RiskAssessment {
  id: string
  companyId: string
  sourceRecordType: string | null
  sourceRecordId: string | null
  title: string
  riskMethod: RiskMethod
  severity: number
  probability: number
  detectability: number | null
  score: number
  riskLevel: RiskLevel
  mitigationActions: string | null
  capaId: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateRiskAssessmentInput {
  sourceRecordType?: string
  sourceRecordId?: string
  title: string
  riskMethod?: RiskMethod
  severity: number
  probability: number
  detectability?: number
  mitigationActions?: string
  capaId?: string
}

export type UpdateRiskAssessmentInput = Partial<Omit<CreateRiskAssessmentInput, 'sourceRecordType' | 'sourceRecordId'>>

export async function listRiskAssessments(
  params: { sourceRecordType?: string; sourceRecordId?: string; riskLevel?: string; page?: number; limit?: number } = {},
): Promise<QualityPage<RiskAssessment>> {
  const { data, meta } = await get<RiskAssessment[]>('/quality/risk-assessments', params as Record<string, string | number | undefined>)
  return { rows: data, meta: meta! }
}

export async function createRiskAssessment(input: CreateRiskAssessmentInput): Promise<RiskAssessment> {
  const { data } = await post<RiskAssessment>('/quality/risk-assessments', input)
  return data
}

export async function updateRiskAssessment(id: string, input: UpdateRiskAssessmentInput): Promise<RiskAssessment> {
  const { data } = await patch<RiskAssessment>(`/quality/risk-assessments/${id}`, input)
  return data
}

// ── Severity definitions (0.3) ───────────────────────────────────────────

export interface SeverityDefinition {
  key: 'critical' | 'major' | 'minor'
  label: string
  description: string
}

export async function getSeverityDefinitions(): Promise<SeverityDefinition[]> {
  const { data } = await get<SeverityDefinition[]>('/quality/config/severity-definitions')
  return data
}

// ── Stage 15 — Pharmaceutical Waste Management ──────────────────────────

export interface WasteDisposalRecord {
  id: string
  companyId: string
  productId: string | null
  batchId: string | null
  wasteType: string
  quantity: string
  unit: string
  disposalMethod: string
  disposalFacilityName: string | null
  disposalCertificateDocumentId: string | null
  witnessedByUserId: string | null
  witnessedAt: string | null
  disposedAt: string
  createdAt: string
}

export interface WasteDisposalMethodCatalogEntry {
  id: string
  methodKey: string
  label: string
  sortOrder: number
  active: boolean
}

export interface CreateWasteDisposalRecordInput {
  productId?: string
  batchId?: string
  wasteType: string
  quantity: string
  unit: string
  disposalMethod: string
  disposalFacilityName?: string
  disposalCertificateDocumentId?: string
  disposedAt: string
}

export async function listWasteDisposalRecords(
  params: { batchId?: string; productId?: string; page?: number; limit?: number } = {},
): Promise<QualityPage<WasteDisposalRecord>> {
  const { data, meta } = await get<WasteDisposalRecord[]>(
    '/quality/waste-disposal',
    params as Record<string, string | number | undefined>,
  )
  return { rows: data, meta: meta! }
}

export async function createWasteDisposalRecord(
  input: CreateWasteDisposalRecordInput,
): Promise<WasteDisposalRecord> {
  const { data } = await post<WasteDisposalRecord>('/quality/waste-disposal', input)
  return data
}

export async function witnessWasteDisposalRecord(
  id: string,
  input: { intentStatement: string; signatureToken: string },
): Promise<WasteDisposalRecord> {
  const { data } = await post<WasteDisposalRecord>(`/quality/waste-disposal/${id}/witness`, input)
  return data
}

export async function listActiveWasteDisposalMethods(): Promise<WasteDisposalMethodCatalogEntry[]> {
  const { data } = await get<WasteDisposalMethodCatalogEntry[]>('/quality/waste-disposal-methods')
  return data
}

// ── Stage 16 — Falsified & Substandard Product Handling ─────────────────

export type FalsifiedProductReportStatus = 'reported' | 'confirmed' | 'dismissed' | 'closed'

export interface FalsifiedProductReport {
  id: string
  companyId: string
  productId: string | null
  batchId: string | null
  reportedBy: string | null
  source: string
  scannedCode: string | null
  evidenceDescription: string
  evidenceDocumentIds: string[]
  authorityNotified: boolean
  status: FalsifiedProductReportStatus
  linkedDeviationId: string | null
  linkedCaseId: string | null
  linkedRecallId: string | null
  dismissedReason: string | null
  createdAt: string
}

export interface CreateFalsifiedProductReportInput {
  productId?: string
  batchId?: string
  source: string
  scannedCode?: string
  evidenceDescription: string
  evidenceDocumentIds?: string[]
}

export async function listFalsifiedProductReports(
  params: { status?: string; page?: number; limit?: number } = {},
): Promise<QualityPage<FalsifiedProductReport>> {
  const { data, meta } = await get<FalsifiedProductReport[]>(
    '/quality/falsified-product-reports',
    params as Record<string, string | number | undefined>,
  )
  return { rows: data, meta: meta! }
}

export async function getFalsifiedProductReport(id: string): Promise<FalsifiedProductReport> {
  const { data } = await get<FalsifiedProductReport>(`/quality/falsified-product-reports/${id}`)
  return data
}

export async function createFalsifiedProductReport(
  input: CreateFalsifiedProductReportInput,
): Promise<FalsifiedProductReport> {
  const { data } = await post<FalsifiedProductReport>('/quality/falsified-product-reports', input)
  return data
}

export async function confirmFalsifiedProductReport(
  id: string,
  input: { routeToPvCase?: boolean; authorityNotified?: boolean },
): Promise<FalsifiedProductReport> {
  const { data } = await post<FalsifiedProductReport>(
    `/quality/falsified-product-reports/${id}/confirm`,
    input,
  )
  return data
}

export async function dismissFalsifiedProductReport(
  id: string,
  input: { reason: string },
): Promise<FalsifiedProductReport> {
  const { data } = await post<FalsifiedProductReport>(
    `/quality/falsified-product-reports/${id}/dismiss`,
    input,
  )
  return data
}

export async function closeFalsifiedProductReport(id: string): Promise<FalsifiedProductReport> {
  const { data } = await post<FalsifiedProductReport>(`/quality/falsified-product-reports/${id}/close`)
  return data
}

// ── Stage 17 — Batch Release (Qualified Person) ──────────────────────────

export interface ReleaseReadinessItem {
  key: string
  label: string
  passed: boolean
  recordType?: string
  recordId?: string
  detail?: string
}

export interface ReleaseReadiness {
  batchId: string
  qualityStatus: string
  allPassed: boolean
  items: ReleaseReadinessItem[]
}

export interface BatchReleaseDecision {
  id: string
  companyId: string
  batchId: string
  batchRecordReviewId: string
  decision: string
  riskAcceptances: { recordType: string; recordId: string; reason: string }[]
  releasedByUserId: string
  releasedAt: string
}

export async function getBatchReleaseReadiness(batchId: string): Promise<ReleaseReadiness> {
  const { data } = await get<ReleaseReadiness>(`/quality/batches/${batchId}/release/readiness`)
  return data
}

export async function listBatchReleaseDecisions(batchId: string): Promise<BatchReleaseDecision[]> {
  const { data } = await get<BatchReleaseDecision[]>(`/quality/batches/${batchId}/release`)
  return data
}

export async function releaseBatch(
  batchId: string,
  input: {
    decision: 'released' | 'rejected'
    riskAcceptances: { recordType: string; recordId: string; reason: string }[]
    intentStatement: string
    signatureToken: string
  },
): Promise<BatchReleaseDecision> {
  const { data } = await post<BatchReleaseDecision>(`/quality/batches/${batchId}/release`, input)
  return data
}

// ── Stage 18 — Validation (Process/Cleaning/Method) & Computer System Validation ──

export type ValidationType = 'process' | 'cleaning' | 'analytical_method' | 'computer_system'

export interface ValidationProtocol {
  id: string
  companyId: string
  title: string
  validationType: ValidationType
  approach: string | null
  gampCategory: string | null
  productId: string | null
  equipmentId: string | null
  protocolDocumentId: string
  protocolDocument: { id: string; documentNumber: string; status: string; currentVersion: number }
  nextRevalidationDueAt: string | null
  createdAt: string
}

export interface ValidationReport {
  id: string
  companyId: string
  protocolId: string
  executionRecords: Record<string, unknown> | null
  reportDocumentId: string | null
  conclusion: string | null
  executedBy: string | null
  executedAt: string | null
  createdAt: string
}

export interface CreateValidationProtocolInput {
  title: string
  validationType: ValidationType
  approach?: string
  gampCategory?: string
  productId?: string
  equipmentId?: string
  nextRevalidationDueAt?: string
}

export async function listValidationProtocols(
  params: { validationType?: string; page?: number; limit?: number } = {},
): Promise<QualityPage<ValidationProtocol>> {
  const { data, meta } = await get<ValidationProtocol[]>(
    '/quality/validation-protocols',
    params as Record<string, string | number | undefined>,
  )
  return { rows: data, meta: meta! }
}

export async function getValidationProtocol(id: string): Promise<ValidationProtocol> {
  const { data } = await get<ValidationProtocol>(`/quality/validation-protocols/${id}`)
  return data
}

export async function createValidationProtocol(
  input: CreateValidationProtocolInput,
): Promise<ValidationProtocol> {
  const { data } = await post<ValidationProtocol>('/quality/validation-protocols', input)
  return data
}

export async function listValidationReports(protocolId: string): Promise<ValidationReport[]> {
  const { data } = await get<ValidationReport[]>(`/quality/validation-protocols/${protocolId}/reports`)
  return data
}

export async function createValidationReport(
  protocolId: string,
  input: { executionRecords?: Record<string, unknown>; reportDocumentId?: string; conclusion?: string },
): Promise<ValidationReport> {
  const { data } = await post<ValidationReport>(`/quality/validation-protocols/${protocolId}/reports`, input)
  return data
}

export async function finalizeValidationReport(
  id: string,
  input: { conclusion: string },
): Promise<ValidationReport> {
  const { data } = await post<ValidationReport>(`/quality/validation-protocols/reports/${id}/finalize`, input)
  return data
}

/**
 * Phase 2 Pass C — the full risk register as an Excel workbook or CSV, downloaded
 * as a file. Audited on the server. Uses the session cookie like every other call.
 */
export async function downloadRiskRegister(format: 'xlsx' | 'csv'): Promise<void> {
  const { API_BASE_URL } = await import('./client')
  const response = await fetch(`${API_BASE_URL}/quality/risk-assessments/export?format=${format}`, {
    credentials: 'include',
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error?.message ?? 'The risk register could not be exported.')
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)
  anchor.href = url
  anchor.download = `risk-register-${stamp}.${format}`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
