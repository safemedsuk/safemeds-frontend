import { get, patch, post } from './client'
import { PatientSex } from './pv-cases'

export type ClinicalTrialBlindingType = 'open_label' | 'single_blind' | 'double_blind'
export type ClinicalTrialStatus = 'active' | 'completed' | 'terminated'
export type ClinicalTrialSubjectStatus = 'enrolled' | 'withdrawn' | 'completed'

export const BLINDING_TYPE_LABELS: Record<ClinicalTrialBlindingType, string> = {
  open_label: 'Open-label',
  single_blind: 'Single-blind',
  double_blind: 'Double-blind',
}

export const TRIAL_STATUS_LABELS: Record<ClinicalTrialStatus, string> = {
  active: 'Active',
  completed: 'Completed',
  terminated: 'Terminated',
}

export interface ClinicalTrialSubject {
  id: string
  companyId: string
  clinicalTrialId: string
  subjectCode: string
  sex: PatientSex
  ageYears: number | null
  enrolledAt: string
  status: ClinicalTrialSubjectStatus
  /** Never present in any list/detail response — only `revealTreatmentArm()`'s own signature-gated call ever returns the plaintext value. */
  blindingBroken: boolean
  unblindedBy: string | null
  unblindedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ClinicalTrial {
  id: string
  companyId: string
  trialReference: string
  trialName: string
  sponsor: string | null
  phase: string | null
  blindingType: ClinicalTrialBlindingType
  ethicsCommitteeName: string | null
  ethicsCommitteeContactEmail: string | null
  clinicalTrialPortalReference: string | null
  countryId: string
  status: ClinicalTrialStatus
  startDate: string
  version: number
  createdAt: string
  updatedAt: string
  /** Cases linked to this trial not yet in the workflow's one terminal state — the "open SAEs" half of the trial-level dashboard. */
  openSaeCaseCount: number
  subjectCount: number
  /** Best-effort estimate — the real due-ness check happens server-side on a weekly scan. */
  annualRenewalDueAt: string
}

export interface ClinicalTrialWithSubjects extends ClinicalTrial {
  subjects: ClinicalTrialSubject[]
}

export interface CreateClinicalTrialInput {
  trialReference: string
  trialName: string
  sponsor?: string
  phase?: string
  blindingType?: ClinicalTrialBlindingType
  ethicsCommitteeName?: string
  ethicsCommitteeContactEmail?: string
  clinicalTrialPortalReference?: string
  countryId: string
  startDate: string
}

export interface UpdateClinicalTrialInput {
  trialName?: string
  sponsor?: string
  phase?: string
  ethicsCommitteeName?: string
  ethicsCommitteeContactEmail?: string
  clinicalTrialPortalReference?: string
  status?: ClinicalTrialStatus
}

export interface EnrollTrialSubjectInput {
  subjectCode: string
  sex?: PatientSex
  ageYears?: number
  enrolledAt: string
  /** Captured once at enrollment, encrypted at rest — never returned by this call or any read; only `revealTreatmentArm()` can ever surface it. */
  treatmentArm?: string
}

export interface RevealTreatmentArmInput {
  reason: string
  intentStatement: string
  signatureToken: string
}

export interface RevealTreatmentArmResult {
  treatmentArm: string | null
  blindingBroken: boolean
  unblindedAt: string | null
}

export interface ListClinicalTrialsParams {
  page?: number
  limit?: number
  q?: string
}

export interface ListClinicalTrialsResult {
  trials: ClinicalTrial[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export async function listClinicalTrials(params: ListClinicalTrialsParams = {}): Promise<ListClinicalTrialsResult> {
  const { data, meta } = await get<ClinicalTrial[]>('/pv/clinical-trials', { ...params })
  return { trials: data, meta: meta ?? { page: 1, limit: 25, total: data.length, totalPages: 1 } }
}

export async function getClinicalTrial(id: string): Promise<ClinicalTrialWithSubjects> {
  const { data } = await get<ClinicalTrialWithSubjects>(`/pv/clinical-trials/${id}`)
  return data
}

export interface ListClinicalTrialSubjectsResult {
  subjects: ClinicalTrialSubject[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

/**
 * Special Corner SC-5 — the "Enrolled Subjects" table's own paginated
 * read, distinct from `getClinicalTrial()`'s embedded `subjects` field
 * (kept unpaginated on purpose for the case-intake subject picker and
 * a case's own linked-subject lookup — see the backend service's own
 * doc comment on `listSubjects()` for the full reasoning).
 */
export async function listClinicalTrialSubjects(trialId: string, page = 1, limit = 10): Promise<ListClinicalTrialSubjectsResult> {
  const { data, meta } = await get<ClinicalTrialSubject[]>(`/pv/clinical-trials/${trialId}/subjects`, { page, limit })
  return { subjects: data, meta: meta ?? { page: 1, limit, total: data.length, totalPages: 1 } }
}

export async function createClinicalTrial(input: CreateClinicalTrialInput): Promise<ClinicalTrial> {
  const { data } = await post<ClinicalTrial>('/pv/clinical-trials', input)
  return data
}

export async function updateClinicalTrial(id: string, input: UpdateClinicalTrialInput): Promise<ClinicalTrial> {
  const { data } = await patch<ClinicalTrial>(`/pv/clinical-trials/${id}`, input)
  return data
}

export async function enrollTrialSubject(trialId: string, input: EnrollTrialSubjectInput): Promise<ClinicalTrialSubject> {
  const { data } = await post<ClinicalTrialSubject>(`/pv/clinical-trials/${trialId}/subjects`, input)
  return data
}

/** VigiCloud Stage 14 — the signature-gated reveal action. `signatureToken` comes from `reauth()`, exactly like every other electronic-signature action in this app (see `SignatureModal`). */
export async function revealTreatmentArm(subjectId: string, input: RevealTreatmentArmInput): Promise<RevealTreatmentArmResult> {
  const { data } = await post<RevealTreatmentArmResult>(`/pv/clinical-trials/subjects/${subjectId}/reveal-treatment-arm`, input)
  return data
}
