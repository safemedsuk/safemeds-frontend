import { get, post } from './client'
import type { QualityMetricsSnapshot, QualityTrendFlag } from './quality-metrics'

export interface ManagementReviewAction {
  description: string
  ownerUserId?: string
  openCapa?: boolean
  rootCauseCategory?: string
  capaId: string | null
}

/** Pass B (E) — one attendee, entered by name. Withdrawn rows are never returned by the read endpoints. */
export interface ManagementReviewAttendee {
  id: string
  name: string
  roleOrOrganisation: string | null
  sortOrder: number
  withdrawnAt: string | null
}

export interface ManagementReview {
  id: string
  companyId: string
  period: string
  reviewDate: string
  /** Legacy single-string attendee list — read-only, kept for reviews created before Pass B. */
  attendees: string | null
  attendeeRows?: ManagementReviewAttendee[]
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
  attendeeRows?: { name: string; roleOrOrganisation?: string }[]
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

/** Pass B (E) — add one attendee by name. */
export async function addManagementReviewAttendee(
  reviewId: string,
  input: { name: string; roleOrOrganisation?: string },
): Promise<ManagementReviewAttendee> {
  const { data } = await post<ManagementReviewAttendee>(`/management-reviews/${reviewId}/attendees`, input)
  return data
}

/** Pass B (E) — remove an attendee entered in error (stamped, not deleted). */
export async function withdrawManagementReviewAttendee(reviewId: string, attendeeId: string): Promise<ManagementReviewAttendee> {
  const { data } = await post<ManagementReviewAttendee>(
    `/management-reviews/${reviewId}/attendees/${attendeeId}/withdraw`,
    {},
  )
  return data
}
