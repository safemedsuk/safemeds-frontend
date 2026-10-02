import { get, PaginationMeta, post } from './client'
import type { Capa } from './internal-audits'
import type { QualityPage } from './quality'

/** QualCloud (Phase 13) Stage 5 — Complaint Handling, the tenant-facing client. */

export const COMPLAINT_CHANNELS = ['phone', 'email', 'written', 'in_person', 'distributor', 'other'] as const
export type ComplaintChannel = (typeof COMPLAINT_CHANNELS)[number]

export const COMPLAINT_CHANNEL_LABELS: Record<ComplaintChannel, string> = {
  phone: 'Phone',
  email: 'Email',
  written: 'Written',
  in_person: 'In Person',
  distributor: 'Distributor',
  other: 'Other',
}

export const COMPLAINT_CLASSIFICATIONS = ['quality_complaint', 'possible_ae'] as const
export type ComplaintClassification = (typeof COMPLAINT_CLASSIFICATIONS)[number]

export interface Complaint {
  id: string
  companyId: string
  complaintNumber: string
  productId: string
  batchId: string | null
  reporterName: string | null
  reporterContact: string | null
  channel: string
  description: string
  classification: string | null
  severity: string | null
  resolutionNote: string | null
  resolvedAt: string | null
  capaId: string | null
  routedCaseId: string | null
  status: string
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface ComplaintDetail extends Complaint {
  workflowInstanceId: string | null
}

export interface CreateComplaintInput {
  productId: string
  batchId?: string
  reporterName?: string
  reporterContact?: string
  channel: string
  description: string
}

export interface ResolutionTimeKpi {
  averageDays: number | null
  withinTargetPercent: number | null
  targetDays: number
  resolvedCount: number
}

export async function listComplaints(
  params: { q?: string; status?: string; classification?: string; productId?: string; page?: number; limit?: number } = {},
): Promise<QualityPage<Complaint>> {
  const { data, meta } = await get<Complaint[]>('/quality/complaints', params as Record<string, string | number | undefined>)
  return { rows: data, meta: meta as PaginationMeta }
}

export async function getResolutionTimeKpi(): Promise<ResolutionTimeKpi> {
  const { data } = await get<ResolutionTimeKpi>('/quality/complaints/resolution-time-kpi')
  return data
}

export async function getComplaint(id: string): Promise<ComplaintDetail> {
  const { data } = await get<ComplaintDetail>(`/quality/complaints/${id}`)
  return data
}

export async function createComplaint(input: CreateComplaintInput): Promise<Complaint> {
  const { data } = await post<Complaint>('/quality/complaints', input)
  return data
}

export async function classifyComplaint(
  id: string,
  input: { classification: string; severity?: string; note?: string },
): Promise<Complaint> {
  const { data } = await post<Complaint>(`/quality/complaints/${id}/classify`, input)
  return data
}

export async function resolveComplaint(id: string, resolutionNote: string): Promise<Complaint> {
  const { data } = await post<Complaint>(`/quality/complaints/${id}/resolve`, { resolutionNote })
  return data
}

export interface OpenCapaForComplaintInput {
  title: string
  correctiveAction: string
  preventiveAction?: string
  rootCauseCategory?: string
  ownerUserId?: string
  dueDate?: string
}

export async function openCapaForComplaint(id: string, input: OpenCapaForComplaintInput): Promise<Capa> {
  const { data } = await post<Capa>(`/quality/complaints/${id}/capa`, input)
  return data
}
