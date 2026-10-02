import { del, get, PaginationMeta, patch, post } from './client'
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
  /** testing-correction-explanation.md §1.2 — true for a variation/renewal dossier: the checklist below is shown for guidance only and never blocks. */
  guidanceOnly: boolean
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
  /** testing-correction-explanation.md §2.2 — `VAR-00001-<reg number>`/`REN-00001-<reg number>`. */
  displayCode: string
  productRegistrationId: string
  productRegistrationNumber: string
}

/** testing-correction-explanation.md §2.5 — drives the dossier list's "Kind" column and the detail page's stage-tracker labels. */
export type RegDossierKind = 'registration' | 'variation' | 'renewal'

export interface RegDossierDetail extends RegDossier {
  workflowInstanceId: string | null
  completeness: CompletenessGateResult
  transitionHistory: TransitionLogEntry[]
  /** RegCloud Stage 7 — set only when this dossier is a variation/renewal of an existing registration. */
  variation: RegVariationSummary | null
  kind: RegDossierKind
  /** RegCloud (Phase 12) Stage 15 — this dossier's own override resolved against the company's default engagement model. */
  effectiveEngagementType: string
}

export interface RegDossierListRow extends RegDossier {
  kind: RegDossierKind
  variation: RegVariationSummary | null
}

export interface RegDossierPage {
  rows: RegDossierListRow[]
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

/** testing-correction-explanation.md §1.3 — remove a wrongly-attached evidence file so a correct one can be uploaded in its place. */
export async function removeRegSubmissionEvidence(dossierId: string, submissionId: string): Promise<RegSubmission> {
  const { data } = await del<RegSubmission>(`/reg-dossiers/${dossierId}/submissions/${submissionId}/evidence`)
  return data
}

// ── Stage 5 — Query & Assessment ────────────────────────────────────────

/**
 * CEO feedback, 30 Sep 2026 — the real query register's own widened
 * lifecycle. `overdue` is never a stored value — see `isOverdue`.
 */
export type RegQueryStatus = 'open' | 'in_progress' | 'responded' | 'closed'

export interface RegQuery {
  id: string
  companyId: string
  regDossierId: string
  receivedDate: string
  queryText: string
  queryLetterDocumentId: string | null
  status: RegQueryStatus
  respondedAt: string | null
  /** testing-correction-explanation.md §2.1 — the real date the response was sent to the regulator, distinct from `respondedAt` (system timestamp). */
  respondedDate: string | null
  responseDocumentId: string | null
  /** RegCloud (Phase 12) Stage 15 — set instead of `responseDocumentId` when this dossier's effective engagement is `client_handles_queries` and the client resolved it directly with the regulator. Now always populated (§2.1), even alongside a document. */
  responseNote: string | null
  respondedBy: string | null
  /** CEO feedback, 30 Sep 2026 — the regulator's own stated deadline, entered manually for now. */
  responseDueDate: string | null
  /** True while `status` is `open`/`in_progress` and `responseDueDate` has passed — computed live, never stored. */
  isOverdue: boolean
  ownerUserId: string | null
  closedAt: string | null
  closedBy: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface RegQueryCorrespondence {
  id: string
  companyId: string
  regQueryId: string
  direction: 'from_regulator' | 'to_regulator' | 'internal_note'
  channel: 'letter' | 'email' | 'phone' | 'portal' | 'note'
  occurredOn: string
  summary: string
  documentId: string | null
  createdBy: string | null
  createdAt: string
}

export interface RegQueryRegisterRow extends RegQuery {
  productBrandName: string
  countryId: string
  countryName: string
  ownerName: string | null
}

export async function listRegQueries(dossierId: string): Promise<RegQuery[]> {
  const { data } = await get<RegQuery[]>(`/reg-dossiers/${dossierId}/queries`)
  return data
}

/**
 * CEO feedback, 30 Sep 2026 — the cross-dossier query register: "all
 * queries across products and markets, filterable by market, product,
 * owner and status, with overdue queries highlighted."
 */
export async function listRegQueryRegister(filters: {
  page?: number
  limit?: number
  productId?: string
  countryId?: string
  ownerUserId?: string
  status?: RegQueryStatus
  overdueOnly?: boolean
} = {}): Promise<{ data: RegQueryRegisterRow[]; meta?: PaginationMeta }> {
  return get<RegQueryRegisterRow[]>(
    '/reg-queries',
    filters as Record<string, string | number | boolean | string[] | undefined>,
  )
}

/** testing-correction-explanation.md §2.1 — the regulator's own query letter is now a mandatory upload, alongside the now-required `receivedDate`. CEO feedback, 30 Sep 2026 — `responseDueDate`/`ownerUserId` can optionally be set at the same time. */
export async function receiveRegQuery(
  dossierId: string,
  payload: { queryText: string; receivedDate: string; file: File; responseDueDate?: string; ownerUserId?: string },
): Promise<RegQuery> {
  const formData = new FormData()
  formData.append('queryText', payload.queryText)
  formData.append('receivedDate', payload.receivedDate)
  if (payload.responseDueDate) formData.append('responseDueDate', payload.responseDueDate)
  if (payload.ownerUserId) formData.append('ownerUserId', payload.ownerUserId)
  formData.append('file', payload.file)
  const { data } = await post<RegQuery>(`/reg-dossiers/${dossierId}/queries`, formData)
  return data
}

/** CEO feedback, 30 Sep 2026 — set/correct the regulator's own stated deadline at any point. */
export async function setRegQueryDueDate(dossierId: string, queryId: string, responseDueDate: string): Promise<RegQuery> {
  const { data } = await patch<RegQuery>(`/reg-dossiers/${dossierId}/queries/${queryId}/due-date`, { responseDueDate })
  return data
}

/** CEO feedback, 30 Sep 2026 — "assign each query to a named person, with the option to reassign." `ownerUserId: null` un-assigns. */
export async function assignRegQueryOwner(dossierId: string, queryId: string, ownerUserId: string | null): Promise<RegQuery> {
  const { data } = await patch<RegQuery>(`/reg-dossiers/${dossierId}/queries/${queryId}/owner`, { ownerUserId })
  return data
}

export async function listRegQueryCorrespondence(dossierId: string, queryId: string): Promise<RegQueryCorrespondence[]> {
  const { data } = await get<RegQueryCorrespondence[]>(`/reg-dossiers/${dossierId}/queries/${queryId}/correspondence`)
  return data
}

/** CEO feedback, 30 Sep 2026 — "every letter, email and document exchanged on a query kept in one thread." `file` is optional — a phone call/internal note has none. */
export async function addRegQueryCorrespondence(
  dossierId: string,
  queryId: string,
  payload: { direction: RegQueryCorrespondence['direction']; channel: RegQueryCorrespondence['channel']; occurredOn: string; summary: string; file?: File },
): Promise<RegQueryCorrespondence> {
  const formData = new FormData()
  formData.append('direction', payload.direction)
  formData.append('channel', payload.channel)
  formData.append('occurredOn', payload.occurredOn)
  formData.append('summary', payload.summary)
  if (payload.file) formData.append('file', payload.file)
  const { data } = await post<RegQueryCorrespondence>(`/reg-dossiers/${dossierId}/queries/${queryId}/correspondence`, formData)
  return data
}

/** testing-correction-explanation.md §2.1 — `note` and `respondedDate` are now always required; `file` stays optional only for the `client_handles_queries` engagement type. CEO feedback, 30 Sep 2026 — this now lands the query at "responded", not "closed"; see `closeRegQuery()` for the separate, later, deliberate closure step. */
export async function respondRegQuery(dossierId: string, queryId: string, note: string, respondedDate: string, file?: File): Promise<RegQuery> {
  const formData = new FormData()
  formData.append('note', note)
  formData.append('respondedDate', respondedDate)
  if (file) formData.append('file', file)
  const { data } = await post<RegQuery>(`/reg-dossiers/${dossierId}/queries/${queryId}/respond`, formData)
  return data
}

/** CEO feedback, 30 Sep 2026 — the register's own separate, deliberate "closed" state, reachable only once a response is on file. */
export async function closeRegQuery(dossierId: string, queryId: string, note?: string): Promise<RegQuery> {
  const { data } = await post<RegQuery>(`/reg-dossiers/${dossierId}/queries/${queryId}/close`, { note })
  return data
}

// ── Stage 7 — Lifecycle: Variations & Renewals ──────────────────────────

/** testing-correction-explanation.md §2.2 — Kenya's own real, confirmed 4-category variation taxonomy, plus `renewal`. */
export type RegVariationType = 'minor' | 'major' | 'immediate_notification' | 'yearly_notification' | 'renewal'

export const VARIATION_TYPE_LABELS: Record<RegVariationType, string> = {
  minor: 'Minor Variation',
  major: 'Major Variation',
  immediate_notification: 'Immediate Notification Variation',
  yearly_notification: 'Yearly Notification Variation',
  renewal: 'Renewal',
}

export interface RegVariation {
  id: string
  companyId: string
  productRegistrationId: string
  variationType: RegVariationType
  displayCode: string
  regDossierId: string
  paymentProofDocumentId: string | null
  invoiceDocumentId: string | null
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

/** testing-correction-explanation.md §2.2 — the company-wide "All Variations" list, across every registration. */
export async function listAllRegVariations(): Promise<
  (RegVariation & { productRegistration: { registrationNumber: string }; regDossier: { product: { brandName: string }; status: string } })[]
> {
  const { data } = await get<
    (RegVariation & { productRegistration: { registrationNumber: string }; regDossier: { product: { brandName: string }; status: string } })[]
  >('/reg-variations')
  return data
}

export async function getRegVariation(id: string): Promise<RegVariation & { regDossier: RegDossierDetail }> {
  const { data } = await get<RegVariation & { regDossier: RegDossierDetail }>(`/reg-variations/${id}`)
  return data
}

export async function createRegVariation(payload: {
  productRegistrationId: string
  variationType: RegVariationType
  productId?: string
  authorityId?: string
  productClass?: string
  route?: string
}): Promise<RegVariation & { regDossier: RegDossierDetail }> {
  const { data } = await post<RegVariation & { regDossier: RegDossierDetail }>('/reg-variations', payload)
  return data
}

/** testing-correction-explanation.md §2.2 — one of the two named documents required (alongside ≥1 accompanying-change document uploaded via the generic Documents panel) before a variation can leave Variation Application. */
export async function attachVariationPaymentProof(variationId: string, file: File): Promise<RegVariation> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await post<RegVariation>(`/reg-variations/${variationId}/payment-proof`, formData)
  return data
}

export async function attachVariationInvoice(variationId: string, file: File): Promise<RegVariation> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await post<RegVariation>(`/reg-variations/${variationId}/invoice`, formData)
  return data
}

export async function classifyRegistration(params: { authorityId: string; productClass: string; route?: string }): Promise<ClassificationPreview> {
  const { data } = await get<ClassificationPreview>('/reg-dossiers/classify', params)
  return data
}

// ── §3.3/§3.7 — Retention ────────────────────────────────────────────────

export interface RegRetention {
  id: string
  companyId: string
  productRegistrationId: string
  displayCode: string
  year: number
  invoiceDocumentId: string
  proofOfPaymentDocumentId: string
  certificateDocumentId: string | null
  status: 'pending' | 'certified'
  paidAt: string
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export async function listRegRetentions(productRegistrationId: string): Promise<RegRetention[]> {
  const { data } = await get<RegRetention[]>('/reg-retentions', { productRegistrationId })
  return data
}

/** The company-wide "All Retentions" list, across every registration. */
export async function listAllRegRetentions(): Promise<
  (RegRetention & { productRegistration: { registrationNumber: string; product: { brandName: string } } })[]
> {
  const { data } = await get<
    (RegRetention & { productRegistration: { registrationNumber: string; product: { brandName: string } } })[]
  >('/reg-retentions')
  return data
}

export async function getRegRetention(id: string): Promise<RegRetention> {
  const { data } = await get<RegRetention>(`/reg-retentions/${id}`)
  return data
}

export async function createRegRetention(payload: {
  productRegistrationId: string
  year: number
  paidAt: string
  invoice: File
  proofOfPayment: File
}): Promise<RegRetention> {
  const formData = new FormData()
  formData.append('productRegistrationId', payload.productRegistrationId)
  formData.append('year', String(payload.year))
  formData.append('paidAt', payload.paidAt)
  formData.append('invoice', payload.invoice)
  formData.append('proofOfPayment', payload.proofOfPayment)
  const { data } = await post<RegRetention>('/reg-retentions', formData)
  return data
}

export async function listRegDossiers(
  params: { productId?: string; clinicalTrialId?: string; relianceApplicationId?: string; page?: number; limit?: number } = {},
): Promise<RegDossierPage> {
  const { data, meta } = await get<RegDossierListRow[]>('/reg-dossiers', params)
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
