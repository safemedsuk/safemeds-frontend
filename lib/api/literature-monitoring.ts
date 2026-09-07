import { get, post } from './client'

export interface LiteratureMonitoringRun {
  id: string
  companyId: string
  runAt: string
  method: string
  searchTerms: string
  hitsCount: number
  hitsSummary: string | null
  loggedBy: string
  createdAt: string
}

export interface LogLiteratureRunInput {
  runAt: string
  method: string
  searchTerms: string
  hitsCount: number
  hitsSummary?: string
}

/** Kenya's PPB has no confirmed cadence (GUD/022 doesn't specify one) — "monthly" per the Final doc's own wording. Mirrors the backend's own `LITERATURE_MONITORING_CURRENCY_WINDOW_DAYS`. */
export const LITERATURE_MONITORING_CURRENCY_WINDOW_DAYS = 35

export async function logLiteratureRun(input: LogLiteratureRunInput): Promise<LiteratureMonitoringRun> {
  const { data } = await post<LiteratureMonitoringRun>('/literature-monitoring-runs', input)
  return data
}

export async function listLiteratureRuns(params: { page?: number; limit?: number } = {}): Promise<{ runs: LiteratureMonitoringRun[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
  const { data, meta } = await get<LiteratureMonitoringRun[]>('/literature-monitoring-runs', params)
  return { runs: data, meta: meta ?? { page: 1, limit: 25, total: data.length, totalPages: 1 } }
}
