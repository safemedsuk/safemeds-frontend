import { get, post } from './client'
import type { DirectUploadResult } from './documents'

/**
 * QualCloud Phase 1 Pass A2 — the one CAPA allocation shape every CAPA
 * opener (CAPA form, Deviation, OOS/OOT, Complaint, Audit Finding) sends.
 * Mirrors `CapaAllocationDto` on the backend — the backend is the authority
 * on every rule; this file only lets the UI ask the right questions.
 */
export interface CapaAllocationInput {
  findingId?: string
  rootCause: string
  rootCauseCategory: string
  rootCauseOther?: string
  correctiveAction: string
  preventiveAction?: string
  ownerUserId: string
  correctiveActionDueDate: string
  preventiveActionDueDate?: string
  requiresRegulatoryApproval?: boolean
  regulatoryApproverUserId?: string
}

export interface RootCauseCategory {
  key: string
  label: string
}

export interface AssignableUser {
  id: string
  fullName: string
}

export async function listRootCauseCategories(): Promise<RootCauseCategory[]> {
  const { data } = await get<RootCauseCategory[]>('/capas/root-cause-categories')
  return data
}

export async function listCapaOwners(): Promise<AssignableUser[]> {
  const { data } = await get<AssignableUser[]>('/capas/assignable-owners')
  return data
}

export async function listRegulatoryApprovers(): Promise<AssignableUser[]> {
  const { data } = await get<AssignableUser[]>('/capas/assignable-regulatory-approvers')
  return data
}

/** Closing evidence for a CAPA — server-proxied, the same path every other document upload in this app uses. */
export async function uploadCapaEvidence(capaId: string, file: File): Promise<DirectUploadResult> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await post<DirectUploadResult>(`/capas/${capaId}/evidence`, formData)
  return data
}

export async function reassignRegulatoryApprover(capaId: string, regulatoryApproverUserId: string): Promise<unknown> {
  const { data } = await post<unknown>(`/capas/${capaId}/regulatory-approver`, { regulatoryApproverUserId })
  return data
}

/** Investigation/finding/substantiation documents: POSTed to a record-specific route that also writes the audit entry. */
export async function uploadRecordFile(path: string, file: File): Promise<DirectUploadResult> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await post<DirectUploadResult>(path, formData)
  return data
}
