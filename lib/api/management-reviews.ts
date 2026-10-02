import { get, post } from './client'
import type { QualityMetricsSnapshot, QualityTrendFlag } from './quality-metrics'

export interface ManagementReviewAction {
  description: string
  ownerUserId?: string
  openCapa?: boolean
  rootCauseCategory?: string
  capaId: string | null
}

export interface ManagementReview {
  id: string
  companyId: string
  period: string
  reviewDate: string
  attendees: string | null
  metricsSnapshot: QualityMetricsSnapshot
  recurringIssueFlagsSnapshot: QualityTrendFlag[] | null
  actionsAgreed: ManagementReviewAction[] | null
  nextReviewDueAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export async function listManagementReviews(): Promise<ManagementReview[]> {
  const { data } = await get<ManagementReview[]>('/management-reviews')
  return data
}

export async function getManagementReview(id: string): Promise<ManagementReview> {
  const { data } = await get<ManagementReview>(`/management-reviews/${id}`)
  return data
}

export async function scheduleManagementReview(input: {
  period: string
  reviewDate: string
  attendees?: string
  nextReviewDueAt?: string
}): Promise<ManagementReview> {
  const { data } = await post<ManagementReview>('/management-reviews', input)
  return data
}

export async function recordManagementReviewActions(
  id: string,
  actions: { description: string; ownerUserId?: string; openCapa?: boolean; rootCauseCategory?: string }[],
): Promise<ManagementReview> {
  const { data } = await post<ManagementReview>(`/management-reviews/${id}/actions`, { actions })
  return data
}
