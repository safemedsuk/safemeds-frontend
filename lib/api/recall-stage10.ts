import { get, patch, post } from './client'

/**
 * QualCloud (Phase 13) Stage 10.1–10.5 — the recall country rules
 * engine, case scope/risk, distribution/cascade/traceability, the
 * external stakeholder portal, and returns/quarantine/reconciliation/
 * destruction/effectiveness. One file, matching `lib/api/recalls.ts`'s
 * own precedent of grouping a whole cross-cutting stage in one client.
 */

// ── 10.1 — Recall rule-sets (platform admin) ────────────────────────

export interface RecallRule {
  id: string
  ruleSetId: string
  code: string
  requirementText: string
  appliesWhenClass: string | null
  appliesWhenLevel: string | null
  appliesWhenType: string | null
  anchorEvent: string
  offset: number
  unit: string
  dayBasis: string
  ownerRoleKey: string
  evidenceTypes: string[]
  approvalRequired: boolean
  blocksClosure: boolean
  submissionTemplateId: string | null
  sourceDoc: string
  sourceInstrument: string | null
  sourceSection: string | null
  sourceUrl: string | null
  unverified: boolean
}

export interface RecallSubmissionTemplate {
  id: string
  ruleSetId: string
  code: string
  name: string
  format: string
}

export interface RecallRuleSet {
  id: string
  countryId: string
  regulatoryAuthorityId: string
  version: number
  status: 'draft' | 'pending_source' | 'live' | 'retired'
  signedOffBy: string | null
  signedOffAt: string | null
  effectiveDate: string | null
  nextReviewAt: string | null
  rules: RecallRule[]
  submissionTemplates: RecallSubmissionTemplate[]
}

export async function listRecallRuleSets(countryId?: string): Promise<RecallRuleSet[]> {
  const { data } = await get<RecallRuleSet[]>('/recall-rule-sets', countryId ? { countryId } : undefined)
  return data
}

export async function getRecallRuleSet(id: string): Promise<RecallRuleSet> {
  const { data } = await get<RecallRuleSet>(`/recall-rule-sets/${id}`)
  return data
}

export async function createRecallRuleSet(payload: { countryId: string; regulatoryAuthorityId: string }): Promise<RecallRuleSet> {
  const { data } = await post<RecallRuleSet>('/recall-rule-sets', payload)
  return data
}

export async function addRecallRule(ruleSetId: string, payload: Partial<RecallRule> & { code: string; requirementText: string; anchorEvent: string; offset: number; ownerRoleKey: string; sourceDoc: string }): Promise<RecallRule> {
  const { data } = await post<RecallRule>(`/recall-rule-sets/${ruleSetId}/rules`, payload)
  return data
}

export async function addRecallSubmissionTemplate(ruleSetId: string, payload: { code: string; name: string; format?: string }): Promise<RecallSubmissionTemplate> {
  const { data } = await post<RecallSubmissionTemplate>(`/recall-rule-sets/${ruleSetId}/submission-templates`, payload)
  return data
}

export async function signOffRecallRuleSet(ruleSetId: string): Promise<RecallRuleSet> {
  const { data } = await post<RecallRuleSet>(`/recall-rule-sets/${ruleSetId}/sign-off`)
  return data
}

// ── 10.2 — Countries, requirements, scope ────────────────────────────

export interface RecallCountry {
  id: string
  recallId: string
  countryId: string
  regulatoryAuthorityId: string | null
  ruleSetId: string | null
  ruleSetVersion: number | null
  status: string
  class: string | null
  level: string | null
  regulatorDecision: string | null
  regulatorApprovalAt: string | null
}

export const RECALL_COUNTRY_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  notified: 'Notified',
  in_progress: 'In Progress',
  reporting: 'Reporting',
  closure_submitted: 'Closure Submitted',
  closed_by_regulator: 'Closed by Regulator',
}

export interface RecallRequirement {
  id: string
  recallCountryId: string
  recallRuleId: string
  ruleVersion: number
  dueAt: string | null
  ownerRoleKey: string
  status: string
  evidenceIds: string[]
  completedAt: string | null
}

export async function listRecallCountries(recallId: string): Promise<RecallCountry[]> {
  const { data } = await get<RecallCountry[]>(`/recalls/${recallId}/countries`)
  return data
}

export async function addRecallCountry(recallId: string, payload: { countryId: string; regulatoryAuthorityId?: string }): Promise<RecallCountry> {
  const { data } = await post<RecallCountry>(`/recalls/${recallId}/countries`, payload)
  return data
}

export async function listRecallRequirements(recallCountryId: string): Promise<RecallRequirement[]> {
  const { data } = await get<RecallRequirement[]>(`/recall-countries/${recallCountryId}/requirements`)
  return data
}

export async function updateRecallRequirement(id: string, payload: { status?: string; evidenceIds?: string[] }): Promise<RecallRequirement> {
  const { data } = await patch<RecallRequirement>(`/recall-requirements/${id}`, payload)
  return data
}

export interface RecallScopeItem {
  id: string
  productId: string
  batchId: string
  batchSize: number | null
  quantityDistributed: number | null
  quantityHeldByMah: number | null
}

export interface RecallScopeVersion {
  id: string
  recallId: string
  version: number
  status: 'draft' | 'frozen' | 'superseded'
  approvedBy: string | null
  approvedAt: string | null
  reason: string | null
  items: RecallScopeItem[]
}

export async function listRecallScopeVersions(recallId: string): Promise<RecallScopeVersion[]> {
  const { data } = await get<RecallScopeVersion[]>(`/recalls/${recallId}/scope-versions`)
  return data
}

export async function createRecallScopeVersion(
  recallId: string,
  payload: { reason?: string; items: { productId: string; batchId: string; batchSize?: number; quantityDistributed?: number; quantityHeldByMah?: number }[] },
): Promise<RecallScopeVersion> {
  const { data } = await post<RecallScopeVersion>(`/recalls/${recallId}/scope-versions`, payload)
  return data
}

export async function freezeRecallScopeVersion(id: string): Promise<RecallScopeVersion> {
  const { data } = await post<RecallScopeVersion>(`/recall-scope-versions/${id}/freeze`)
  return data
}

// ── 10.3 — Stakeholders, distribution, cascade, sightings ────────────

export interface Stakeholder {
  id: string
  orgName: string
  type: string
  country: string | null
  licenceNo: string | null
  licenceStatus: string | null
  parentId: string | null
  contactName: string | null
  contactPhone: string | null
  contactEmail: string | null
  contactWhatsapp: string | null
  isActive: boolean
}

export const STAKEHOLDER_TYPE_LABELS: Record<string, string> = {
  distributor: 'Distributor',
  wholesaler: 'Wholesaler',
  pharmacy: 'Pharmacy',
  hospital: 'Hospital',
  clinic: 'Clinic',
  other: 'Other',
}

export async function listStakeholders(params: { q?: string; page?: number; limit?: number } = {}): Promise<{ rows: Stakeholder[] }> {
  const { data } = await get<Stakeholder[]>('/stakeholders', params as Record<string, string | number | undefined>)
  return { rows: data }
}

export async function createStakeholder(payload: Partial<Stakeholder> & { orgName: string; type: string }): Promise<Stakeholder> {
  const { data } = await post<Stakeholder>('/stakeholders', payload)
  return data
}

export interface RecallDistributionRecord {
  id: string
  recallId: string
  batchId: string
  fromOrgId: string | null
  toOrgId: string
  qtyPacks: number | null
  qtyUnits: number
  date: string
  source: string
  sourceRef: string | null
  warning?: string | null
}

export async function listRecallDistributionRecords(recallId: string): Promise<RecallDistributionRecord[]> {
  const { data } = await get<RecallDistributionRecord[]>(`/recalls/${recallId}/distribution-records`)
  return data
}

export async function createRecallDistributionRecord(
  recallId: string,
  payload: { batchId: string; fromOrgId?: string; toOrgId: string; qtyPacks?: number; qtyUnits: number; date: string; sourceRef?: string },
): Promise<RecallDistributionRecord> {
  const { data } = await post<RecallDistributionRecord>(`/recalls/${recallId}/distribution-records`, payload)
  return data
}

export interface RecallImportJob {
  id: string
  rows: number
  validRows: number
  errorRows: number
  status: string
  errors: { row: number; message: string }[] | null
}

export async function importRecallDistributionCsv(recallId: string, csv: string): Promise<RecallImportJob> {
  const { data } = await post<RecallImportJob>(`/recalls/${recallId}/distribution-records/import`, { csv })
  return data
}

export interface RecallCascadeInvite {
  id: string
  stakeholderId: string
  invitedAt: string
  status: string
}

export async function listRecallCascadeInvites(recallId: string): Promise<RecallCascadeInvite[]> {
  const { data } = await get<RecallCascadeInvite[]>(`/recalls/${recallId}/cascade-invites`)
  return data
}

export async function inviteStakeholderToCascade(recallId: string, stakeholderId: string): Promise<RecallCascadeInvite> {
  const { data } = await post<RecallCascadeInvite>(`/recalls/${recallId}/cascade-invites/${stakeholderId}`)
  return data
}

export interface RecallSighting {
  id: string
  country: string
  source: string
  reviewed: boolean
  decision: string | null
}

export async function listRecallSightings(recallId: string): Promise<RecallSighting[]> {
  const { data } = await get<RecallSighting[]>(`/recalls/${recallId}/sightings`)
  return data
}

export async function createRecallSighting(recallId: string, payload: { country: string; source: string; evidenceDocumentId?: string }): Promise<RecallSighting> {
  const { data } = await post<RecallSighting>(`/recalls/${recallId}/sightings`, payload)
  return data
}

export async function reviewRecallSighting(id: string, payload: { decision: 'notify_regulator' | 'no_action'; countryId?: string; regulatoryAuthorityId?: string }): Promise<RecallSighting> {
  const { data } = await post<RecallSighting>(`/recall-sightings/${id}/review`, payload)
  return data
}

// ── 10.4 — Portal links & messages ───────────────────────────────────

export interface RecallPortalLink {
  id: string
  stakeholderId: string
  stakeholder: { orgName: string }
  expiresAt: string
  revoked: boolean
  language: string
}

export async function listRecallPortalLinks(recallId: string): Promise<RecallPortalLink[]> {
  const { data } = await get<RecallPortalLink[]>(`/recalls/${recallId}/portal-links`)
  return data
}

export async function createRecallPortalLink(recallId: string, payload: { stakeholderId: string; language?: string; expiresInDays?: number }): Promise<{ link: { id: string; expiresAt: string }; token: string }> {
  const { data } = await post<{ link: { id: string; expiresAt: string }; token: string }>(`/recalls/${recallId}/portal-links`, payload)
  return data
}

export async function revokeRecallPortalLink(id: string): Promise<RecallPortalLink> {
  const { data } = await post<RecallPortalLink>(`/recall-portal-links/${id}/revoke`)
  return data
}

export interface RecallMessage {
  id: string
  stakeholderId: string
  channel: string
  body: string
  status: string
  sentAt: string | null
  isDrill: boolean
}

export async function listRecallMessages(recallId: string): Promise<RecallMessage[]> {
  const { data } = await get<RecallMessage[]>(`/recalls/${recallId}/messages`)
  return data
}

export async function sendRecallMessage(recallId: string, payload: { stakeholderId: string; channel: 'whatsapp' | 'sms' | 'email'; body: string; templateId?: string }): Promise<RecallMessage> {
  const { data } = await post<RecallMessage>(`/recalls/${recallId}/messages`, payload)
  return data
}

// ── 10.5 — Quarantine, returns, reconciliation, destruction ──────────

export interface RecallQuarantineRecord {
  id: string
  stakeholderId: string | null
  batchId: string
  fullPacks: number
  partPacks: { unitsRemaining: number; unitsPerPack: number }[] | null
}

export async function listRecallQuarantineRecords(recallId: string): Promise<RecallQuarantineRecord[]> {
  const { data } = await get<RecallQuarantineRecord[]>(`/recalls/${recallId}/quarantine-records`)
  return data
}

export async function recordRecallQuarantine(
  recallId: string,
  payload: { batchId: string; stakeholderId?: string; fullPacks?: number; partPacks?: { unitsRemaining: number; unitsPerPack: number }[] },
): Promise<RecallQuarantineRecord> {
  const { data } = await post<RecallQuarantineRecord>(`/recalls/${recallId}/quarantine-records`, payload)
  return data
}

export interface RecallReturnRecord {
  id: string
  ref: string
  fromOrgId: string | null
  batchId: string | null
  qty: number
  verdict: string | null
  verdictNote: string | null
  creditStatus: string
}

export const RECALL_RETURN_VERDICT_LABELS: Record<string, string> = {
  genuine: 'Genuine',
  suspect: 'Suspect',
  mismatched_batch: 'Mismatched Batch',
  expired: 'Expired',
}

export async function listRecallReturnRecords(recallId: string): Promise<RecallReturnRecord[]> {
  const { data } = await get<RecallReturnRecord[]>(`/recalls/${recallId}/return-records`)
  return data
}

export async function createRecallReturnRecord(recallId: string, payload: { fromOrgId?: string; batchId?: string; qty: number }): Promise<RecallReturnRecord> {
  const { data } = await post<RecallReturnRecord>(`/recalls/${recallId}/return-records`, payload)
  return data
}

export async function verifyRecallReturnRecord(recallId: string, id: string, payload: { verdict: string; verdictNote?: string }): Promise<RecallReturnRecord> {
  const { data } = await post<RecallReturnRecord>(`/recalls/${recallId}/return-records/${id}/verify`, payload)
  return data
}

export interface RecallReconciliationSnapshot {
  id: string
  distributed: number
  recovered: number
  quarantined: number
  dispensed: number
  other: number
  accounted: number
  outstanding: number
  destroyed: number
  heldByMah: number
  calculatedAt: string
}

export async function calculateRecallReconciliation(recallCountryId: string): Promise<RecallReconciliationSnapshot> {
  const { data } = await post<RecallReconciliationSnapshot>(`/recall-countries/${recallCountryId}/reconciliation`)
  return data
}

export async function listRecallReconciliationSnapshots(recallCountryId: string): Promise<RecallReconciliationSnapshot[]> {
  const { data } = await get<RecallReconciliationSnapshot[]>(`/recall-countries/${recallCountryId}/reconciliation`)
  return data
}

export interface RecallDiscrepancy {
  id: string
  recallCountryId: string | null
  units: number
  reason: string
  blocking: boolean
  status: string
  exceptionApprovalNote: string | null
}

export async function listRecallDiscrepancies(recallId: string): Promise<RecallDiscrepancy[]> {
  const { data } = await get<RecallDiscrepancy[]>(`/recalls/${recallId}/discrepancies`)
  return data
}

export async function createRecallDiscrepancy(recallId: string, payload: { recallCountryId?: string; units: number; reason: string }): Promise<RecallDiscrepancy> {
  const { data } = await post<RecallDiscrepancy>(`/recalls/${recallId}/discrepancies`, payload)
  return data
}

export async function approveRecallDiscrepancyException(id: string, note: string): Promise<RecallDiscrepancy> {
  const { data } = await post<RecallDiscrepancy>(`/recall-discrepancies/${id}/approve-exception`, { note })
  return data
}

export interface RecallDestructionRecord {
  id: string
  units: number
  disposalApprovalEvidenceId: string | null
  status: string
  destroyedAt: string | null
  certificateEvidenceId: string | null
}

export async function listRecallDestructionRecords(recallCountryId: string): Promise<RecallDestructionRecord[]> {
  const { data } = await get<RecallDestructionRecord[]>(`/recall-countries/${recallCountryId}/destruction-records`)
  return data
}

export async function createRecallDestructionRecord(recallCountryId: string, payload: { units: number; disposalApprovalEvidenceId?: string }): Promise<RecallDestructionRecord> {
  const { data } = await post<RecallDestructionRecord>(`/recall-countries/${recallCountryId}/destruction-records`, payload)
  return data
}

export async function attachRecallDisposalApproval(id: string, disposalApprovalEvidenceId: string): Promise<RecallDestructionRecord> {
  const { data } = await post<RecallDestructionRecord>(`/recall-destruction-records/${id}/disposal-approval`, { disposalApprovalEvidenceId })
  return data
}

export async function markRecallDestroyed(id: string): Promise<RecallDestructionRecord> {
  const { data } = await post<RecallDestructionRecord>(`/recall-destruction-records/${id}/mark-destroyed`)
  return data
}

export async function completeRecallDestruction(id: string, certificateEvidenceId: string): Promise<RecallDestructionRecord> {
  const { data } = await post<RecallDestructionRecord>(`/recall-destruction-records/${id}/certificate`, { certificateEvidenceId })
  return data
}

export interface RecallEffectivenessCheck {
  id: string
  method: string
  sampleSize: number
  clear: number
  stockFound: number
  status: string
  performedAt: string | null
}

export async function listRecallEffectivenessChecks(recallCountryId: string): Promise<RecallEffectivenessCheck[]> {
  const { data } = await get<RecallEffectivenessCheck[]>(`/recall-countries/${recallCountryId}/effectiveness-checks`)
  return data
}

export async function createRecallEffectivenessCheck(
  recallCountryId: string,
  payload: { method: string; sampleSize: number; clear: number; stockFound: number },
): Promise<RecallEffectivenessCheck> {
  const { data } = await post<RecallEffectivenessCheck>(`/recall-countries/${recallCountryId}/effectiveness-checks`, payload)
  return data
}

export async function closeRecallEffectivenessCheck(id: string): Promise<RecallEffectivenessCheck> {
  const { data } = await post<RecallEffectivenessCheck>(`/recall-effectiveness-checks/${id}/close`)
  return data
}

// ── 10.6 — Closure gate, compliance pack, evidence, investigation CAPA ──

export interface RecallClosureGateResult {
  allClear: boolean
  gates: { gate: number; name: string; passed: boolean; reason: string | null }[]
}

export async function checkRecallClosureReadiness(recallId: string): Promise<RecallClosureGateResult> {
  const { data } = await get<RecallClosureGateResult>(`/recalls/${recallId}/closure-readiness`)
  return data
}

export async function openRecallInvestigationCapa(
  recallId: string,
  payload: { title: string; correctiveAction: string; preventiveAction?: string; rootCauseCategory?: string },
): Promise<{ id: string; title: string; status: string }> {
  const { data } = await post<{ id: string; title: string; status: string }>(
    `/recalls/${recallId}/investigation-capa`,
    payload,
  )
  return data
}

export interface RecallEvidenceRow {
  documentId: string
  title: string
  linkedTo: string
  filename: string | null
  sha256: string | null
  uploadedAt: string | null
}

export async function listRecallEvidence(recallId: string): Promise<RecallEvidenceRow[]> {
  const { data } = await get<RecallEvidenceRow[]>(`/recalls/${recallId}/evidence`)
  return data
}

export interface RecallCompliancePack {
  id: string
  title: string
  status: string
  createdAt: string
}

export async function listRecallCompliancePacks(recallId: string): Promise<RecallCompliancePack[]> {
  const { data } = await get<RecallCompliancePack[]>(`/recalls/${recallId}/compliance-pack`)
  return data
}

export async function generateRecallCompliancePack(recallId: string): Promise<RecallCompliancePack> {
  const { data } = await post<RecallCompliancePack>(`/recalls/${recallId}/compliance-pack`)
  return data
}

// ── 10.7 — Mock recalls ──────────────────────────────────────────────

export interface MockRecallReadiness {
  recallId: string
  ref: string | null
  acknowledgedWithin24hPercent: number
  medianTimeToAcknowledgeHours: number | null
  stockTracedPercent: number
  downstreamListsReceivedCount: number
  gaps: string[]
  totalStakeholdersNotified: number
}

export async function computeMockRecallReadiness(recallId: string): Promise<MockRecallReadiness> {
  const { data } = await get<MockRecallReadiness>(`/recalls/${recallId}/mock-readiness`)
  return data
}

export async function exportMockRecallReadiness(recallId: string): Promise<{ id: string }> {
  const { data } = await post<{ id: string }>(`/recalls/${recallId}/mock-readiness/export`)
  return data
}
