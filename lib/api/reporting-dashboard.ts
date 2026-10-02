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
    /** testing-correction-explanation.md §4.2 — "dossiers in flight by kind" (Registration/Variation/Renewal), for the stacked-bar-per-kind chart. */
    dossiersByKindAndStage: { kind: 'registration' | 'variation' | 'renewal'; stage: string; count: number }[]
    /** "Open items needing action right now" — each row links straight to its own record via `recordType`/`recordId`. */
    openItems: {
      overduePostMarketObligations: RegOpenItem[]
      /** Honest approximation, not a real regulatory deadline — `RegQuery` has no response-due-date field in this schema. */
      longOpenQueries: RegOpenItem[]
      registrationsExpiringSoonWithNoRenewalStarted: RegOpenItem[]
      /** Only ever populated 1 Oct – 31 Dec, matching the real weekly retention-reminder job's own definition of "due." */
      retentionsDueNotLogged: RegOpenItem[]
    }
    /** "This month's activity" — a count strip, calendar month to date. */
    thisMonthActivity: {
      dossiersSubmitted: number
      approvalsReceived: number
      queriesLogged: number
      retentionsCertified: number
    }
  }
  /** Real-usage request, 11 Sep 2026 — "every product's live compliance status, what's at risk, what's overdue." */
  productCompliance: ProductComplianceRow[]
  /**
   * QualCloud (Phase 13) Stage 20 — real data, replacing the
   * `available: false` placeholder this carried since 11 Sep 2026.
   * `available` is false whenever the `qualcloud` entitlement isn't
   * granted yet — every other field is zeroed/empty in that case,
   * matching the backend's own honest-degradation shape.
   */
  qualcloud: QualCloudDashboard
}

export interface QualCloudDashboard {
  available: boolean
  deviationsOpenBySeverity: { severity: string; count: number }[]
  capasDue: number
  capasOverdue: number
  effectivenessChecksDue: number
  changeControlsInProgress: number
  documentsPendingApproval: number
  periodicReviewsDue: number
  readAndUnderstandOutstanding: number
  openFindingsByClassification: { classification: string; count: number }[]
  findingsToCapaClosureRate: number | null
  supplierAuditsDue: number
  trainingDue: number
  trainingOverdue: number
  metrics: { rightFirstTimeRate: number | null; recurringIssueCount: number; openTrendFlags: number } | null
}

export interface RegOpenItem {
  recordType: 'product_registration' | 'reg_dossier'
  recordId: string
  label: string
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
