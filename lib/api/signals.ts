import { get, post } from './client'

/**
 * VigiCloud Stage 17 — GVP Module IX §IX.A.1.1's six signal-management
 * activities (detection, validation, confirmation, analysis &
 * prioritisation, assessment, recommendation for action), matching the
 * backend's `Signal`/`SignalService`/`SignalController` exactly. The
 * lifecycle transitions themselves go through the generic
 * `lib/api/workflow.ts` (`postTransition`), the same mechanism PV cases
 * and clinical trials already use — this file only owns the data a
 * transition doesn't carry: creating a signal, recording the actual
 * validation/prioritisation/assessment/recommendation content, linking
 * evidence cases, and reading the detail (with its live workflow status
 * and documented decision history).
 */

export type SignalStatus = 'detected' | 'validated' | 'non_validated' | 'confirmed' | 'not_confirmed' | 'analysed_prioritised' | 'assessed' | 'action_recommended' | 'refuted'

export type SignalRecommendationAction =
  | 'request_more_data'
  | 'propose_product_info_update'
  | 'request_rmp_update'
  | 'propose_risk_minimisation'
  | 'sponsor_followup_study'
  | 'no_action'

export const SIGNAL_STATUS_LABELS: Record<SignalStatus, string> = {
  detected: 'Detected',
  validated: 'Validated',
  non_validated: 'Not Validated',
  confirmed: 'Confirmed',
  not_confirmed: 'Not Confirmed',
  analysed_prioritised: 'Analysed & Prioritised',
  assessed: 'Assessed',
  action_recommended: 'Action Recommended',
  refuted: 'Refuted',
}

export const SIGNAL_RECOMMENDATION_ACTION_LABELS: Record<SignalRecommendationAction, string> = {
  request_more_data: 'Request more data',
  propose_product_info_update: 'Propose product information update',
  request_rmp_update: 'Request Risk Management Plan update',
  propose_risk_minimisation: 'Propose additional risk minimisation',
  sponsor_followup_study: 'Sponsor a follow-up study',
  no_action: 'No action',
}

export interface Signal {
  id: string
  companyId: string
  title: string
  description: string
  status: SignalStatus
  detectionMethod: string
  productIdentifier: string
  /** testing-todo Stage 17.2 — optional link to the company's own product catalog, set when `productIdentifier` was picked via the search-and-pick widget rather than typed freely. Always null for a `pattern_flag`-detected signal. */
  productId: string | null
  batchNumber: string | null
  previousAwareness: boolean | null
  previousAwarenessNote: string | null
  strengthOfEvidenceCaseCount: number | null
  clinicalRelevanceNote: string | null
  severityNote: string | null
  patientExposureNote: string | null
  expectedRegulatoryResponseNote: string | null
  assessmentNote: string | null
  recommendationAction: SignalRecommendationAction | null
  recommendationNote: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface LinkedCaseSummary {
  id: string
  referenceNumber: string
  status: string
  duplicateOfCaseId: string | null
}

export interface SignalTransitionLogEntry {
  fromStateKey: string | null
  toStateKey: string
  note: string | null
  actorName: string | null
  occurredAt: string
}

export interface SignalWithDetail extends Signal {
  linkedCases: LinkedCaseSummary[]
  transitionHistory: SignalTransitionLogEntry[]
  workflowInstanceId: string | null
}

export interface CreateSignalInput {
  title: string
  description: string
  productIdentifier: string
  batchNumber?: string
  caseIds?: string[]
  productId?: string
}

export interface RecordSignalValidationInput {
  previousAwareness?: boolean
  previousAwarenessNote?: string
  clinicalRelevanceNote?: string
}

export interface RecordSignalPrioritisationInput {
  severityNote?: string
  patientExposureNote?: string
  expectedRegulatoryResponseNote?: string
}

export interface RecordSignalAssessmentInput {
  assessmentNote: string
}

export interface RecordSignalRecommendationInput {
  recommendationAction: SignalRecommendationAction
  recommendationNote?: string
}

export interface ScanResult {
  signalsCreated: number
  casesLinked: number
}

export async function listSignals(): Promise<Signal[]> {
  const { data } = await get<Signal[]>('/pv/signals')
  return data
}

export async function getSignal(id: string): Promise<SignalWithDetail> {
  const { data } = await get<SignalWithDetail>(`/pv/signals/${id}`)
  return data
}

export async function createSignal(input: CreateSignalInput): Promise<Signal> {
  const { data } = await post<Signal>('/pv/signals', input)
  return data
}

export async function linkCasesToSignal(id: string, caseIds: string[]): Promise<void> {
  await post<void>(`/pv/signals/${id}/link-cases`, { caseIds })
}

export async function recordSignalValidation(id: string, input: RecordSignalValidationInput): Promise<Signal> {
  const { data } = await post<Signal>(`/pv/signals/${id}/validation`, input)
  return data
}

export async function recordSignalPrioritisation(id: string, input: RecordSignalPrioritisationInput): Promise<Signal> {
  const { data } = await post<Signal>(`/pv/signals/${id}/prioritisation`, input)
  return data
}

export async function recordSignalAssessment(id: string, input: RecordSignalAssessmentInput): Promise<Signal> {
  const { data } = await post<Signal>(`/pv/signals/${id}/assessment`, input)
  return data
}

export async function recordSignalRecommendation(id: string, input: RecordSignalRecommendationInput): Promise<Signal> {
  const { data } = await post<Signal>(`/pv/signals/${id}/recommendation`, input)
  return data
}

export async function scanForSignals(): Promise<ScanResult> {
  const { data } = await post<ScanResult>('/pv/signals/scan', {})
  return data
}
