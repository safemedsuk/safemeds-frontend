import { get, patch, post } from './client'

export interface OosRateRow {
  productId: string
  brandName: string
  oosCount: number
  batchCount: number
  ratePercent: number | null
}

export interface QualityMetricsSnapshot {
  periodStart: string
  periodEnd: string
  deviationsOpened: number
  deviationsClosed: number
  complaintsOpened: number
  complaintsClosed: number
  capasOpened: number
  capasClosed: number
  rightFirstTimeRate: number | null
  overdueCapaCount: number
  recurringIssueCount: number
  oosRatePerProduct: OosRateRow[]
  trainingComplianceRate: number | null
}

export async function getQualityMetrics(from?: string, to?: string): Promise<QualityMetricsSnapshot> {
  const { data } = await get<QualityMetricsSnapshot>('/quality-metrics', { from, to })
  return data
}

export interface QualityTrendFlag {
  id: string
  companyId: string
  rootCauseCategory: string
  occurrenceCount: number
  capaIds: string[]
  windowStart: string
  windowEnd: string
  status: 'open' | 'resolved'
  acknowledgedBy: string | null
  acknowledgedAt: string | null
  createdAt: string
  updatedAt: string
}

export async function listQualityTrendFlags(): Promise<QualityTrendFlag[]> {
  const { data } = await get<QualityTrendFlag[]>('/quality-metrics/trend-flags')
  return data
}

export async function runTrendDetectionNow(): Promise<{ companiesScanned: number; flagsOpened: number; flagsResolved: number }> {
  const { data } = await post<{ companiesScanned: number; flagsOpened: number; flagsResolved: number }>(
    '/quality-metrics/trend-flags/run-now',
  )
  return data
}

export async function acknowledgeTrendFlag(id: string): Promise<QualityTrendFlag> {
  const { data } = await patch<QualityTrendFlag>(`/quality-metrics/trend-flags/${id}/acknowledge`, {})
  return data
}
