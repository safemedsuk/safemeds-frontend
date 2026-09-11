import { get } from './client'

/**
 * VigiCloud Stage 18 — one flexible payload, computed live, reused
 * across every role's default Reports view — see the backend
 * `DashboardService`'s own doc comment for why this isn't N separate
 * role-exclusive endpoints.
 */
export interface ReportingDashboard {
  cases: { byState: { stateKey: string; count: number }[]; totalOpen: number }
  deadlines: { breached: number; approaching24h: number; approaching72h: number }
  signals: { open: number; freshlyDetected: number }
  rmpRenewalsDue: number
  safetyAlertsOpen: number
  periodicReportsDue: number
  lineListingsDue: number
  /** RegCloud (Phase 12) Stage 17 — extends this same live-computed payload with the master registration lifecycle's own shape. */
  regulatory: {
    registrationsByStatus: { status: string; count: number }[]
    dossiersByStage: { stage: string; count: number }[]
    upcomingRenewals30d: number
    upcomingRenewals90d: number
    openQueries: number
  }
  /** Real-usage request, 11 Sep 2026 — "every product's live compliance status, what's at risk, what's overdue." */
  productCompliance: ProductComplianceRow[]
  /** Real-usage request, 11 Sep 2026 — QualCloud has no schema yet; `available: false` is the honest signal, not a silent gap. */
  qualcloud: { available: false }
}

export interface ProductComplianceRow {
  productId: string
  brandName: string
  openCases: number
  overdueDeadlines: number
  registrationStatus: string | null
  registrationExpiresOn: string | null
  registrationExpiringSoon: boolean
  openQueries: number
}

export async function getReportingDashboard(): Promise<ReportingDashboard> {
  const { data } = await get<ReportingDashboard>('/reporting/dashboard')
  return data
}
