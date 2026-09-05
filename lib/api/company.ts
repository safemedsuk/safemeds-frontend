import { API_BASE_URL, get, patch, post, PaginationMeta } from './client'

export interface Company {
  id: string
  name: string
  companyType: string
  homeCountryId: string
  status: 'active' | 'suspended'
  /** VigiCloud Stage 3.2 — set once "Generate public reporting URL" has been used; the public form lives at `/report/{slug}`. */
  publicReportingSlug: string | null
  /** VigiCloud Stage 3.3 — set once "Generate intake email address" has been used; null both before generation and when the server has no `EMAIL_INTAKE_DOMAIN` configured. */
  intakeEmailAddress: string | null
  /** VigiCloud Stage 3.4 — pasted in by an admin during WhatsApp Business Platform onboarding, not generated. */
  whatsappBusinessPhoneNumberId: string | null
  /** RegCloud (Phase 12) Stage 15 — the company's default engagement model: `full_service | dossier_review_only | client_handles_queries`. An individual dossier can override this via its own `engagementType`. */
  engagementType: string
  createdAt: string
  updatedAt: string
}

export const ENGAGEMENT_TYPE_LABELS: Record<string, string> = {
  full_service: 'Full Service',
  dossier_review_only: 'Dossier Review Only',
  client_handles_queries: 'Client Handles Queries',
}

export const ENGAGEMENT_TYPE_DESCRIPTIONS: Record<string, string> = {
  full_service: 'SafeMeds (or your consultant) handles the whole regulatory lifecycle end to end, including submitting to the regulator.',
  dossier_review_only: 'SafeMeds (or your consultant) compiles and reviews the dossier, but you submit it to the regulator yourselves.',
  client_handles_queries: 'SafeMeds (or your consultant) compiles and submits, but you field the regulator’s follow-up questions directly.',
}

export interface CompanyMarket {
  companyId: string
  countryId: string
  activatedAt: string
  country: { id: string; isoCode: string; name: string }
}

export interface Facility {
  id: string
  companyId: string
  countryId: string
  name: string
  facilityCode: string | null
  county: string | null
  subCounty: string | null
  address: string | null
  phone: string | null
  isActive: boolean
  // RegCloud (Phase 12) Stage 10 — Establishment/Premises Licensing.
  licenceNumber: string | null
  licenceIssuedOn: string | null
  licenceExpiresOn: string | null
  licenceStatus: string | null
  licenceDocumentId: string | null
  createdAt: string
  updatedAt: string
}

export interface FacilityPage {
  rows: Facility[]
  meta: PaginationMeta
}

export async function getCompany(): Promise<Company> {
  const { data } = await get<Company>('/company')
  return data
}

export async function updateCompany(payload: { name?: string; engagementType?: string }): Promise<Company> {
  const { data } = await patch<Company>('/company', payload)
  return data
}

export async function getCompanyMarkets(): Promise<CompanyMarket[]> {
  const { data } = await get<CompanyMarket[]>('/company/markets')
  return data
}

export async function addCompanyMarket(countryId: string): Promise<CompanyMarket> {
  const { data } = await post<CompanyMarket>('/company/markets', { countryId })
  return data
}

export async function listFacilities(params: { countryId?: string; page?: number; limit?: number } = {}): Promise<FacilityPage> {
  const { data, meta } = await get<Facility[]>('/facilities', params as Record<string, string | number | undefined>)
  return { rows: data, meta: meta! }
}

export async function createFacility(payload: {
  countryId: string
  name: string
  facilityCode?: string
  county?: string
  subCounty?: string
  address?: string
  phone?: string
}): Promise<Facility> {
  const { data } = await post<Facility>('/facilities', payload)
  return data
}

export async function updateFacility(id: string, payload: Partial<{
  countryId: string
  name: string
  facilityCode: string
  county: string
  subCounty: string
  address: string
  phone: string
}>): Promise<Facility> {
  const { data } = await patch<Facility>(`/facilities/${id}`, payload)
  return data
}

export async function deactivateFacility(id: string): Promise<Facility> {
  const { data } = await post<Facility>(`/facilities/${id}/deactivate`)
  return data
}

// RegCloud (Phase 12) Stage 10 — a deliberately separate, narrow endpoint
// (regulatory.manage_licensing, not company_profile.manage) from the
// generic facility fields above.
export async function updateFacilityLicence(id: string, payload: Partial<{
  licenceNumber: string
  licenceIssuedOn: string
  licenceExpiresOn: string
  licenceStatus: string
  licenceDocumentId: string
}>): Promise<Facility> {
  const { data } = await patch<Facility>(`/facilities/${id}/licence`, payload)
  return data
}

export interface FacilityOverviewRow extends Facility {
  /** Users with location-access scoped to this facility (directly, or via a market-level grant covering its country) — access-control coverage, not a staff headcount. */
  scopedUserCount: number
}

export interface FacilitiesOverview {
  /** `true` if the caller sees every company location (unrestricted); `false` if narrowed to their own scoped facilities. */
  unrestricted: boolean
  facilities: FacilityOverviewRow[]
}

export async function getFacilitiesOverview(): Promise<FacilitiesOverview> {
  const { data } = await get<FacilitiesOverview>('/facilities/overview')
  return data
}

// ── VigiCloud Stage 3.2/3.3/3.4 — multi-channel intake configuration ────────

export async function generatePublicReportingSlug(): Promise<Company> {
  const { data } = await post<Company>('/company/public-reporting/slug')
  return data
}

/**
 * The QR endpoint returns raw PNG bytes (not a JSON `{ url }` envelope,
 * since there's no stored object to point at — it's generated on the
 * fly), so this bypasses `lib/api/client.ts`'s JSON-only `apiRequest()`
 * and fetches directly, mirroring its `credentials: 'include'`
 * convention by hand. The caller turns the blob into a downloadable
 * link (`URL.createObjectURL` + a synthetic anchor click), the same
 * client-side-blob pattern `bulk-import-modal.tsx` already uses for its
 * CSV template download.
 */
export async function downloadPublicReportingQrCode(): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/company/public-reporting/qr`, { credentials: 'include' })
  if (!response.ok) {
    throw new Error('Could not download the QR code — generate a public reporting URL first.')
  }
  return response.blob()
}

export async function generateIntakeEmailAddress(): Promise<Company> {
  const { data } = await post<Company>('/company/intake-email')
  return data
}

export async function setWhatsappPhoneNumberId(whatsappBusinessPhoneNumberId: string): Promise<Company> {
  const { data } = await patch<Company>('/company/whatsapp-phone-number-id', { whatsappBusinessPhoneNumberId })
  return data
}
