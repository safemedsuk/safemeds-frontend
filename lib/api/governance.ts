import { API_BASE_URL, get, patch, post } from './client'

export type AuditRequirementSource = 'system_generated' | 'person_uploads'
export type AuditRequirementStatus = 'ready' | 'needs_update' | 'expiring' | 'missing'

export const AUDIT_REQUIREMENT_STATUS_LABELS: Record<AuditRequirementStatus, string> = {
  ready: 'Ready',
  needs_update: 'Needs Update',
  expiring: 'Expiring',
  missing: 'Missing',
}

export interface AuditRequirementRow {
  definitionId: string
  requirementKey: string
  sortOrder: number
  title: string
  description: string
  source: AuditRequirementSource
  evidenceArtifactType: string
  isMandatory: boolean
  status: AuditRequirementStatus
  statusNote: string | null
  evidenceDocumentId: string | null
  lastVerifiedAt: string | null
  nextDueAt: string | null
  checklistJson: unknown
}

export interface AuditReadinessDashboard {
  overall: 'green' | 'amber' | 'red'
  readyCount: number
  totalMandatory: number
  rows: AuditRequirementRow[]
  /** Stage 16.2-A — lets the UI explain an empty `rows` array honestly instead of rendering a silent blank table. */
  homeCountryName: string
  authorityConfigured: boolean
}

export async function getAuditReadinessDashboard(): Promise<AuditReadinessDashboard> {
  const { data } = await get<AuditReadinessDashboard>('/governance/audit-readiness')
  return data
}

export interface UpdateAuditRequirementInput {
  status?: AuditRequirementStatus
  documentId?: string
  note?: string
  checklistJson?: Record<string, unknown>
}

export async function updateAuditRequirement(definitionId: string, input: UpdateAuditRequirementInput): Promise<void> {
  await patch(`/governance/audit-readiness/${definitionId}`, input)
}

export interface AuditPack {
  id: string
  companyId: string
  snapshot: AuditReadinessDashboard
  pdfDocumentId: string
  generatedBy: string | null
  generatedAt: string
}

export async function generateAuditPack(): Promise<AuditPack> {
  const { data } = await post<AuditPack>('/governance/audit-packs', {})
  return data
}

export async function listAuditPacks(): Promise<AuditPack[]> {
  const { data } = await get<AuditPack[]>('/governance/audit-packs')
  return data
}

export async function getAuditPack(id: string): Promise<AuditPack> {
  const { data } = await get<AuditPack>(`/governance/audit-packs/${id}`)
  return data
}

/** A raw CSV download, not the usual `{ data }` JSON envelope — fetched directly rather than through the shared `get()` helper. */
export function getAeLogExportUrl(): string {
  return `${API_BASE_URL}/governance/ae-log/export`
}

// ── Admin Configuration Console — Gap 3: the shared requirement-definition
// catalog itself (title/description/guideline reference/etc.), distinct
// from the per-company evidence rows above. Platform-gated
// (`platform.config.manage`) since a definition edit affects every
// company under that authority at once.

export interface RequirementDefinition {
  id: string
  authorityId: string
  requirementKey: string
  sortOrder: number
  title: string
  description: string
  guidelineReference: string | null
  source: AuditRequirementSource
  evidenceArtifactType: string
  isMandatory: boolean
  active: boolean
  createdAt: string
}

export async function listRequirementDefinitions(authorityId?: string): Promise<RequirementDefinition[]> {
  const { data } = await get<RequirementDefinition[]>('/governance/requirement-definitions', authorityId ? { authorityId } : undefined)
  return data
}

export interface CreateRequirementDefinitionInput {
  authorityId: string
  requirementKey: string
  sortOrder: number
  title: string
  description: string
  guidelineReference?: string
  evidenceArtifactType: string
  isMandatory?: boolean
}

/** Only ever creates a `person_uploads` row — see the backend DTO's own doc comment for why `system_generated` isn't creatable here. */
export async function createRequirementDefinition(input: CreateRequirementDefinitionInput): Promise<RequirementDefinition> {
  const { data } = await post<RequirementDefinition>('/governance/requirement-definitions', { ...input, source: 'person_uploads' })
  return data
}

export interface UpdateRequirementDefinitionInput {
  sortOrder?: number
  title?: string
  description?: string
  /** Pass an empty string to clear it back to null. */
  guidelineReference?: string
  evidenceArtifactType?: string
  isMandatory?: boolean
  active?: boolean
}

export async function updateRequirementDefinition(id: string, input: UpdateRequirementDefinitionInput): Promise<RequirementDefinition> {
  const { data } = await patch<RequirementDefinition>(`/governance/requirement-definitions/${id}`, input)
  return data
}
