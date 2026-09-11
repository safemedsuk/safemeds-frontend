import { get, post, del } from './client'
import { GeneratedReport } from './reports'

export type ReportBuilderDataSourceKey = 'pv_case' | 'reg_dossier'
export type ReportBuilderFieldKind = 'string' | 'date' | 'number'
export type ReportBuilderFilterOperator = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains'

export interface ReportBuilderFieldMeta {
  key: string
  label: string
  kind: ReportBuilderFieldKind
}

export interface ReportBuilderDataSourceMeta {
  key: ReportBuilderDataSourceKey
  label: string
  fields: ReportBuilderFieldMeta[]
}

export interface ReportBuilderFilter {
  field: string
  operator: ReportBuilderFilterOperator
  value: string
}

export interface ReportBuilderQuery {
  dataSource: ReportBuilderDataSourceKey
  fields: string[]
  filters?: ReportBuilderFilter[]
  groupByField?: string
}

export interface ReportBuilderResult {
  fields: { key: string; label: string }[]
  rows: Record<string, unknown>[] | null
  groups: { value: unknown; count: number }[] | null
  totalMatched: number
  truncated: boolean
}

export interface ReportDefinition extends ReportBuilderQuery {
  id: string
  companyId: string
  name: string
  scheduleCadenceDays: number | null
  lastRunAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export async function listReportBuilderDataSources(): Promise<ReportBuilderDataSourceMeta[]> {
  const { data } = await get<ReportBuilderDataSourceMeta[]>('/report-builder/data-sources')
  return data
}

export async function previewReportBuilderQuery(query: ReportBuilderQuery): Promise<ReportBuilderResult> {
  const { data } = await post<ReportBuilderResult>('/report-builder/preview', query)
  return data
}

export interface SaveReportDefinitionInput extends ReportBuilderQuery {
  name: string
  scheduleCadenceDays?: number
}

export async function saveReportDefinition(input: SaveReportDefinitionInput): Promise<ReportDefinition> {
  const { data } = await post<ReportDefinition>('/report-builder/definitions', input)
  return data
}

export async function listReportDefinitions(): Promise<ReportDefinition[]> {
  const { data } = await get<ReportDefinition[]>('/report-builder/definitions')
  return data
}

export async function getReportDefinition(id: string): Promise<ReportDefinition> {
  const { data } = await get<ReportDefinition>(`/report-builder/definitions/${id}`)
  return data
}

export async function deleteReportDefinition(id: string): Promise<void> {
  await del(`/report-builder/definitions/${id}`)
}

export async function exportReportDefinition(id: string): Promise<GeneratedReport> {
  const { data } = await post<GeneratedReport>(`/report-builder/definitions/${id}/export`)
  return data
}
