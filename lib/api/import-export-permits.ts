import { get, patch, post, PaginationMeta } from './client'

// RegCloud (Phase 12) Stage 11 — Import/Export & Permits. A deliberately
// lightweight CRUD record, not a full dossier/workflow build — see the
// backend model's own schema doc comment for the scoping reasoning.

export interface ImportExportPermit {
  id: string
  companyId: string
  productId: string
  productRegistrationId: string | null
  authorityId: string
  permitType: string
  permitNumber: string | null
  status: string
  validFrom: string | null
  validTo: string | null
  permitDocumentId: string | null
  /** RegCloud (Phase 12) Stage 12 — set when this permit is for a trial's own IMP import/export rather than a commercial product. */
  clinicalTrialId: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface ImportExportPermitPage {
  rows: ImportExportPermit[]
  meta: PaginationMeta
}

export async function listImportExportPermits(
  params: { productId?: string; status?: string; clinicalTrialId?: string; page?: number; limit?: number } = {},
): Promise<ImportExportPermitPage> {
  const { data, meta } = await get<ImportExportPermit[]>('/import-export-permits', params as Record<string, string | number | undefined>)
  return { rows: data, meta: meta! }
}

export async function createImportExportPermit(payload: {
  productId: string
  productRegistrationId?: string
  authorityId: string
  permitType: string
  permitNumber?: string
  validFrom?: string
  validTo?: string
  permitDocumentId?: string
  clinicalTrialId?: string
}): Promise<ImportExportPermit> {
  const { data } = await post<ImportExportPermit>('/import-export-permits', payload)
  return data
}

export async function updateImportExportPermit(
  id: string,
  payload: Partial<{ permitNumber: string; status: string; validFrom: string; validTo: string; permitDocumentId: string }>,
): Promise<ImportExportPermit> {
  const { data } = await patch<ImportExportPermit>(`/import-export-permits/${id}`, payload)
  return data
}
