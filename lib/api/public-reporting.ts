import { API_BASE_URL } from './client'
import type { ConsentMethod, CreateAdverseEventInput, CreatePatientInput, CreatePregnancyInput, CreateReporterInput, CreateSuspectProductInput } from './pv-cases'

export interface PublicCompanyDisplay {
  companyName: string
  /** Stage 3.1 — the report type this form's submissions are filed as, e.g. "Adverse Drug Reaction". Null only if the company has no PV report type configured yet. */
  reportTypeName: string | null
}

export interface SubmitPublicReportInput {
  reporter: CreateReporterInput
  patient: CreatePatientInput
  suspectProducts: CreateSuspectProductInput[]
  adverseEvents: CreateAdverseEventInput[]
  consent?: { granted: boolean; method: ConsentMethod }
  suspectedFalsifiedOrSubstandard?: boolean
  pregnancy?: CreatePregnancyInput
}

export interface PublicSubmissionResult {
  referenceNumber: string
}

/** Stage 3.2 — a public-safe, narrow projection of the company's own `Product` catalog row. */
export interface PublicProductResult {
  id: string
  brandName: string
  genericName: string
  innName: string | null
  atcCode: string | null
  dosageForm: string
  strength: string
}

/**
 * VigiCloud Stage 3.2 — the fully unauthenticated public-reporting
 * endpoints (`GET/POST /report/:slug`). Deliberately **not** routed
 * through `lib/api/client.ts`'s `apiRequest()`: that helper's 401 →
 * silent-refresh → retry logic exists for authenticated sessions and
 * would be actively wrong here (there is no session to refresh, and a
 * refresh attempt against a stranger's browser makes no sense) — a
 * plain `fetch()` with no `credentials` is the honest shape for a
 * genuinely public request.
 */
async function publicFetch<T>(path: string, options: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json') ? await response.json() : null

  if (!response.ok) {
    const message = payload?.error?.message ?? 'This reporting link is not valid.'
    throw new Error(message)
  }

  return payload.data as T
}

export function resolvePublicCompany(slug: string): Promise<PublicCompanyDisplay> {
  return publicFetch<PublicCompanyDisplay>(`/report/${encodeURIComponent(slug)}`)
}

export function submitPublicReport(slug: string, input: SubmitPublicReportInput): Promise<PublicSubmissionResult> {
  return publicFetch<PublicSubmissionResult>(`/report/${encodeURIComponent(slug)}`, { method: 'POST', body: input })
}

export function searchPublicProducts(slug: string, q: string): Promise<PublicProductResult[]> {
  return publicFetch<PublicProductResult[]>(`/report/${encodeURIComponent(slug)}/products?q=${encodeURIComponent(q)}`)
}

/**
 * Stage 3.4 — attaches an optional source document to an already-submitted
 * public report, matched by the reference number shown on the
 * confirmation screen. Multipart, so this bypasses `publicFetch()`
 * entirely (no JSON body, no `Content-Type` header — the browser sets the
 * multipart boundary itself once given a `FormData` body).
 */
export async function attachPublicSourceDocument(slug: string, referenceNumber: string, file: File): Promise<{ attached: boolean }> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE_URL}/report/${encodeURIComponent(slug)}/${encodeURIComponent(referenceNumber)}/document`, {
    method: 'POST',
    body: formData,
  })

  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json') ? await response.json() : null

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? 'Could not attach the document. Please try again.')
  }

  return payload.data as { attached: boolean }
}
