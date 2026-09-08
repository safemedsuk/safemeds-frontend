import { BenefitRiskSummary } from './benefit-risk'
import { post } from './client'
import { GeneratedReport } from './reports'

/** The real `periodic_report` workflow's own state keys — draft (authored) → qc_reviewed → submitted, matching `GeneratedReportStatus`'s own values 1:1. */
export type PeriodicReportWorkflowStateKey = 'draft' | 'qc_reviewed' | 'submitted'

export type PeriodicReportTypeKey = 'psur' | 'pbrer' | 'dsur' | 'pader' | 'cioms_ii'

export const PERIODIC_REPORT_TYPE_LABELS: Record<PeriodicReportTypeKey, string> = {
  psur: 'PSUR — Periodic Safety Update Report',
  pbrer: 'PBRER — Periodic Benefit-Risk Evaluation Report',
  dsur: 'DSUR — Development Safety Update Report',
  pader: 'PADER — Periodic Adverse Drug Experience Report',
  cioms_ii: 'CIOMS II Periodic Line Listing',
}

/** psur/pbrer have a confirmed automatic cadence (GUD/022 §6.2); the other three need an explicit period every time. */
export const AUTO_CADENCE_REPORT_TYPES: PeriodicReportTypeKey[] = ['psur', 'pbrer']

export interface GeneratePeriodicReportInput {
  reportTypeKey: PeriodicReportTypeKey
  productId?: string
  clinicalTrialId?: string
  periodStart?: string
  periodEnd?: string
  conclusionNote?: string
}

export interface PeriodicReportWithSummary extends GeneratedReport {
  benefitRisk: BenefitRiskSummary
  /** The real `periodic_report` `WorkflowInstance` id driving this report's review/sign-off/submit lifecycle — feed this straight into `WorkflowActionsPanel`. */
  workflowInstanceId: string | null
}

export async function generatePeriodicReport(input: GeneratePeriodicReportInput): Promise<PeriodicReportWithSummary> {
  const { data } = await post<PeriodicReportWithSummary>('/reporting/periodic-reports', input)
  return data
}

/** The "actually dispatched it (portal upload, email), here's proof" step — deliberately ungated by the workflow itself, see `PeriodicReportService.attachEvidence()`'s own doc comment. */
export async function attachPeriodicReportEvidence(reportId: string, file: File): Promise<GeneratedReport> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await post<GeneratedReport>(`/reporting/periodic-reports/${reportId}/evidence`, formData)
  return data
}
