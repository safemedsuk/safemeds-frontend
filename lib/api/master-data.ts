import { get, PaginationMeta, patch, post } from './client'

export type ProductCategory = 'medicinal' | 'blood_product' | 'herbal' | 'cosmeceutical' | 'vaccine' | 'device_ivd' | 'other'

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  medicinal: 'Medicinal',
  blood_product: 'Blood Product',
  herbal: 'Herbal',
  cosmeceutical: 'Cosmeceutical',
  vaccine: 'Vaccine',
  device_ivd: 'Medical Device / IVD',
  other: 'Other',
}

export interface Product {
  id: string
  companyId: string
  brandName: string
  genericName: string
  productCategory: ProductCategory
  dosageForm: string
  strength: string
  /** The WHO International Nonproprietary Name — distinct from `genericName`, this company's own preferred generic label. */
  innName: string | null
  atcCode: string | null
  /** Release-profile detail (e.g. "extended release"), distinct from `dosageForm` (tablet/capsule/injection). */
  formulation: string | null
  routeOfAdministration: string | null
  siteOfManufacture: string | null
  packSizes: string[]
  /** VigiCloud Stage 18 — the EURD-list anchor date for PSUR/PBRER periodicity (GUD/022 §6.2). Null until set — periodic-report generation for this product fails with a clear error until it is. */
  internationalBirthDate: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ProductInput {
  brandName: string
  genericName: string
  productCategory: ProductCategory
  dosageForm: string
  strength: string
  innName?: string
  atcCode?: string
  formulation?: string
  routeOfAdministration?: string
  siteOfManufacture?: string
  packSizes?: string[]
  internationalBirthDate?: string
}

/** QualCloud (Phase 13) Stage 7 — the real, standard pharma batch-status lifecycle. Set only by `BatchRecordReviewService.recordDisposition()` (released/rejected/reworked), `OosService.recordPhase2()` (rejected/reworked on batch impact), or the Recall module (recalled) — never directly editable. */
export type BatchQualityStatus = 'quarantine' | 'under_test' | 'released' | 'rejected' | 'reworked' | 'returned' | 'recalled'

export interface Batch {
  id: string
  companyId: string
  productId: string
  batchNumber: string
  manufacturedOn: string
  expiresOn: string
  isActive: boolean
  batchSize: string | null
  unit: string | null
  /** Real genealogy — the upstream batch/lot references this batch was made from. Not every entry resolves to a catalog batch (a supplier's own external lot number is a valid, honest, permanently-unresolved entry). */
  parentBatchIds: string[]
  manufacturingSiteId: string | null
  qualityStatus: BatchQualityStatus
  createdAt: string
  updatedAt: string
  product: { brandName: string }
}

export interface CreateBatchInput {
  productId: string
  batchNumber: string
  manufacturedOn: string
  expiresOn: string
  batchSize?: string
  unit?: string
  parentBatchIds?: string[]
  manufacturingSiteId?: string
}

export interface UpdateBatchInput {
  batchNumber?: string
  manufacturedOn?: string
  expiresOn?: string
  batchSize?: string
  unit?: string
  parentBatchIds?: string[]
  manufacturingSiteId?: string
}

export type ProductRegistrationStatus = 'active' | 'expired' | 'withdrawn' | 'suspended'

export interface ProductRegistration {
  id: string
  companyId: string
  productId: string
  authorityId: string
  registrationNumber: string
  status: ProductRegistrationStatus
  issuedOn: string
  expiresOn: string
  createdAt: string
  updatedAt: string
  product: { brandName: string }
  authority: { name: string; code: string }
  /** RegCloud (Phase 12) Stage 0.2 — all nullable, this endpoint predates RegCloud (base-engine Phase 7). */
  manufacturingSiteId: string | null
  localRepresentativeId: string | null
  mahName: string | null
  mahCountry: string | null
  productClass: string | null
  /** testing-correction-explanation.md §3.6 — set only once withdrawn. */
  withdrawnAt: string | null
  withdrawnReason: string | null
  withdrawnBy: string | null
  withdrawalDocumentId: string | null
}

export interface MasterDataPage<T> {
  rows: T[]
  meta: PaginationMeta
}

export interface ListParams {
  page?: number
  limit?: number
  q?: string
}

// ── Products ────────────────────────────────────────────────────────────────

export async function listProducts(params: ListParams = {}): Promise<MasterDataPage<Product>> {
  const { data, meta } = await get<Product[]>('/products', params as Record<string, string | number | boolean | undefined>)
  return { rows: data, meta: meta! }
}

export async function createProduct(payload: ProductInput): Promise<Product> {
  const { data } = await post<Product>('/products', payload)
  return data
}

export async function updateProduct(id: string, payload: Partial<Omit<Product, 'id' | 'companyId' | 'isActive' | 'createdAt' | 'updatedAt'>>): Promise<Product> {
  const { data } = await patch<Product>(`/products/${id}`, payload)
  return data
}

export async function deactivateProduct(id: string): Promise<Product> {
  const { data } = await post<Product>(`/products/${id}/deactivate`)
  return data
}

// ── Batches ─────────────────────────────────────────────────────────────────

export async function listBatches(params: ListParams & { productId?: string } = {}): Promise<MasterDataPage<Batch>> {
  const { data, meta } = await get<Batch[]>('/batches', params as Record<string, string | number | boolean | undefined>)
  return { rows: data, meta: meta! }
}

export async function createBatch(payload: CreateBatchInput): Promise<Batch> {
  const { data } = await post<Batch>('/batches', payload)
  return data
}

export async function updateBatch(id: string, payload: UpdateBatchInput): Promise<Batch> {
  const { data } = await patch<Batch>(`/batches/${id}`, payload)
  return data
}

export async function getBatch(id: string): Promise<Batch> {
  const { data } = await get<Batch>(`/batches/${id}`)
  return data
}

export async function deactivateBatch(id: string): Promise<Batch> {
  const { data } = await post<Batch>(`/batches/${id}/deactivate`)
  return data
}

// ── Product registrations ────────────────────────────────────────────────────

/** testing-correction-explanation.md §3.7 — the one place the Retention modal can get this registration's own authority/product class to resolve its guidance document checklist. */
export async function getRegistration(id: string): Promise<ProductRegistration> {
  const { data } = await get<ProductRegistration>(`/registrations/${id}`)
  return data
}

export async function listRegistrations(
  params: ListParams & { productId?: string; expiringWithinDays?: number } = {},
): Promise<MasterDataPage<ProductRegistration>> {
  const { data, meta } = await get<ProductRegistration[]>('/registrations', params as Record<string, string | number | boolean | undefined>)
  return { rows: data, meta: meta! }
}

export async function createRegistration(payload: {
  productId: string
  authorityId: string
  registrationNumber: string
  issuedOn: string
  expiresOn: string
  manufacturingSiteId?: string
  localRepresentativeId?: string
  mahName?: string
  mahCountry?: string
  productClass?: string
}): Promise<ProductRegistration> {
  const { data } = await post<ProductRegistration>('/registrations', payload)
  return data
}

/** testing-correction-explanation.md §3.6 — signature-gated; replaces the old bare status flip. */
export async function withdrawRegistration(
  id: string,
  payload: { reason: string; documentId?: string; intentStatement: string; signatureToken: string },
): Promise<ProductRegistration> {
  const { data } = await post<ProductRegistration>(`/registrations/${id}/withdraw`, payload)
  return data
}
