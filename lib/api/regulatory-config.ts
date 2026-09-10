import { get, PaginationMeta, post } from './client'

/**
 * RegCloud (Phase 12) Stage 0.1 — the country rule-set graph's admin
 * client, a direct structural mirror of `lib/api/country-config.ts`
 * (same version-on-write shape: `create*Version` inserts a new draft,
 * `activate*` retires whatever was active before it). Every write here is
 * `platform.config.manage` — see `RegConfigController`'s own doc comment
 * for why no new permission was introduced for this.
 */

export interface RequiredDocumentDefinition {
  id: string
  documentKey: string
  name: string
  ctdModule: string | null
  isMandatory: boolean
  sourceReference: string | null
  sortOrder: number
}

export interface RegulatoryRequirement {
  id: string
  countryId: string
  authorityId: string
  productClass: string
  route: string
  standardTimelineDays: number | null
  description: string | null
  unverified: boolean
  sourceReference: string | null
  version: number
  status: 'draft' | 'active' | 'retired'
  effectiveFrom: string
  documentDefinitions: RequiredDocumentDefinition[]
}

export interface RegulatoryFeeSchedule {
  id: string
  countryId: string
  authorityId: string
  productClass: string
  route: string
  feeType: string
  amount: string
  currency: string
  unverified: boolean
  sourceReference: string | null
  version: number
  status: 'draft' | 'active' | 'retired'
  effectiveFrom: string
}

export interface RegDeadlineRule {
  id: string
  countryId: string
  authorityId: string
  productClass: string
  obligationType: string
  intervalValue: number
  intervalUnit: 'days' | 'months' | 'years'
  clockStart: string
  unverified: boolean
  sourceReference: string | null
  version: number
  status: 'draft' | 'active' | 'retired'
  effectiveFrom: string
}

export interface RegConfigPage<T> {
  rows: T[]
  meta: PaginationMeta
}

export interface ListRegConfigParams {
  countryId?: string
  authorityId?: string
  productClass?: string
  page?: number
  limit?: number
}

function toQuery(params: ListRegConfigParams): Record<string, string | number | boolean | undefined> {
  return params as Record<string, string | number | boolean | undefined>
}

// ── Regulatory requirements (+ document checklist) ─────────────────────────

export async function listRegulatoryRequirements(params: ListRegConfigParams = {}): Promise<RegConfigPage<RegulatoryRequirement>> {
  const { data, meta } = await get<RegulatoryRequirement[]>('/regulatory-config/requirements', toQuery(params))
  return { rows: data, meta: meta! }
}

export async function createRegulatoryRequirementVersion(payload: {
  countryId: string
  authorityId: string
  productClass: string
  route?: string
  standardTimelineDays?: number
  description?: string
  unverified?: boolean
  sourceReference?: string
  effectiveFrom: string
  documentDefinitions?: { documentKey: string; name: string; ctdModule?: string; isMandatory?: boolean; sourceReference?: string; sortOrder?: number }[]
}): Promise<RegulatoryRequirement> {
  const { data } = await post<RegulatoryRequirement>('/regulatory-config/requirements', payload)
  return data
}

export async function activateRegulatoryRequirement(id: string): Promise<RegulatoryRequirement> {
  const { data } = await post<RegulatoryRequirement>(`/regulatory-config/requirements/${id}/activate`)
  return data
}

// ── Fee schedules ────────────────────────────────────────────────────────

export async function listRegulatoryFeeSchedules(params: ListRegConfigParams = {}): Promise<RegConfigPage<RegulatoryFeeSchedule>> {
  const { data, meta } = await get<RegulatoryFeeSchedule[]>('/regulatory-config/fee-schedules', toQuery(params))
  return { rows: data, meta: meta! }
}

export async function createRegulatoryFeeScheduleVersion(payload: {
  countryId: string
  authorityId: string
  productClass: string
  route?: string
  feeType: string
  amount: string
  currency?: string
  unverified?: boolean
  sourceReference?: string
  effectiveFrom: string
}): Promise<RegulatoryFeeSchedule> {
  const { data } = await post<RegulatoryFeeSchedule>('/regulatory-config/fee-schedules', payload)
  return data
}

export async function activateRegulatoryFeeSchedule(id: string): Promise<RegulatoryFeeSchedule> {
  const { data } = await post<RegulatoryFeeSchedule>(`/regulatory-config/fee-schedules/${id}/activate`)
  return data
}

// ── Deadline rules ───────────────────────────────────────────────────────

export async function listRegDeadlineRules(params: ListRegConfigParams = {}): Promise<RegConfigPage<RegDeadlineRule>> {
  const { data, meta } = await get<RegDeadlineRule[]>('/regulatory-config/deadline-rules', toQuery(params))
  return { rows: data, meta: meta! }
}

export async function createRegDeadlineRuleVersion(payload: {
  countryId: string
  authorityId: string
  productClass?: string
  obligationType: string
  intervalValue: number
  intervalUnit: 'days' | 'months' | 'years'
  clockStart?: string
  unverified?: boolean
  sourceReference?: string
  effectiveFrom: string
}): Promise<RegDeadlineRule> {
  const { data } = await post<RegDeadlineRule>('/regulatory-config/deadline-rules', payload)
  return data
}

export async function activateRegDeadlineRule(id: string): Promise<RegDeadlineRule> {
  const { data } = await post<RegDeadlineRule>(`/regulatory-config/deadline-rules/${id}/activate`)
  return data
}
