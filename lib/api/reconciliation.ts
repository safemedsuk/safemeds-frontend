import { get, patch, post } from './client'

export type DistributorStatus = 'active' | 'inactive'

export const DISTRIBUTOR_STATUS_LABELS: Record<DistributorStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
}

export interface Distributor {
  id: string
  companyId: string
  name: string
  contactEmail: string | null
  contactPhone: string | null
  countryId: string | null
  distributorCompanyId: string | null
  status: DistributorStatus
  version: number
  createdAt: string
  updatedAt: string
}

export interface CreateDistributorInput {
  name: string
  contactEmail?: string
  contactPhone?: string
  countryId?: string
}

export interface UpdateDistributorInput {
  name?: string
  contactEmail?: string
  contactPhone?: string
  status?: DistributorStatus
}

export interface ListDistributorsParams {
  page?: number
  limit?: number
  q?: string
}

export interface ListDistributorsResult {
  distributors: Distributor[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export async function listDistributors(params: ListDistributorsParams = {}): Promise<ListDistributorsResult> {
  const { data, meta } = await get<Distributor[]>('/distributors', { ...params })
  return { distributors: data, meta: meta ?? { page: 1, limit: 25, total: data.length, totalPages: 1 } }
}

export async function getDistributor(id: string): Promise<Distributor> {
  const { data } = await get<Distributor>(`/distributors/${id}`)
  return data
}

export async function createDistributor(input: CreateDistributorInput): Promise<Distributor> {
  const { data } = await post<Distributor>('/distributors', input)
  return data
}

export async function updateDistributor(id: string, input: UpdateDistributorInput): Promise<Distributor> {
  const { data } = await patch<Distributor>(`/distributors/${id}`, input)
  return data
}

/** Platform-only (super_admin) — see `CreateDistributorDto`'s own backend doc comment for why this is never a tenant self-service action. */
export async function linkDistributorTenant(distributorId: string, targetCompanyId: string | null): Promise<Distributor> {
  const { data } = await patch<Distributor>(`/platform/distributors/${distributorId}/link-tenant`, { targetCompanyId })
  return data
}

export interface UnmatchedCase {
  caseId: string
  referenceNumber: string
  reporterOrganization: string | null
  receivedDate: string
}

export async function listUnmatchedCases(periodStart: string, periodEnd: string): Promise<UnmatchedCase[]> {
  const { data } = await get<UnmatchedCase[]>('/reconciliation/unmatched', { periodStart, periodEnd })
  return data
}

export interface ManuallyReconcileCaseInput {
  distributorId?: string | null
  note?: string
}

export async function manuallyReconcileCase(caseId: string, input: ManuallyReconcileCaseInput): Promise<void> {
  await post(`/reconciliation/cases/${caseId}`, input)
}

export interface DistributorBreakdown {
  distributorId: string
  distributorName: string
  caseCount: number
  caseIds: string[]
}

export interface ReconciliationReportSnapshot {
  byDistributor: DistributorBreakdown[]
  unmatched: UnmatchedCase[]
}

export interface ReconciliationReport {
  id: string
  companyId: string
  distributorId: string | null
  periodStart: string
  periodEnd: string
  totalCases: number
  matchedCases: number
  unmatchedCases: number
  snapshot: ReconciliationReportSnapshot
  generatedBy: string
  generatedAt: string
}

export interface GenerateReconciliationReportInput {
  distributorId?: string
  periodStart: string
  periodEnd: string
}

export async function generateReconciliationReport(input: GenerateReconciliationReportInput): Promise<ReconciliationReport> {
  const { data } = await post<ReconciliationReport>('/reconciliation/reports', input)
  return data
}

export interface ListReconciliationReportsResult {
  reports: ReconciliationReport[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export async function listReconciliationReports(page = 1, limit = 10): Promise<ListReconciliationReportsResult> {
  const { data, meta } = await get<ReconciliationReport[]>('/reconciliation/reports', { page, limit })
  return { reports: data, meta: meta ?? { page: 1, limit, total: data.length, totalPages: 1 } }
}

export async function getReconciliationReport(id: string): Promise<ReconciliationReport> {
  const { data } = await get<ReconciliationReport>(`/reconciliation/reports/${id}`)
  return data
}

export interface CrossTenantSummary {
  distributorId: string
  distributorCompanyId: string
  periodStart: string
  periodEnd: string
  manufacturerMatchedCaseCount: number
  distributorTenantCaseCount: number
}

export async function getCrossTenantSummary(distributorId: string, periodStart: string, periodEnd: string): Promise<CrossTenantSummary> {
  const { data } = await get<CrossTenantSummary>(`/reconciliation/distributors/${distributorId}/cross-tenant-summary`, { periodStart, periodEnd })
  return data
}
