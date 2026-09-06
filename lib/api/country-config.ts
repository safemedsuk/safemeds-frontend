import { get, PaginationMeta, post } from './client'

export interface Country {
  id: string
  isoCode: string
  name: string
}

export interface ReportingRule {
  id: string
  authorityId: string
  reportTypeId: string
  seriousnessClass: string
  windowDays: number
  dayType: 'calendar' | 'business'
  clockStart: string
  unverified: boolean
  reportingPeriodDays: number | null
  /** "regulator" (default) or "ethics_committee_and_trial_portal" — plain string, extensible without a schema change. */
  submissionDestination: string
  /** Admin Configuration Console — a plain-text citation for where this number came from (e.g. "GUD/022 §6.1"). */
  sourceReference: string | null
  version: number
  status: 'draft' | 'active' | 'retired'
  effectiveFrom: string
}

export interface SeriousnessDefinition {
  id: string
  authorityId: string
  criterionKey: string
  label: string
  version: number
  status: 'draft' | 'active' | 'retired'
}

export interface FormSchemaField {
  key: string
  label: string
  type?: string
  required?: boolean
}

export interface FormSchemaSection {
  key: string
  label: string
  fields?: FormSchemaField[]
}

export interface FormSchema {
  id: string
  countryId: string | null
  reportTypeId: string
  version: number
  jsonSchema: { sections: FormSchemaSection[] }
  officialFormCode: string | null
  status: 'draft' | 'active' | 'retired'
}

export interface SubmissionFormat {
  id: string
  authorityId: string
  reportTypeId: string
  templateRef: string
  channel: 'vigiflow' | 'dhis2' | 'portal' | 'paper_pdf'
  version: number
  status: 'draft' | 'active' | 'retired'
}

export interface ConfigReportType {
  id: string
  typeKey: string
  name: string
  activeReportingRules: ReportingRule[]
  activeSeriousnessDefinitions: SeriousnessDefinition[]
  activeFormSchema: FormSchema | null
  activeSubmissionFormat: SubmissionFormat | null
}

export interface AuthorityConfigNode {
  id: string
  code: string
  name: string
  reportTypes: ConfigReportType[]
}

export async function getConfiguredCountries(): Promise<Country[]> {
  const { data } = await get<Country[]>('/countries', { configured: true, limit: 50 })
  return data
}

export async function getCountryConfig(countryId: string): Promise<AuthorityConfigNode[]> {
  const { data } = await get<AuthorityConfigNode[]>(`/countries/${countryId}/config`)
  return data
}

export interface ConfigPage<T> {
  rows: T[]
  meta: PaginationMeta
}

export interface ListConfigParams {
  authorityId?: string
  reportTypeId?: string
  countryId?: string
  page?: number
  limit?: number
}

function toQuery(params: ListConfigParams): Record<string, string | number | boolean | undefined> {
  return params as Record<string, string | number | boolean | undefined>
}

export async function createReportingRuleVersion(payload: {
  authorityId: string
  reportTypeId: string
  seriousnessClass: string
  windowDays: number
  dayType?: 'calendar' | 'business'
  clockStart?: string
  unverified?: boolean
  reportingPeriodDays?: number
  submissionDestination?: string
  sourceReference?: string
  effectiveFrom: string
}): Promise<ReportingRule> {
  const { data } = await post<ReportingRule>('/country-config/reporting-rules', payload)
  return data
}

export async function activateReportingRule(id: string): Promise<ReportingRule> {
  const { data } = await post<ReportingRule>(`/country-config/reporting-rules/${id}/activate`)
  return data
}

export async function listReportingRules(params: ListConfigParams = {}): Promise<ConfigPage<ReportingRule>> {
  const { data, meta } = await get<ReportingRule[]>('/country-config/reporting-rules', toQuery(params))
  return { rows: data, meta: meta! }
}

// ── Seriousness definitions ────────────────────────────────────────────────

export async function listSeriousnessDefinitions(params: ListConfigParams = {}): Promise<ConfigPage<SeriousnessDefinition>> {
  const { data, meta } = await get<SeriousnessDefinition[]>('/country-config/seriousness-definitions', toQuery(params))
  return { rows: data, meta: meta! }
}

export async function createSeriousnessDefinitionVersion(payload: {
  authorityId: string
  criterionKey: string
  label: string
  effectiveFrom: string
}): Promise<SeriousnessDefinition> {
  const { data } = await post<SeriousnessDefinition>('/country-config/seriousness-definitions', payload)
  return data
}

export async function activateSeriousnessDefinition(id: string): Promise<SeriousnessDefinition> {
  const { data } = await post<SeriousnessDefinition>(`/country-config/seriousness-definitions/${id}/activate`)
  return data
}

// ── Form schemas ────────────────────────────────────────────────────────────

export async function listFormSchemas(params: ListConfigParams = {}): Promise<ConfigPage<FormSchema>> {
  const { data, meta } = await get<FormSchema[]>('/country-config/form-schemas', toQuery(params))
  return { rows: data, meta: meta! }
}

export async function createFormSchemaVersion(payload: {
  countryId?: string
  reportTypeId: string
  jsonSchema: { sections: FormSchemaSection[] }
  officialFormCode?: string
  effectiveFrom: string
}): Promise<FormSchema> {
  const { data } = await post<FormSchema>('/country-config/form-schemas', payload)
  return data
}

export async function activateFormSchema(id: string): Promise<FormSchema> {
  const { data } = await post<FormSchema>(`/country-config/form-schemas/${id}/activate`)
  return data
}

// ── Submission formats ──────────────────────────────────────────────────────

export async function listSubmissionFormats(params: ListConfigParams = {}): Promise<ConfigPage<SubmissionFormat>> {
  const { data, meta } = await get<SubmissionFormat[]>('/country-config/submission-formats', toQuery(params))
  return { rows: data, meta: meta! }
}

export async function createSubmissionFormatVersion(payload: {
  authorityId: string
  reportTypeId: string
  templateRef: string
  channel: SubmissionFormat['channel']
  effectiveFrom: string
}): Promise<SubmissionFormat> {
  const { data } = await post<SubmissionFormat>('/country-config/submission-formats', payload)
  return data
}

export async function activateSubmissionFormat(id: string): Promise<SubmissionFormat> {
  const { data } = await post<SubmissionFormat>(`/country-config/submission-formats/${id}/activate`)
  return data
}
