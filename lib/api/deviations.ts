import { get, post } from './client'
import type { Capa } from './internal-audits'
import type { QualityPage } from './quality'

/** QualCloud (Phase 13) Stage 2 — Deviation & Non-Conformance Management, the tenant-facing client. */

export const DEVIATION_SOURCE_TYPES = [
  'self_reported',
  'audit_finding',
  'oos_triggered',
  'complaint_triggered',
  'monitoring_alert',
] as const
export type DeviationSourceType = (typeof DEVIATION_SOURCE_TYPES)[number]

export const DEVIATION_SOURCE_TYPE_LABELS: Record<DeviationSourceType, string> = {
  self_reported: 'Self-Reported',
  audit_finding: 'Audit Finding',
  oos_triggered: 'OOS-Triggered',
  complaint_triggered: 'Complaint-Triggered',
  monitoring_alert: 'Monitoring Alert',
}

export const ROOT_CAUSE_METHODS = ['five_why', 'fishbone_ishikawa', 'fault_tree', 'is_is_not', 'other'] as const
export type RootCauseMethod = (typeof ROOT_CAUSE_METHODS)[number]

export const ROOT_CAUSE_METHOD_LABELS: Record<RootCauseMethod, string> = {
  five_why: '5 Whys',
  fishbone_ishikawa: 'Fishbone (Ishikawa)',
  fault_tree: 'Fault Tree Analysis',
  is_is_not: 'Is / Is Not Analysis',
  other: 'Other',
}

export type DeviationSeverity = 'critical' | 'major' | 'minor'
export type DeviationStatus = 'detected' | 'classifying' | 'investigating' | 'capa_pending' | 'closed'

export interface Deviation {
  id: string
  companyId: string
  deviationNumber: string
  title: string
  description: string | null
  sourceType: string
  productId: string | null
  batchId: string | null
  equipmentId: string | null
  supplierId: string | null
  sopId: string | null
  detectedAt: string
  raisedBy: string | null
  severity: DeviationSeverity | null
  riskAssessmentId: string | null
  containmentActions: string | null
  investigationDueAt: string | null
  status: DeviationStatus
  closedAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface Investigation {
  id: string
  companyId: string
  deviationId: string
  rootCauseMethod: string | null
  findings: string | null
  evidenceReferences: string | null
  investigatorUserId: string | null
  reviewerUserId: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface DeviationDetail extends Deviation {
  investigation: Investigation | null
  workflowInstanceId: string | null
  /** Pass A2 — every CAPA opened against this deviation, visibility-filtered for the viewer. */
  capas: import('./internal-audits').Capa[]
}

export interface CreateDeviationInput {
  title: string
  description?: string
  sourceType: string
  productId?: string
  batchId?: string
  equipmentId?: string
  supplierId?: string
  sopId?: string
  detectedAt: string
  containmentActions?: string
}

export async function listDeviations(
  params: { q?: string; status?: string; severity?: string; productId?: string; page?: number; limit?: number } = {},
): Promise<QualityPage<Deviation>> {
  const { data, meta } = await get<Deviation[]>('/quality/deviations', params as Record<string, string | number | undefined>)
  return { rows: data, meta: meta! }
}

export async function getDeviation(id: string): Promise<DeviationDetail> {
  const { data } = await get<DeviationDetail>(`/quality/deviations/${id}`)
  return data
}

export async function createDeviation(input: CreateDeviationInput): Promise<Deviation> {
  const { data } = await post<Deviation>('/quality/deviations', input)
  return data
}

export interface RecordInvestigationInput {
  rootCauseMethod?: string
  findings?: string
  evidenceReferences?: string
  investigatorUserId?: string
  reviewerUserId?: string
}

export async function recordInvestigation(deviationId: string, input: RecordInvestigationInput): Promise<Investigation> {
  const { data } = await post<Investigation>(`/quality/deviations/${deviationId}/investigation`, input)
  return data
}

export type OpenCapaForDeviationInput = import('./capa-allocation').CapaAllocationInput

export async function openCapaForDeviation(deviationId: string, input: OpenCapaForDeviationInput): Promise<Capa> {
  const { data } = await post<Capa>(`/quality/deviations/${deviationId}/capa`, input)
  return data
}
