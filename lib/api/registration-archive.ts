import { API_BASE_URL, get } from './client'

// RegCloud (Phase 12) Stage 9 — Archive & Custody. Purely a read-only
// aggregation over data every earlier stage already writes correctly.

export interface ArchiveSubmission {
  id: string
  submissionNumber: number
  channel: string
  generatedAt: string
  dispatchedAt: string | null
}

export interface ArchiveQuery {
  id: string
  receivedDate: string
  queryText: string
  status: string
  respondedAt: string | null
}

export interface ArchiveDossierEntry {
  id: string
  status: string
  createdAt: string
  submissions: ArchiveSubmission[]
  queries: ArchiveQuery[]
  variation: { id: string; variationType: string; status: string } | null
}

export interface ArchiveObligation {
  id: string
  obligationType: string
  dueAt: string
  status: string
  fulfillmentCount: number
}

export interface ArchiveFeeInvoice {
  id: string
  feeType: string
  amount: string
  currency: string
  dueAt: string
  status: string
}

export interface RegistrationArchive {
  registration: {
    id: string
    registrationNumber: string
    productBrandName: string
    authorityName: string
    issuedOn: string
    expiresOn: string
    status: string
  }
  dossiers: ArchiveDossierEntry[]
  obligations: ArchiveObligation[]
  feeInvoices: ArchiveFeeInvoice[]
}

export async function getRegistrationArchive(productRegistrationId: string): Promise<RegistrationArchive> {
  const { data } = await get<RegistrationArchive>(`/product-registrations/${productRegistrationId}/archive`)
  return data
}

/**
 * Downloads the archive CSV — a real authenticated fetch (the endpoint
 * sits behind the same httpOnly-cookie auth as everything else, so a
 * plain `<a href>`/`window.open` wouldn't carry credentials reliably
 * cross-origin), then hands the browser a real file via an object URL.
 */
export async function downloadRegistrationArchiveCsv(productRegistrationId: string, registrationNumber: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/product-registrations/${productRegistrationId}/archive/export.csv`, { credentials: 'include' })
  if (!res.ok) throw new Error('Could not download the archive export.')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `registration-${registrationNumber}-archive.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
