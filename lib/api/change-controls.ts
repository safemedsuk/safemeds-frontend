import { get, PaginationMeta, post } from './client'
import type { QualityPage } from './quality'

/** QualCloud (Phase 13) Stage 4 — Change Control, the tenant-facing client. */

export const CHANGE_CONTROL_TYPES = ['like_for_like', 'minor', 'major', 'critical'] as const
export type ChangeControlType = (typeof CHANGE_CONTROL_TYPES)[number]

export const CHANGE_CONTROL_TYPE_LABELS: Record<ChangeControlType, string> = {
  like_for_like: 'Like-for-Like',
  minor: 'Minor',
  major: 'Major',
  critical: 'Critical',
}

export const CHANGE_CONTROL_SCOPES = [
  'process',
  'equipment',
  'facility',
  'supplier',
  'sop',
  'specification',
  'packaging',
  'labeling',
] as const
export type ChangeControlScope = (typeof CHANGE_CONTROL_SCOPES)[number]

export interface ImpactDimension {
  impacted: boolean
  note?: string
}

export interface ChangeImpactAssessment {
  regulatoryImpact: ImpactDimension
  validationImpact: ImpactDimension
  productSafetyImpact: ImpactDimension
  stabilityImpact: ImpactDimension
  otherSpecificationsImpact: ImpactDimension
}

export interface ChangeApprovalEntry {
  role: string
  userId: string
  approvedAt: string
  note?: string
}

export interface ChangeControl {
  id: string
  companyId: string
  changeNumber: string
  title: string
  changeType: string
  changeDescription: string | null
  scope: string
  productId: string | null
  batchId: string | null
  equipmentId: string | null
  supplierId: string | null
  sopId: string | null
  impactAssessment: ChangeImpactAssessment | null
  crossFunctionalApprovals: ChangeApprovalEntry[]
  affectedProductRegistrationId: string | null
  linkedRegVariationId: string | null
  implementationRecord: string | null
  verificationResult: string | null
  status: string
  closedAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface ChangeControlDetail extends ChangeControl {
  workflowInstanceId: string | null
}

export interface CreateChangeControlInput {
  title: string
  changeType: string
  changeDescription?: string
  scope: string
  productId?: string
  batchId?: string
  equipmentId?: string
  supplierId?: string
  sopId?: string
  affectedProductRegistrationId?: string
}

export async function listChangeControls(
  params: { q?: string; status?: string; scope?: string; page?: number; limit?: number } = {},
): Promise<QualityPage<ChangeControl>> {
  const { data, meta } = await get<ChangeControl[]>('/quality/change-controls', params as Record<string, string | number | undefined>)
  return { rows: data, meta: meta as PaginationMeta }
}

export async function getChangeControl(id: string): Promise<ChangeControlDetail> {
  const { data } = await get<ChangeControlDetail>(`/quality/change-controls/${id}`)
  return data
}

export async function createChangeControl(input: CreateChangeControlInput): Promise<ChangeControl> {
  const { data } = await post<ChangeControl>('/quality/change-controls', input)
  return data
}

export async function assessChangeImpact(id: string, input: ChangeImpactAssessment): Promise<ChangeControl> {
  const { data } = await post<ChangeControl>(`/quality/change-controls/${id}/impact-assessment`, input)
  return data
}

export async function recordChangeApproval(id: string, note?: string): Promise<ChangeControl> {
  const { data } = await post<ChangeControl>(`/quality/change-controls/${id}/approval`, { note })
  return data
}

export async function recordChangeImplementation(
  id: string,
  input: { implementationRecord?: string; verificationResult?: string },
): Promise<ChangeControl> {
  const { data } = await post<ChangeControl>(`/quality/change-controls/${id}/implementation`, input)
  return data
}

export async function openLinkedVariation(
  id: string,
  input: { productRegistrationId?: string; variationType?: string } = {},
): Promise<ChangeControl> {
  const { data } = await post<ChangeControl>(`/quality/change-controls/${id}/open-linked-variation`, input)
  return data
}
