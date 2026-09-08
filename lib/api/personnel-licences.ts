import { get, patch, post, PaginationMeta } from './client'

// RegCloud (Phase 12) Stage 10 — Personnel Licensing. A regulatory fact
// about a person (a pharmacist's practising licence, a Superintendent
// Pharmacist designation) — deliberately separate from `User` itself.

export interface PersonnelLicence {
  id: string
  companyId: string
  userId: string
  licenceType: string
  licenceNumber: string
  issuedOn: string
  expiresOn: string | null
  status: string
  licenceDocumentId: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface PersonnelLicencePage {
  rows: PersonnelLicence[]
  meta: PaginationMeta
}

export async function listPersonnelLicences(params: { userId?: string; status?: string; page?: number; limit?: number } = {}): Promise<PersonnelLicencePage> {
  const { data, meta } = await get<PersonnelLicence[]>('/personnel-licences', params as Record<string, string | number | undefined>)
  return { rows: data, meta: meta! }
}

export async function getPersonnelLicence(id: string): Promise<PersonnelLicence> {
  const { data } = await get<PersonnelLicence>(`/personnel-licences/${id}`)
  return data
}

export async function createPersonnelLicence(payload: {
  userId: string
  licenceType: string
  licenceNumber: string
  issuedOn: string
  expiresOn?: string
  licenceDocumentId?: string
}): Promise<PersonnelLicence> {
  const { data } = await post<PersonnelLicence>('/personnel-licences', payload)
  return data
}

export async function updatePersonnelLicence(
  id: string,
  payload: Partial<{ licenceNumber: string; issuedOn: string; expiresOn: string; status: string; licenceDocumentId: string }>,
): Promise<PersonnelLicence> {
  const { data } = await patch<PersonnelLicence>(`/personnel-licences/${id}`, payload)
  return data
}
