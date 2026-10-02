import { get, post, patch } from '@/lib/api/client'
import type { QualityPage } from '@/lib/api/quality'

// QualCloud (Phase 13) Stage 19 — Environmental Monitoring & Stability Programme.

export interface EnvironmentalMonitoringResult {
  id: string
  facilityId: string
  cleanroomGrade: 'A' | 'B' | 'C' | 'D'
  monitoringType: 'viable_air' | 'viable_surface' | 'viable_personnel' | 'non_viable_particle'
  sampleLocation: string | null
  result: string
  alertLimit: string | null
  actionLimit: string | null
  excursion: boolean
  excursionLevel: string | null
  sampledAt: string
  notes: string | null
}

export interface RecordEnvironmentalMonitoringResultInput {
  facilityId: string
  cleanroomGrade: 'A' | 'B' | 'C' | 'D'
  monitoringType: 'viable_air' | 'viable_surface' | 'viable_personnel' | 'non_viable_particle'
  sampleLocation?: string
  result: string
  alertLimit?: string
  actionLimit?: string
  sampledAt: string
  notes?: string
}

export async function listEnvironmentalMonitoringResults(
  params: { facilityId?: string; excursionOnly?: boolean; page?: number; limit?: number } = {},
): Promise<QualityPage<EnvironmentalMonitoringResult>> {
  const { data, meta } = await get<EnvironmentalMonitoringResult[]>(
    '/quality/environmental-monitoring',
    params as Record<string, string | number | boolean | undefined>,
  )
  return { rows: data, meta: meta! }
}

export async function recordEnvironmentalMonitoringResult(
  input: RecordEnvironmentalMonitoringResultInput,
): Promise<EnvironmentalMonitoringResult> {
  const { data } = await post<EnvironmentalMonitoringResult>('/quality/environmental-monitoring', input)
  return data
}

export interface StabilityTimepoint {
  id: string
  stabilityStudyId: string
  timepointMonths: number
  pullDate: string | null
  status: 'scheduled' | 'pulled' | 'tested' | 'results_recorded'
  results: { parameterId: string; parameterName: string; result: string; withinSpec: boolean | null }[] | null
  withinSpec: boolean | null
}

export interface StabilityStudy {
  id: string
  productId: string
  batchId: string | null
  specificationId: string | null
  storageCondition: string
  startDate: string
  status: 'in_progress' | 'completed' | 'terminated'
  timepoints?: StabilityTimepoint[]
}

export async function listStabilityStudies(productId?: string): Promise<StabilityStudy[]> {
  const { data } = await get<StabilityStudy[]>('/quality/stability-studies', productId ? { productId } : undefined)
  return data
}

export async function getStabilityStudy(id: string): Promise<StabilityStudy> {
  const { data } = await get<StabilityStudy>(`/quality/stability-studies/${id}`)
  return data
}

export async function createStabilityStudy(input: {
  productId: string
  batchId?: string
  specificationId?: string
  storageCondition: string
  startDate: string
  timepointMonths?: number[]
}): Promise<StabilityStudy> {
  const { data } = await post<StabilityStudy>('/quality/stability-studies', input)
  return data
}

export async function updateStabilityStudyStatus(
  id: string,
  status: 'in_progress' | 'completed' | 'terminated',
): Promise<StabilityStudy> {
  const { data } = await patch<StabilityStudy>(`/quality/stability-studies/${id}/status`, { status })
  return data
}

export async function recordStabilityTimepointResults(
  timepointId: string,
  input: { pullDate: string; results: { parameterId: string; result: string }[] },
): Promise<StabilityTimepoint> {
  const { data } = await post<StabilityTimepoint>(
    `/quality/stability-studies/timepoints/${timepointId}/results`,
    input,
  )
  return data
}

// QualCloud (Phase 13) Stage 20 — cross-module dashboards.

export interface CrossModuleReadiness {
  vigicloud: { overall: 'green' | 'amber' | 'red'; readyCount: number; totalMandatory: number }
  qualcloud: { overall: 'ready' | 'needs_attention'; authorityConfigured: boolean }
  regulatory: { openItemCount: number; overall: 'ready' | 'needs_attention' }
}

export async function getCrossModuleReadiness(): Promise<CrossModuleReadiness> {
  const { data } = await get<CrossModuleReadiness>('/reporting/inspection-readiness-overview')
  return data
}

export interface ObligationFeedItem {
  module: 'vigicloud' | 'regulatory' | 'qualcloud'
  kind: string
  label: string
  dueAt: string
  recordType: string
  recordId: string
  overdue: boolean
}

export async function getObligationsFeed(): Promise<ObligationFeedItem[]> {
  const { data } = await get<ObligationFeedItem[]>('/reporting/obligations')
  return data
}

export interface ExecutiveDashboard {
  dashboard: Record<string, unknown>
  readiness: CrossModuleReadiness
  topObligations: ObligationFeedItem[]
}

export async function getExecutiveDashboard(): Promise<ExecutiveDashboard> {
  const { data } = await get<ExecutiveDashboard>('/reporting/executive-dashboard')
  return data
}
