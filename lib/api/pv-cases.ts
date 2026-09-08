import { get, patch, post } from './client'
import type { ReportType } from './report-types'

export type CaseChannel = 'form' | 'drug_safety_email' | 'hotline_phone' | 'post' | 'whatsapp_qr' | 'public_url' | 'hcp_direct' | 'literature' | 'clinical_study'
export type ReporterType = 'consumer' | 'healthcare_professional'
export type PatientSex = 'male' | 'female' | 'unknown'
export type DrugCharacterization = 'suspect' | 'concomitant' | 'interacting'
export type ReactionOutcome = 'recovered' | 'recovering' | 'not_recovered' | 'recovered_with_sequelae' | 'fatal' | 'unknown'
export type WhoUmcCausality = 'certain' | 'probable_likely' | 'possible' | 'unlikely' | 'conditional_unclassified' | 'unassessable_unclassifiable'
export type ConsentMethod = 'verbal' | 'written' | 'implied'
export type PregnancyOutcome =
  | 'ongoing'
  | 'live_birth_normal'
  | 'live_birth_congenital_anomaly'
  | 'spontaneous_abortion'
  | 'elective_termination'
  | 'stillbirth'
  | 'ectopic_pregnancy'
  | 'unknown'

export const PREGNANCY_OUTCOME_LABELS: Record<PregnancyOutcome, string> = {
  ongoing: 'Ongoing',
  live_birth_normal: 'Live birth — normal',
  live_birth_congenital_anomaly: 'Live birth — congenital anomaly',
  spontaneous_abortion: 'Spontaneous abortion',
  elective_termination: 'Elective termination',
  stillbirth: 'Stillbirth',
  ectopic_pregnancy: 'Ectopic pregnancy',
  unknown: 'Unknown',
}

export const CASE_CHANNEL_LABELS: Record<CaseChannel, string> = {
  form: 'Paper/online form',
  drug_safety_email: 'Drug safety email',
  hotline_phone: 'Hotline (phone)',
  post: 'Post/mail',
  whatsapp_qr: 'WhatsApp / QR code',
  public_url: 'Public reporting URL',
  hcp_direct: 'Direct from healthcare professional',
  literature: 'Literature',
  clinical_study: 'Clinical study',
}

export interface Reporter {
  id: string
  caseId: string
  reporterType: ReporterType
  fullName: string | null
  email: string | null
  phone: string | null
  qualification: string | null
  countryId: string | null
  organization: string | null
  createdAt: string
}

export interface Patient {
  id: string
  caseId: string
  initials: string | null
  dateOfBirth: string | null
  ageYears: number | null
  sex: PatientSex
  weightKg: number | null
  heightCm: number | null
  /** Decrypted server-side on every fetch — see `additionalInformation`'s own note on `PvCase`. */
  medicalHistory: string | null
  createdAt: string
}

export interface SuspectProduct {
  id: string
  caseId: string
  drugCharacterization: DrugCharacterization
  medicinalProduct: string
  activeSubstanceName: string | null
  atcCode: string | null
  dosageForm: string | null
  route: string | null
  doseText: string | null
  batchNumber: string | null
  startDate: string | null
  endDate: string | null
  actionTaken: string | null
  obtainedCountryId: string | null
  /** VigiCloud Stage 2 — optional link to the tenant's own Product catalog, set when the case-intake product picker matched a real entry. */
  productId: string | null
  /** VigiCloud Stage 3.1 — special-situation flags matching ICH E2B(R3)'s `drugadditional` field group. */
  isOverdose: boolean
  isOffLabelUse: boolean
  isMisuse: boolean
  isMedicationError: boolean
  /** VigiCloud Stage 7 — the global WHODrug dictionary coding, distinct from `productId` above (the tenant's own catalog). Null until coded. */
  whoDrugTermId: string | null
  whoDrugTerm: WhoDrugTerm | null
  whoDrugCodedBy: string | null
  whoDrugCodedAt: string | null
  createdAt: string
}

export interface AdverseEvent {
  id: string
  caseId: string
  meddraTermId: string | null
  meddraTerm: MeddraTerm | null
  meddraCodedBy: string | null
  meddraCodedAt: string | null
  reportedTerm: string
  /** Decrypted server-side on every fetch — see `PvCase.additionalInformation`'s own note. */
  narrative: string
  onsetDate: string | null
  resolutionDate: string | null
  outcome: ReactionOutcome
  seriousnessDeath: boolean
  seriousnessLifeThreatening: boolean
  seriousnessHospitalization: boolean
  seriousnessDisabling: boolean
  seriousnessCongenitalAnomaly: boolean
  seriousnessOther: boolean
  /** VigiCloud Stage 3.1 — per Kenya PPB, therapeutic ineffectiveness is formally reportable; describes the nature of the outcome, not a product-usage circumstance. */
  isLackOfEfficacy: boolean
  createdAt: string
}

export interface PregnancyContext {
  id: string
  caseId: string
  expectedDeliveryDate: string | null
  gestationWeeksAtExposure: number | null
  outcome: PregnancyOutcome
  congenitalAnomalyDetail: string | null
  /** 8 weeks after `expectedDeliveryDate`, when known — not yet consumed by anything (Stage 11, Case Follow-Up), populated on day one regardless. */
  followUpDueAt: string | null
  createdAt: string
}

export interface CausalityAssessment {
  id: string
  caseId: string
  suspectProductId: string
  adverseEventId: string
  whoUmcCategory: WhoUmcCausality | null
  naranjoScore: number | null
  /** The raw 10-question answer set the score was computed from — null until a Naranjo submission has been made at least once. */
  naranjoAnswers: NaranjoAnswers | null
  assessedBy: string | null
  assessedAt: string | null
  createdAt: string
}

/** VigiCloud Stage 8 — the WHO-UMC assessment-criteria checklist, transcribed from `vigicloud docs/who causality-assessment.pdf` Table 2 ("assessment criteria... developed for practical training"). Purely a UI aid — the reviewer still just picks one category; these bullets are what makes that pick defensible. */
export const WHO_UMC_LABELS: Record<WhoUmcCausality, string> = {
  certain: 'Certain',
  probable_likely: 'Probable / Likely',
  possible: 'Possible',
  unlikely: 'Unlikely',
  conditional_unclassified: 'Conditional / Unclassified',
  unassessable_unclassifiable: 'Unassessable / Unclassifiable',
}

export const WHO_UMC_CRITERIA: Record<WhoUmcCausality, string[]> = {
  certain: [
    'Event or lab abnormality with a plausible time relationship to drug intake',
    'Cannot be explained by disease or other drugs',
    'Response to withdrawal is plausible (pharmacologically/pathologically)',
    'Event is definitive pharmacologically or phenomenologically',
    'Rechallenge satisfactory, if necessary',
  ],
  probable_likely: [
    'Event or lab abnormality with a reasonable time relationship to drug intake',
    'Unlikely to be attributed to disease or other drugs',
    'Response to withdrawal is clinically reasonable',
    'Rechallenge not required',
  ],
  possible: [
    'Event or lab abnormality with a reasonable time relationship to drug intake',
    'Could also be explained by disease or other drugs',
    'Information on drug withdrawal may be lacking or unclear',
  ],
  unlikely: [
    'Time to drug intake makes a relationship improbable (but not impossible)',
    'Disease or other drugs provide a plausible explanation',
  ],
  conditional_unclassified: ['Event or lab abnormality reported', 'More data needed for a proper assessment, or additional data under examination'],
  unassessable_unclassifiable: ['Report suggests an adverse reaction', 'Cannot be judged — information is insufficient or contradictory and cannot be supplemented or verified'],
}

/** VigiCloud Stage 8 — the exact 10 Naranjo questions, in order, from `vigicloud docs/Naranjo-assessment.pdf`. */
export type NaranjoAnswerValue = 'yes' | 'no' | 'unknown'

export interface NaranjoAnswers {
  q1: NaranjoAnswerValue
  q2: NaranjoAnswerValue
  q3: NaranjoAnswerValue
  q4: NaranjoAnswerValue
  q5: NaranjoAnswerValue
  q6: NaranjoAnswerValue
  q7: NaranjoAnswerValue
  q8: NaranjoAnswerValue
  q9: NaranjoAnswerValue
  q10: NaranjoAnswerValue
}

export const NARANJO_QUESTIONS: { key: keyof NaranjoAnswers; text: string }[] = [
  { key: 'q1', text: 'Are there previous conclusive reports on this reaction?' },
  { key: 'q2', text: 'Did the adverse event appear after the suspected drug was administered?' },
  { key: 'q3', text: 'Did the adverse reaction improve when the drug was discontinued, or a specific antagonist was administered?' },
  { key: 'q4', text: 'Did the adverse event reappear when the drug was re-administered?' },
  { key: 'q5', text: 'Are there alternative causes (other than the drug) that could on their own have caused the reaction?' },
  { key: 'q6', text: 'Did the reaction reappear when a placebo was given?' },
  { key: 'q7', text: 'Was the drug detected in blood (or other fluids) in concentrations known to be toxic?' },
  { key: 'q8', text: 'Was the reaction more severe when the dose was increased, or less severe when the dose was decreased?' },
  { key: 'q9', text: 'Did the patient have a similar reaction to the same or similar drugs in any previous exposure?' },
  { key: 'q10', text: 'Was the adverse event confirmed by any objective evidence?' },
]

export type NaranjoInterpretation = 'definite' | 'probable' | 'possible' | 'doubtful'

export const NARANJO_INTERPRETATION_LABELS: Record<NaranjoInterpretation, string> = {
  definite: 'Definite (≥9)',
  probable: 'Probable (5–8)',
  possible: 'Possible (1–4)',
  doubtful: 'Doubtful (≤0)',
}

/** Mirrors `interpretNaranjoScore()` on the backend exactly — a pure, client-side-only convenience so the UI can show a live label as the reviewer answers, before submitting. */
export function interpretNaranjoScore(score: number): NaranjoInterpretation {
  if (score >= 9) return 'definite'
  if (score >= 5) return 'probable'
  if (score >= 1) return 'possible'
  return 'doubtful'
}

export interface PvCase {
  id: string
  companyId: string
  referenceNumber: string
  reportTypeId: string
  countryOfOccurrenceId: string
  countryOfReportId: string
  channel: CaseChannel
  /** VigiCloud Stage 14 — set only when channel is clinical_study; a clinical-trial SAE is solicited, not spontaneous. */
  clinicalTrialId: string | null
  clinicalTrialSubjectId: string | null
  awarenessDate: string
  receivedDate: string
  duplicateOfCaseId: string | null
  status: string
  version: number
  /** Null for a system-channel case (public URL, email, WhatsApp) — no logged-in human actor created it. */
  createdBy: string | null
  /** VigiCloud Stage 3.1 — a `Case` flag, not a separate intake path. */
  suspectedFalsifiedOrSubstandard: boolean
  /** VigiCloud Stage 3.3/3.4 — true for every system-channel case until a human with `pv.triage_case` calls `confirmDraft()`; always false for an authenticated-wizard case. */
  requiresDraftReview: boolean
  /** Real-usage feedback, 19 Aug 2026 — the reviewer currently working this draft-review case, if any; must be set (by that same actor) before `confirmDraftCase()` succeeds. */
  draftClaimedBy: string | null
  draftClaimedAt: string | null
  /** The email Message-Id, WhatsApp sender ID, or null (public URL/form) — traceability back to the original inbound artifact. */
  sourceChannelReference: string | null
  /** VigiCloud Stage 5 — null until `classifyCase()` has run at least once for this case. */
  seriousnessClass: SeriousnessClass | null
  /** Decrypted server-side on every fetch — the raw ciphertext is never sent to the client (see CLAUDE.md's gotchas list for the read-path bug this replaced). */
  additionalInformation: string | null
  /** VigiCloud Stage 6 — a manual reviewer judgment, per Reconciliation Note 3; `not_assessed` until `assessExpectedness()` runs. */
  expectednessFlag: ExpectednessFlag
  expectednessNote: string | null
  expectednessAssessedBy: string | null
  expectednessAssessedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PvCaseWithGraph extends PvCase {
  reporter: Reporter | null
  patient: Patient | null
  suspectProducts: SuspectProduct[]
  adverseEvents: AdverseEvent[]
  causalityAssessments: CausalityAssessment[]
  pregnancyContext?: PregnancyContext | null
  /** VigiCloud Stage 4 — always freshly evaluated by the backend on every fetch, never cached. */
  validityGate: ValidityGateResult
  /** VigiCloud Stage 5 — the case's real computed reporting deadline, once `classifyCase()` has run at least once; null until then. */
  deadline: Deadline | null
  /** VigiCloud Stage 8/9 — drives the Workflow Actions panel on the case detail page. */
  workflowInstanceId: string | null
  /** Stage 1 task 1.1 — joined in on `GET /pv/cases/:id` only (not the list endpoint), so the case detail page can show which report type was selected at intake. */
  reportType?: ReportType
  /** testing-todo Stage 17.1 — every workflow transition, with its documented rationale where one was given. Same shape as `SignalTransitionLogEntry` (`lib/api/signals.ts`) — both are sourced from the identical backend mechanism (`AuditService.query()` over `action: 'state_change'`), kept as separate types since each API client file is otherwise self-contained. */
  transitionHistory?: CaseTransitionLogEntry[]
}

export interface CaseTransitionLogEntry {
  fromStateKey: string | null
  toStateKey: string
  note: string | null
  actorName: string | null
  occurredAt: string
}

export interface AssessCausalityInput {
  whoUmcCategory?: WhoUmcCausality
  naranjoAnswers?: NaranjoAnswers
}

/** VigiCloud Stage 4 — the four minimum criteria a case needs before it can leave Intake, per the Final doc §D. */
export type ValidityCriterionKey = 'identifiable_patient' | 'identifiable_reporter' | 'suspect_product' | 'adverse_event'

export interface ValidityCriterion {
  key: ValidityCriterionKey
  label: string
  met: boolean
}

export interface ValidityGateResult {
  allowed: boolean
  criteria: ValidityCriterion[]
}

/** Only ADR has a real three-tier scheme (fatal/serious/non_serious) seeded today — every other report type only ever resolves to serious/non_serious. */
export type SeriousnessClass = 'fatal' | 'serious' | 'non_serious'

export const SERIOUSNESS_CLASS_LABELS: Record<SeriousnessClass, string> = {
  fatal: 'Fatal',
  serious: 'Serious',
  non_serious: 'Non-serious',
}

export interface Deadline {
  id: string
  companyId: string
  recordType: string
  recordId: string
  reportingRuleId: string
  dueAt: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface ClassifyCaseInput {
  /** Omit to let the backend auto-derive from the case's own adverse-event seriousness flags. */
  seriousnessClass?: SeriousnessClass
}

export interface ClassifyResult {
  case: PvCase
  deadline: Deadline | null
  /** True when no active, verified reporting rule resolves yet for this report type/seriousness (real today for quality_complaint/medication_error/transfusion_reaction) — the case is still classified, the clock just hasn't started. */
  deadlineUnavailable: boolean
}

/** VigiCloud Stage 6 — a manual flag set by a reviewer; see `Case.expectednessFlag`'s backend doc comment for why this is manual, not computed. */
export type ExpectednessFlag = 'listed' | 'unlisted' | 'not_assessed'

export const EXPECTEDNESS_FLAG_LABELS: Record<ExpectednessFlag, string> = {
  listed: 'Listed (expected)',
  unlisted: 'Unlisted (unexpected)',
  not_assessed: 'Not yet assessed',
}

export interface AssessExpectednessInput {
  expectednessFlag: ExpectednessFlag
  note?: string
}

/** VigiCloud Stage 7 — a node in the MedDRA hierarchy (System Organ Class → High-Level Group Term → High-Level Term → Preferred Term → Lowest-Level Term). Real coding practice assigns the LLT closest to the reporter's own words. */
export type MeddraLevel = 'SOC' | 'HLGT' | 'HLT' | 'PT' | 'LLT'

export interface MeddraTerm {
  id: string
  code: string
  level: MeddraLevel
  name: string
  parentId: string | null
}

/** VigiCloud Stage 7 — a WHODrug Global dictionary entry (mock subset until a real UMC subscription exists — see CLAUDE.md/needs.md). */
export interface WhoDrugTerm {
  id: string
  drugRecordNumber: string
  name: string
  substanceName: string | null
  atcCode: string | null
}

export interface SourceDocument {
  id: string
  caseId: string
  documentId: string
  redactionApplied: boolean
  redactedBy: string | null
  redactedAt: string | null
  /** VigiCloud Stage 3.7 — the redacted-copy upload slot, distinct from the original `documentId`. */
  redactedDocumentId: string | null
  createdAt: string
}

export interface CreateReporterInput {
  reporterType: ReporterType
  fullName?: string
  email?: string
  phone?: string
  qualification?: string
  countryId?: string
  organization?: string
}

export interface CreatePatientInput {
  initials?: string
  dateOfBirth?: string
  ageYears?: number
  sex?: PatientSex
  weightKg?: number
  heightCm?: number
  medicalHistory?: string
}

export interface CreateSuspectProductInput {
  drugCharacterization: DrugCharacterization
  medicinalProduct: string
  activeSubstanceName?: string
  atcCode?: string
  dosageForm?: string
  route?: string
  doseText?: string
  batchNumber?: string
  startDate?: string
  endDate?: string
  actionTaken?: string
  obtainedCountryId?: string
  /** Set when this row was populated by the product picker against a real catalog entry — every other field remains editable/overridable regardless. */
  productId?: string
  isOverdose?: boolean
  isOffLabelUse?: boolean
  isMisuse?: boolean
  isMedicationError?: boolean
}

export interface CreateAdverseEventInput {
  meddraTermId?: string
  reportedTerm: string
  narrative: string
  onsetDate?: string
  resolutionDate?: string
  outcome?: ReactionOutcome
  seriousnessDeath?: boolean
  seriousnessLifeThreatening?: boolean
  seriousnessHospitalization?: boolean
  seriousnessDisabling?: boolean
  seriousnessCongenitalAnomaly?: boolean
  seriousnessOther?: boolean
  isLackOfEfficacy?: boolean
}

export interface CreatePregnancyInput {
  expectedDeliveryDate?: string
  gestationWeeksAtExposure?: number
  outcome?: PregnancyOutcome
  congenitalAnomalyDetail?: string
}

export interface CreatePvCaseInput {
  reportTypeId: string
  countryOfOccurrenceId: string
  countryOfReportId: string
  channel?: CaseChannel
  /** VigiCloud Stage 14 — required by the backend when channel is clinical_study. */
  clinicalTrialId?: string
  clinicalTrialSubjectId?: string
  awarenessDate: string
  receivedDate: string
  additionalInformation?: string
  reporter: CreateReporterInput
  patient: CreatePatientInput
  suspectProducts: CreateSuspectProductInput[]
  adverseEvents: CreateAdverseEventInput[]
  consent?: { granted: boolean; method: ConsentMethod }
  /** VigiCloud Stage 3.1 — a Case-level flag, not a separate intake path. */
  suspectedFalsifiedOrSubstandard?: boolean
  pregnancy?: CreatePregnancyInput
}

export interface ListPvCasesParams {
  page?: number
  limit?: number
  status?: string
  search?: string
  /** VigiCloud Stage 3.3/3.4 — filters to exactly the draft-review queue (system-channel cases no human has confirmed yet) when `true`. */
  requiresDraftReview?: boolean
}

export interface ListPvCasesResult {
  cases: PvCase[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export async function createPvCase(input: CreatePvCaseInput): Promise<PvCaseWithGraph> {
  const { data } = await post<PvCaseWithGraph>('/pv/cases', input)
  return data
}

export async function listPvCases(params: ListPvCasesParams = {}): Promise<ListPvCasesResult> {
  const { data, meta } = await get<PvCase[]>('/pv/cases', { ...params })
  return { cases: data, meta: meta ?? { page: 1, limit: 25, total: data.length, totalPages: 1 } }
}

export async function getPvCase(id: string): Promise<PvCaseWithGraph> {
  const { data } = await get<PvCaseWithGraph>(`/pv/cases/${id}`)
  return data
}

/**
 * Stage 1 tasks 1.4/4.2 — fixes a case stuck at the Validity Gate. All
 * four are backend-enforced to only work while the case is still at
 * Intake — see `PvCaseService.requireCaseAtIntake()`'s own doc comment.
 */
export async function updateCaseReporter(caseId: string, input: CreateReporterInput): Promise<Reporter> {
  const { data } = await patch<Reporter>(`/pv/cases/${caseId}/reporter`, input)
  return data
}

export async function updateCasePatient(caseId: string, input: CreatePatientInput): Promise<Patient> {
  const { data } = await patch<Patient>(`/pv/cases/${caseId}/patient`, input)
  return data
}

export async function addCaseSuspectProduct(caseId: string, input: CreateSuspectProductInput): Promise<SuspectProduct> {
  const { data } = await post<SuspectProduct>(`/pv/cases/${caseId}/suspect-products`, input)
  return data
}

export async function addCaseAdverseEvent(caseId: string, input: CreateAdverseEventInput): Promise<AdverseEvent> {
  const { data } = await post<AdverseEvent>(`/pv/cases/${caseId}/adverse-events`, input)
  return data
}

/** VigiCloud Stage 3.3/3.4 — confirms a system-channel draft case, gated by `pv.triage_case` at the backend (a triage action, not the same permission as capturing a case oneself). Requires the case to be claimed by the calling actor first — see `claimDraftCase()`. */
export async function confirmDraftCase(id: string): Promise<PvCase> {
  const { data } = await post<PvCase>(`/pv/cases/${id}/confirm-draft`)
  return data
}

/** Real-usage feedback, 19 Aug 2026 — claims a draft-review case for the calling actor; 409s if someone else already holds the claim. */
export async function claimDraftCase(id: string): Promise<PvCase> {
  const { data } = await post<PvCase>(`/pv/cases/${id}/claim-draft`)
  return data
}

/** Releases a claim so another reviewer can pick it up — only the current claimant (or a `pv.view_all` holder) can release it. */
export async function releaseDraftCase(id: string): Promise<PvCase> {
  const { data } = await post<PvCase>(`/pv/cases/${id}/release-draft`)
  return data
}

/** VigiCloud Stage 5 — derives (or accepts an explicit override of) the case's seriousness and computes/recomputes its real legal reporting deadline. Callable any number of times — reclassification mid-case is the normal path, not an edge case. */
export async function classifyCase(id: string, input: ClassifyCaseInput = {}): Promise<ClassifyResult> {
  const { data } = await post<ClassifyResult>(`/pv/cases/${id}/triage`, input)
  return data
}

/** VigiCloud Stage 7 — assigns a MedDRA term to one of this case's adverse events. Callable any number of times; re-coding is fully audited server-side. */
export async function codeAdverseEvent(caseId: string, adverseEventId: string, meddraTermId: string): Promise<AdverseEvent> {
  const { data } = await post<AdverseEvent>(`/pv/cases/${caseId}/adverse-events/${adverseEventId}/code`, { meddraTermId })
  return data
}

/** VigiCloud Stage 7 — assigns a WHODrug term to one of this case's suspect/concomitant products. */
export async function codeSuspectProduct(caseId: string, suspectProductId: string, whoDrugTermId: string): Promise<SuspectProduct> {
  const { data } = await post<SuspectProduct>(`/pv/cases/${caseId}/suspect-products/${suspectProductId}/code`, { whoDrugTermId })
  return data
}

/** VigiCloud Stage 6 — records a manual expectedness/listedness judgment. Callable any number of times — reassessment is the normal path. */
export async function assessExpectedness(caseId: string, input: AssessExpectednessInput): Promise<PvCase> {
  const { data } = await post<PvCase>(`/pv/cases/${caseId}/expectedness`, input)
  return data
}

/** VigiCloud Stage 8 — records a WHO-UMC category and/or a Naranjo answer set for one (suspect product × adverse event) pair. Either or both may be submitted in one call. */
export async function assessCausality(caseId: string, assessmentId: string, input: AssessCausalityInput): Promise<CausalityAssessment> {
  const { data } = await post<CausalityAssessment>(`/pv/cases/${caseId}/causality-assessments/${assessmentId}`, input)
  return data
}

export async function linkSourceDocument(caseId: string, documentId: string): Promise<SourceDocument> {
  const { data } = await post<SourceDocument>(`/pv/cases/${caseId}/source-documents`, { documentId })
  return data
}

export async function listSourceDocuments(caseId: string): Promise<SourceDocument[]> {
  const { data } = await get<SourceDocument[]>(`/pv/cases/${caseId}/source-documents`)
  return data
}

export async function redactSourceDocument(sourceDocumentId: string, redactedDocumentId?: string): Promise<SourceDocument> {
  const { data } = await post<SourceDocument>(`/pv/source-documents/${sourceDocumentId}/redact`, redactedDocumentId ? { redactedDocumentId } : undefined)
  return data
}

// ── VigiCloud Stage 10 — Duplicate Linking & Detection ──────────────────

export type DuplicateReviewStatus = 'possible' | 'confirmed_duplicate' | 'not_duplicate'
export type DuplicateResolutionPattern = 'allocation' | 'creation'

export interface DuplicateReview {
  id: string
  caseId: string
  matchedCaseId: string
  status: DuplicateReviewStatus
  /** Which detection signal(s) fired — e.g. `{ citedReferenceNumber: true }` or `{ country: true, sex: true, age: true, products: [...], reactions: [...] }`. */
  matchedFields: Record<string, unknown>
  detectedAt: string
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNote: string | null
  resolutionPattern: DuplicateResolutionPattern | null
  case: { id: string; referenceNumber: string }
  matchedCase: { id: string; referenceNumber: string }
  createdAt: string
}

export interface ConfirmDuplicateInput {
  resolutionPattern: DuplicateResolutionPattern
  /** Required for `allocation` — must be either the review's `caseId` or `matchedCaseId`. */
  masterCaseId?: string
  reviewNote?: string
}

export async function listDuplicateReviews(caseId: string): Promise<DuplicateReview[]> {
  const { data } = await get<DuplicateReview[]>(`/pv/cases/${caseId}/duplicate-reviews`)
  return data
}

export async function confirmDuplicate(reviewId: string, input: ConfirmDuplicateInput): Promise<{ review: DuplicateReview; masterCaseId: string }> {
  const { data } = await post<{ review: DuplicateReview; masterCaseId: string }>(`/pv/duplicate-reviews/${reviewId}/confirm`, input)
  return data
}

export async function dismissDuplicate(reviewId: string, reviewNote: string): Promise<DuplicateReview> {
  const { data } = await post<DuplicateReview>(`/pv/duplicate-reviews/${reviewId}/dismiss`, { reviewNote })
  return data
}

// ── VigiCloud Stage 11 — Case Follow-Up ──────────────────────────────────

export type CaseFollowUpStatus = 'pending_attempt_1' | 'pending_attempt_2' | 'closed_resolved' | 'closed_failed'
export type FollowUpChannel = 'email' | 'phone'
export type FollowUpAttemptOutcome = 'pending' | 'responded_resolved' | 'responded_new_information' | 'no_response'

export interface CaseFollowUpAttempt {
  id: string
  followUpId: string
  attemptNumber: number
  channel: FollowUpChannel
  outcome: FollowUpAttemptOutcome
  triggeredAt: string
  dueAt: string
  respondedAt: string | null
  loggedBy: string | null
  note: string | null
}

export interface CaseFollowUp {
  id: string
  caseId: string
  status: CaseFollowUpStatus
  cycleStartedAt: string
  /** The hard 28-calendar-day ceiling — never moves once the cycle starts. */
  closesByDate: string
  lastResponseAt: string | null
  nextCheckDueAt: string | null
  closedAt: string | null
  closedReason: string | null
  startedBy: string | null
  attempts: CaseFollowUpAttempt[]
}

export const FOLLOW_UP_STATUS_LABELS: Record<CaseFollowUpStatus, string> = {
  pending_attempt_1: 'Awaiting attempt 1',
  pending_attempt_2: 'Awaiting attempt 2',
  closed_resolved: 'Resolved',
  closed_failed: 'Closed — no response',
}

export async function getCaseFollowUp(caseId: string): Promise<CaseFollowUp | null> {
  const { data } = await get<CaseFollowUp | null>(`/pv/cases/${caseId}/follow-up`)
  return data
}

export async function startCaseFollowUp(caseId: string): Promise<CaseFollowUp> {
  const { data } = await post<CaseFollowUp>(`/pv/cases/${caseId}/follow-up`)
  return data
}

export interface LogFollowUpAttemptInput {
  outcome: 'responded_resolved' | 'responded_new_information' | 'no_response'
  note?: string
}

export async function logFollowUpAttempt(followUpId: string, input: LogFollowUpAttemptInput): Promise<CaseFollowUp> {
  const { data } = await post<CaseFollowUp>(`/pv/case-follow-ups/${followUpId}/log-attempt`, input)
  return data
}

// ── VigiCloud Stage 12 — Regulatory Submission (E2B, No Gateway) ────────

export interface RegulatorySubmission {
  id: string
  caseId: string
  submissionNumber: number
  authority: { id: string; code: string; name: string }
  /** The `ReportabilityService` snapshot taken at generation time — a case can still be generated for a QPPV's own records even when not individually reportable (e.g. a foreign case), the reason is always shown plainly either way. */
  reportable: boolean
  reportabilityReason: string
  xmlDocumentId: string
  pdfDocumentId: string
  generatedBy: string
  generatedAt: string
  evidenceDocumentId: string | null
  submittedAt: string | null
  submittedBy: string | null
}

export async function generateRegulatorySubmission(caseId: string): Promise<RegulatorySubmission> {
  const { data } = await post<RegulatorySubmission>(`/pv/cases/${caseId}/regulatory-submissions`)
  return data
}

export async function listRegulatorySubmissions(caseId: string): Promise<RegulatorySubmission[]> {
  const { data } = await get<RegulatorySubmission[]>(`/pv/cases/${caseId}/regulatory-submissions`)
  return data
}

export async function getRegulatorySubmissionDownloadUrl(submissionId: string, artifact: 'xml' | 'pdf' | 'evidence'): Promise<string> {
  const { data } = await get<{ url: string }>(`/pv/regulatory-submissions/${submissionId}/download-url`, { artifact })
  return data.url
}

export async function attachRegulatorySubmissionEvidence(submissionId: string, file: File): Promise<RegulatorySubmission> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await post<RegulatorySubmission>(`/pv/regulatory-submissions/${submissionId}/evidence`, formData)
  return data
}
