import { get, PaginationMeta, post } from './client'
import { RegDeadlineRule, RegulatoryFeeSchedule, RegulatoryRequirement } from './regulatory-config'

/**
 * RegCloud (Phase 12) Stages 1–3 — Classify & Plan, Compile Dossier, and
 * the Completeness & Format Check gate. No new backend models — `classify()`
 * is a pure preview over Stage 0.1's own resolve endpoints, and dossier
 * compilation/completeness are all `RegDossier`/`RegDossierDocumentSlot`
 * (Stage 0.3) plus the real `reg_registration` workflow (Stage 1's own
 * contribution) — see `RegDossierService`'s own doc comment.
 */

export interface ClassificationPreview {
  requirement: RegulatoryRequirement | null
  feeSchedules: RegulatoryFeeSchedule[]
  renewalRule: RegDeadlineRule | null
  warnings: string[]
}

export interface RegDossierDocumentSlot {
  id: string
  regDossierId: string
  requiredDocumentDefinitionId: string | null
  labelOverride: string | null
  documentId: string | null
  ctdModule: string | null
}

export interface RegDossier {
  id: string
  companyId: string
  productId: string
  authorityId: string
  productClass: string
  route: string
  regulatoryRequirementId: string | null
  productRegistrationId: string | null
  /** RegCloud (Phase 12) Stage 12 — set when this dossier is a Clinical Trial Application. */
  clinicalTrialId: string | null
  /** RegCloud (Phase 12) Stage 16 — set when this dossier is grouped under a Reliance Application. */
  relianceApplicationId: string | null
  /** RegCloud (Phase 12) Stage 15 — this dossier's own engagement-model override, if one was set at creation. Null means "use the company default" — see `effectiveEngagementType` on the detail response for the resolved value. */
  engagementType: string | null
  status: string
  version: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
  documentSlots: RegDossierDocumentSlot[]
  product: { brandName: string }
  authority: { name: string; code: string }
}

export interface CompletenessSlotResult {
  slotId: string
  label: string
  ctdModule: string | null
  isMandatory: boolean
  attached: boolean
  met: boolean
}

export interface CompletenessGateResult {
  allowed: boolean
  slots: CompletenessSlotResult[]
}

export interface TransitionLogEntry {
  fromStateKey: string | null
  toStateKey: string
  note: string | null
  actorName: string | null
  occurredAt: string
}

export interface RegVariationSummary {
  id: string
  variationType: string
  productRegistrationId: string
  productRegistrationNumber: string
}

export interface RegDossierDetail extends RegDossier {
  workflowInstanceId: string | null
  completeness: CompletenessGateResult
  transitionHistory: TransitionLogEntry[]
  /** RegCloud Stage 7 — set only when this dossier is a variation/renewal of an existing registration. */
  variation: RegVariationSummary | null
  /** RegCloud (Phase 12) Stage 15 — this dossier's own override resolved against the company's default engagement model. */
  effectiveEngagementType: string
}

export interface RegDossierPage {
  rows: RegDossier[]
  meta: PaginationMeta
}

// ── Stage 4 — Submit ────────────────────────────────────────────────────

export type SubmissionChannel = 'vigiflow' | 'dhis2' | 'portal' | 'paper_pdf' | 'email'

export interface RegSubmission {
  id: string
  companyId: string
  regDossierId: string
  authorityId: string
  submissionNumber: number
  channel: SubmissionChannel
  coverSheetDocumentId: string
  generatedBy: string
  generatedAt: string
  evidenceDocumentId: string | null
  dispatchedAt: string | null
  dispatchedBy: string | null
  createdAt: string
  updatedAt: string
}

export async function listRegSubmissions(dossierId: string): Promise<RegSubmission[]> {
  const { data } = await get<RegSubmission[]>(`/reg-dossiers/${dossierId}/submissions`)
  return data
}

export async function generateRegSubmission(dossierId: string): Promise<RegSubmission> {
  const { data } = await post<RegSubmission>(`/reg-dossiers/${dossierId}/submissions`)
  return data
}

export async function attachRegSubmissionEvidence(dossierId: string, submissionId: string, file: File): Promise<RegSubmission> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await post<RegSubmission>(`/reg-dossiers/${dossierId}/submissions/${submissionId}/evidence`, formData)
  return data
}

// ── Stage 5 — Query & Assessment ────────────────────────────────────────

export interface RegQuery {
  id: string
  companyId: string
  regDossierId: string
  receivedDate: string
  queryText: string
  queryLetterDocumentId: string | null
  status: 'open' | 'closed'
  respondedAt: string | null
  responseDocumentId: string | null
  /** RegCloud (Phase 12) Stage 15 — set instead of `responseDocumentId` when this dossier's effective engagement is `client_handles_queries` and the client resolved it directly with the regulator. */
  responseNote: string | null
  respondedBy: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export async function listRegQueries(dossierId: string): Promise<RegQuery[]> {
  const { data } = await get<RegQuery[]>(`/reg-dossiers/${dossierId}/queries`)
  return data
}

export async function receiveRegQuery(dossierId: string, payload: { queryText: string; receivedDate?: string }): Promise<RegQuery> {
  const { data } = await post<RegQuery>(`/reg-dossiers/${dossierId}/queries`, payload)
  return data
}

export async function respondRegQuery(dossierId: string, queryId: string, file?: File, note?: string): Promise<RegQuery> {
  const formData = new FormData()
  if (file) formData.append('file', file)
  if (note) formData.append('note', note)
  const { data } = await post<RegQuery>(`/reg-dossiers/${dossierId}/queries/${queryId}/respond`, formData)
  return data
}

// ── Stage 7 — Lifecycle: Variations & Renewals ──────────────────────────

export interface RegVariation {
  id: string
  companyId: string
  productRegistrationId: string
  variationType: string
  regDossierId: string
  status: 'open' | 'approved' | 'rejected'
  submittedAt: string | null
  approvedAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export async function listRegVariations(productRegistrationId: string): Promise<RegVariation[]> {
  const { data } = await get<RegVariation[]>('/reg-variations', { productRegistrationId })
  return data
}

export async function getRegVariation(id: string): Promise<RegVariation & { regDossier: RegDossierDetail }> {
  const { data } = await get<RegVariation & { regDossier: RegDossierDetail }>(`/reg-variations/${id}`)
  return data
}

export async function createRegVariation(payload: {
  productRegistrationId: string
  variationType: string
  productId?: string
  authorityId?: string
  productClass?: string
  route?: string
}): Promise<RegVariation & { regDossier: RegDossierDetail }> {
  const { data } = await post<RegVariation & { regDossier: RegDossierDetail }>('/reg-variations', payload)
  return data
}

export async function classifyRegistration(params: { authorityId: string; productClass: string; route?: string }): Promise<ClassificationPreview> {
  const { data } = await get<ClassificationPreview>('/reg-dossiers/classify', params)
  return data
}

export async function listRegDossiers(
  params: { productId?: string; clinicalTrialId?: string; relianceApplicationId?: string; page?: number; limit?: number } = {},
): Promise<RegDossierPage> {
  const { data, meta } = await get<RegDossier[]>('/reg-dossiers', params)
  return { rows: data, meta: meta! }
}

export async function getRegDossier(id: string): Promise<RegDossierDetail> {
  const { data } = await get<RegDossierDetail>(`/reg-dossiers/${id}`)
  return data
}

export async function getRegDossierCompleteness(id: string): Promise<CompletenessGateResult> {
  const { data } = await get<CompletenessGateResult>(`/reg-dossiers/${id}/completeness`)
  return data
}

export async function createRegDossier(payload: {
  productId: string
  authorityId: string
  productClass: string
  route?: string
  clinicalTrialId?: string
  relianceApplicationId?: string
  engagementType?: string
}): Promise<RegDossier> {
  const { data } = await post<RegDossier>('/reg-dossiers', payload)
  return data
}

export async function addRegDossierSlot(dossierId: string, payload: { labelOverride: string; ctdModule?: string }): Promise<RegDossierDocumentSlot> {
  const { data } = await post<RegDossierDocumentSlot>(`/reg-dossiers/${dossierId}/slots`, payload)
  return data
}

export async function attachRegDossierDocument(dossierId: string, slotId: string, documentId: string): Promise<RegDossierDocumentSlot> {
  const { data } = await post<RegDossierDocumentSlot>(`/reg-dossiers/${dossierId}/slots/${slotId}/attach`, { documentId })
  return data
}

export async function detachRegDossierDocument(dossierId: string, slotId: string): Promise<RegDossierDocumentSlot> {
  const { data } = await post<RegDossierDocumentSlot>(`/reg-dossiers/${dossierId}/slots/${slotId}/detach`)
  return data
}
