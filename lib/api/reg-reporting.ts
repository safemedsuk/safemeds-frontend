import { GeneratedReport } from './reports'
import { post } from './client'

/** RegCloud (Phase 12) Stage 17 — real, live-computed `.xlsx` exports, reusing `GeneratedReport` exactly like every other module's own report generators. */

export async function generatePortfolioStatusReport(): Promise<GeneratedReport> {
  const { data } = await post<GeneratedReport>('/reporting/regulatory/portfolio-status')
  return data
}

export async function generateUpcomingRenewalsReport(withinDays?: number): Promise<GeneratedReport> {
  const { data } = await post<GeneratedReport>('/reporting/regulatory/upcoming-renewals', { withinDays })
  return data
}

export async function generateDossierTurnaroundReport(): Promise<GeneratedReport> {
  const { data } = await post<GeneratedReport>('/reporting/regulatory/dossier-turnaround')
  return data
}
