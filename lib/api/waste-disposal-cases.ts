import { get, post } from './client'

/**
 * QualCloud Phase 1 Pass B (item B) — the 7-step pharmaceutical waste disposal
 * case, as the backend returns it. Step completion is derived server-side from
 * the evidence on the record; the UI never infers it.
 * Source for the steps: "The Pharmacy and Poisons (Pharmaceutical Waste
 * Management) Rules, LN 99 of 2022" (r.10, r.11(3), r.16(2), r.17).
 */

export type WasteEvidenceKind = 'invoice' | 'payment_receipt' | 'handover_certificate' | 'ppb_certificate'
export type WasteAttendeeRole = 'client_representative' | 'ppb_officer' | 'other'

export interface WasteDocRef {
  id: string
  title: string
}

export interface WasteAttendee {
  id: string
  name: string
  organisation: string
  attendeeRole: WasteAttendeeRole
  sortOrder: number
  withdrawnAt: string | null
}

export interface WasteCaseSteps {
  application: boolean
  evidence: boolean
  handover: boolean
  destruction: boolean
  ppbCertificate: boolean
}

export interface WasteDisposalCase {
  id: string
  caseNumber: string
  status: 'open' | 'closed'
  currentStep: number
  steps: WasteCaseSteps
  closureBlockers: string[]
  product: { id: string; brandName: string; genericName: string; strength: string } | null
  batch: { id: string; batchNumber: string; expiresOn: string } | null
  /** Real-usage item (7 Oct 2026) — the full list of product/batch pairs weighed together as one lot. */
  items: {
    id: string
    product: { id: string; brandName: string; genericName: string; strength: string }
    batch: { id: string; batchNumber: string; expiresOn: string }
  }[]
  wasteDescription: string
  quantity: string
  unit: string
  weighedAt: string
  disposalDeadlineAt: string
  step2Application: {
    applicationReference: string | null
    invoiceReference: string | null
    feeAmountKes: number | null
    feeScheduledKes: number
    applicationSubmittedAt: string | null
    certificateDueAt: string | null
  }
  step3Evidence: {
    invoiceDocument: WasteDocRef | null
    paymentReceiptDocument: WasteDocRef | null
    evidenceAttachedAt: string | null
  }
  step4Handover: {
    disposalCompanyName: string | null
    handoverCertificateDocument: WasteDocRef | null
    handedOverAt: string | null
    ppbVerifiedAt: string | null
    ppbVerifiedByUserId: string | null
  }
  step5Destruction: {
    destructionDate: string | null
    destructionLocation: string | null
    destructionRecordedAt: string | null
    attendees: WasteAttendee[]
    withdrawnAttendees: WasteAttendee[]
    photos: { id: string; sortOrder: number; document: WasteDocRef }[]
    combinedPdfDocument: WasteDocRef | null
  }
  step6PpbCertificate: { document: WasteDocRef | null; attachedAt: string | null }
  step7Closure: { closedAt: string | null; closedByUserId: string | null }
  warnings: string[]
}

export interface WasteCasePage {
  rows: WasteDisposalCase[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export async function listWasteCases(
  params: { page?: number; limit?: number; status?: 'open' | 'closed' } = {},
): Promise<WasteCasePage> {
  const { data, meta } = await get<WasteDisposalCase[]>(
    '/quality/waste-disposal-cases',
    params as Record<string, string | number | undefined>,
  )
  return { rows: data, meta: meta! }
}

export async function getWasteCase(id: string): Promise<WasteDisposalCase> {
  const { data } = await get<WasteDisposalCase>(`/quality/waste-disposal-cases/${id}`)
  return data
}

/**
 * Step 1 — waste weighed. The products and batches are picked from the
 * catalog; the client never types an id. `items` carries every
 * product/batch pair weighed together as one lot (at least one).
 */
export async function createWasteCase(input: {
  items: { productId: string; batchId: string }[]
  wasteDescription: string
  quantity: string
  unit: string
  weighedAt: string
}): Promise<WasteDisposalCase> {
  const { data } = await post<WasteDisposalCase>('/quality/waste-disposal-cases', input)
  return data
}

/** Step 2 — PPB application reference, fee paid, and submission date. */
export async function recordWasteApplication(
  id: string,
  input: { applicationReference: string; invoiceReference: string; feeAmountKes: number; applicationSubmittedAt: string },
): Promise<WasteDisposalCase> {
  const { data } = await post<WasteDisposalCase>(`/quality/waste-disposal-cases/${id}/application`, input)
  return data
}

/** Steps 3, 4 (certificate) and 6 — one evidence file, uploaded and linked in one request. */
export async function uploadWasteEvidence(id: string, kind: WasteEvidenceKind, file: File): Promise<WasteDisposalCase> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await post<WasteDisposalCase>(`/quality/waste-disposal-cases/${id}/evidence/${kind}`, formData)
  return data
}

/** Step 4 — the disposal company and the date waste was handed over (r.11(3)). */
export async function recordWasteHandover(
  id: string,
  input: { disposalCompanyName: string; handedOverAt: string },
): Promise<WasteDisposalCase> {
  const { data } = await post<WasteDisposalCase>(`/quality/waste-disposal-cases/${id}/handover`, input)
  return data
}

/** Step 4 — mark the disposal company's certificate as verified by PPB. */
export async function verifyWasteHandover(id: string): Promise<WasteDisposalCase> {
  const { data } = await post<WasteDisposalCase>(`/quality/waste-disposal-cases/${id}/handover/verify`, {})
  return data
}

/** Step 5 — destruction date and location (under Board supervision, r.17(1)). */
export async function recordWasteDestruction(
  id: string,
  input: { destructionDate: string; destructionLocation: string },
): Promise<WasteDisposalCase> {
  const { data } = await post<WasteDisposalCase>(`/quality/waste-disposal-cases/${id}/destruction`, input)
  return data
}

export async function addWasteAttendee(
  id: string,
  input: { name: string; organisation: string; attendeeRole: WasteAttendeeRole },
): Promise<WasteDisposalCase> {
  const { data } = await post<WasteDisposalCase>(`/quality/waste-disposal-cases/${id}/destruction/attendees`, input)
  return data
}

export async function withdrawWasteAttendee(id: string, attendeeId: string): Promise<WasteDisposalCase> {
  const { data } = await post<WasteDisposalCase>(
    `/quality/waste-disposal-cases/${id}/destruction/attendees/${attendeeId}/withdraw`,
    {},
  )
  return data
}

/** Step 5 — destruction photos (JPEG/PNG). Each is kept; they are combined into ONE PDF server-side. */
export async function uploadWastePhotos(id: string, files: File[]): Promise<WasteDisposalCase> {
  const formData = new FormData()
  for (const file of files) formData.append('files', file)
  const { data } = await post<WasteDisposalCase>(`/quality/waste-disposal-cases/${id}/destruction/photos`, formData)
  return data
}

/** Step 7 — closure. Manager-only (quality.close_waste_disposal). */
export async function closeWasteCase(id: string): Promise<WasteDisposalCase> {
  const { data } = await post<WasteDisposalCase>(`/quality/waste-disposal-cases/${id}/close`, {})
  return data
}
