import { CompanyType } from './auth'
import { get, post } from './client'

export type RegistrationStatus = 'pending_verification' | 'under_review' | 'approved' | 'rejected'

export interface RegistrationListItem {
  id: string
  referenceNumber: string
  companyName: string
  companyType: CompanyType
  countryId: string
  licenceNumber: string
  licenceDocKey: string | null
  adminFullName: string
  adminEmail: string
  adminPhone: string | null
  status: RegistrationStatus
  reviewedBy: string | null
  decidedAt: string | null
  rejectionReason: string | null
  createdAt: string
  freeMailDomain: boolean
  domainNameMismatch: boolean
}

export interface RegistrationDetail extends RegistrationListItem {
  licenceViewUrl: string | null
}

export async function listRegistrations(
  status?: RegistrationStatus,
  page = 1,
): Promise<{ registrations: RegistrationListItem[]; totalPages: number }> {
  const { data, meta } = await get<RegistrationListItem[]>('/platform/registrations', { status, page, limit: 25 })
  return { registrations: data, totalPages: meta?.totalPages ?? 1 }
}

export async function getRegistration(id: string): Promise<RegistrationDetail> {
  const { data } = await get<RegistrationDetail>(`/platform/registrations/${id}`)
  return data
}

export async function approveRegistration(id: string): Promise<void> {
  await post(`/platform/registrations/${id}/approve`)
}

export async function rejectRegistration(id: string, reason: string): Promise<void> {
  await post(`/platform/registrations/${id}/reject`, { reason })
}
