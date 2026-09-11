import { get, post, PaginationMeta } from './client'

/** `qc_reviewed` — real-usage request, 11 Sep 2026 — only ever seen on a periodic report (psur/pbrer/dsur/pader/cioms_ii), which drives its own lifecycle through a real workflow instance rather than the plain `finalize()`/`submit()` pair. */
export type GeneratedReportStatus = 'draft' | 'final' | 'qc_reviewed' | 'submitted'

export interface GeneratedReport {
  id: string
  companyId: string
  moduleKey: string
  reportTypeKey: string
  title: string
  periodStart: string | null
  periodEnd: string | null
  recordType: string | null
  recordId: string | null
  status: GeneratedReportStatus
  dueAt: string | null
  submittedAt: string | null
  generatedBy: string | null
  /** Proof the report was actually dispatched (a portal confirmation, an email receipt) — distinct from the report's own generated PDF. Null until `attachPeriodicReportEvidence()` is called. */
  evidenceDocumentId: string | null
  createdAt: string
  updatedAt: string
}

export interface ListGeneratedReportsFilters {
  moduleKey?: string
  reportTypeKey?: string
  status?: GeneratedReportStatus
  page?: number
  limit?: number
}

export interface GeneratedReportsPage {
  reports: GeneratedReport[]
  meta: PaginationMeta
}

export interface CreateGeneratedReportPayload {
  moduleKey: string
  reportTypeKey: string
  title: string
  periodStart?: string
  periodEnd?: string
  recordType?: string
  recordId?: string
  dueAt?: string
}

export async function listGeneratedReports(filters: ListGeneratedReportsFilters = {}): Promise<GeneratedReportsPage> {
  const { data, meta } = await get<GeneratedReport[]>('/reports', filters as Record<string, string | number | undefined>)
  return { reports: data, meta: meta! }
}

export interface GeneratedReportWithWorkflow extends GeneratedReport {
  /** Set only for a periodic report (psur/pbrer/dsur/pader/cioms_ii) — its real `periodic_report` `WorkflowInstance` id, feed straight into `WorkflowActionsPanel`. Null for every other report type. */
  workflowInstanceId: string | null
}

export async function getGeneratedReport(id: string): Promise<GeneratedReportWithWorkflow> {
  const { data } = await get<GeneratedReportWithWorkflow>(`/reports/${id}`)
  return data
}

export async function createGeneratedReport(payload: CreateGeneratedReportPayload): Promise<GeneratedReport> {
  const { data } = await post<GeneratedReport>('/reports', payload)
  return data
}

export async function finalizeGeneratedReport(id: string): Promise<GeneratedReport> {
  const { data } = await post<GeneratedReport>(`/reports/${id}/finalize`)
  return data
}

export async function submitGeneratedReport(id: string): Promise<GeneratedReport> {
  const { data } = await post<GeneratedReport>(`/reports/${id}/submit`)
  return data
}
