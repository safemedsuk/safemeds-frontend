import { get, PaginationMeta, post, patch } from './client'

/** RegCloud (Phase 12) Stage 0.2 (entity/hierarchy model), 0.4 (deadline engine), and 0.5 (fees ledger) — the tenant-facing client. */

export interface Manufacturer {
  id: string
  companyId: string
  name: string
  countryId: string | null
  address: string | null
  isActive: boolean
}

export interface ManufacturingSite {
  id: string
  manufacturerId: string
  companyId: string
  siteName: string
  countryId: string | null
  address: string | null
  gmpCertificateNumber: string | null
  gmpCertificateExpiresOn: string | null
  isActive: boolean
}

export interface LocalRepresentative {
  id: string
  companyId: string
  name: string
  countryId: string | null
  contactEmail: string | null
  contactPhone: string | null
  address: string | null
  isActive: boolean
}

export type RegDeadlineStatus = 'pending' | 'met' | 'missed' | 'recalculated'

export interface RegDeadline {
  id: string
  companyId: string
  recordType: string
  recordId: string
  regDeadlineRuleId: string
  dueAt: string
  status: RegDeadlineStatus
}

export interface RegPage<T> {
  rows: T[]
  meta: PaginationMeta
}

// ── Manufacturers ────────────────────────────────────────────────────────

export async function listManufacturers(params: { q?: string; page?: number; limit?: number } = {}): Promise<RegPage<Manufacturer>> {
  const { data, meta } = await get<Manufacturer[]>('/manufacturers', params as Record<string, string | number | boolean | undefined>)
  return { rows: data, meta: meta! }
}

export async function createManufacturer(payload: { name: string; countryId?: string; address?: string }): Promise<Manufacturer> {
  const { data } = await post<Manufacturer>('/manufacturers', payload)
  return data
}

export async function updateManufacturer(id: string, payload: Partial<{ name: string; countryId: string; address: string }>): Promise<Manufacturer> {
  const { data } = await patch<Manufacturer>(`/manufacturers/${id}`, payload)
  return data
}

export async function deactivateManufacturer(id: string): Promise<Manufacturer> {
  const { data } = await post<Manufacturer>(`/manufacturers/${id}/deactivate`)
  return data
}

// ── Manufacturing sites ──────────────────────────────────────────────────

export async function listManufacturingSites(
  params: { manufacturerId?: string; q?: string; page?: number; limit?: number } = {},
): Promise<RegPage<ManufacturingSite>> {
  const { data, meta } = await get<ManufacturingSite[]>('/manufacturing-sites', params as Record<string, string | number | boolean | undefined>)
  return { rows: data, meta: meta! }
}

export async function createManufacturingSite(payload: {
  manufacturerId: string
  siteName: string
  countryId?: string
  address?: string
  gmpCertificateNumber?: string
  gmpCertificateExpiresOn?: string
}): Promise<ManufacturingSite> {
  const { data } = await post<ManufacturingSite>('/manufacturing-sites', payload)
  return data
}

export async function deactivateManufacturingSite(id: string): Promise<ManufacturingSite> {
  const { data } = await post<ManufacturingSite>(`/manufacturing-sites/${id}/deactivate`)
  return data
}

// ── Local representatives ────────────────────────────────────────────────

export async function listLocalRepresentatives(params: { q?: string; page?: number; limit?: number } = {}): Promise<RegPage<LocalRepresentative>> {
  const { data, meta } = await get<LocalRepresentative[]>('/local-representatives', params as Record<string, string | number | boolean | undefined>)
  return { rows: data, meta: meta! }
}

export async function createLocalRepresentative(payload: {
  name: string
  countryId?: string
  contactEmail?: string
  contactPhone?: string
  address?: string
}): Promise<LocalRepresentative> {
  const { data } = await post<LocalRepresentative>('/local-representatives', payload)
  return data
}

export async function deactivateLocalRepresentative(id: string): Promise<LocalRepresentative> {
  const { data } = await post<LocalRepresentative>(`/local-representatives/${id}/deactivate`)
  return data
}

// ── Deadlines (Stage 0.4) ─────────────────────────────────────────────────

export async function listRegDeadlines(params: { status?: RegDeadlineStatus; page?: number; limit?: number } = {}): Promise<RegPage<RegDeadline>> {
  const { data, meta } = await get<RegDeadline[]>('/reg-deadlines', params as Record<string, string | number | boolean | undefined>)
  return { rows: data, meta: meta! }
}

// ── Fees ledger (Stage 0.5) ───────────────────────────────────────────────

export type RegFeeInvoiceStatus = 'pending' | 'paid' | 'overdue' | 'waived'

export interface RegFeePayment {
  id: string
  invoiceId: string
  amount: string
  paidAt: string
  method: string | null
  reference: string | null
}

export interface RegFeeInvoice {
  id: string
  companyId: string
  productRegistrationId: string | null
  regDossierId: string | null
  regulatoryFeeScheduleId: string | null
  feeType: string
  amount: string
  currency: string
  status: RegFeeInvoiceStatus
  dueAt: string
  description: string | null
  payments: RegFeePayment[]
}

export async function listRegFeeInvoices(
  params: { productRegistrationId?: string; status?: RegFeeInvoiceStatus; page?: number; limit?: number } = {},
): Promise<RegPage<RegFeeInvoice>> {
  const { data, meta } = await get<RegFeeInvoice[]>('/reg-fee-invoices', params as Record<string, string | number | boolean | undefined>)
  return { rows: data, meta: meta! }
}

export async function createRegFeeInvoice(payload: {
  productRegistrationId?: string
  regDossierId?: string
  feeType: string
  amount: string
  currency?: string
  dueAt: string
  description?: string
}): Promise<RegFeeInvoice> {
  const { data } = await post<RegFeeInvoice>('/reg-fee-invoices', payload)
  return data
}

export async function recordRegFeePayment(
  invoiceId: string,
  payload: { amount: string; paidAt: string; method?: string; reference?: string },
): Promise<RegFeeInvoice> {
  const { data } = await post<RegFeeInvoice>(`/reg-fee-invoices/${invoiceId}/payments`, payload)
  return data
}

export async function waiveRegFeeInvoice(invoiceId: string): Promise<RegFeeInvoice> {
  const { data } = await post<RegFeeInvoice>(`/reg-fee-invoices/${invoiceId}/waive`)
  return data
}
