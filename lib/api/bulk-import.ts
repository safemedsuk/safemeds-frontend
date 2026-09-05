import { post } from './client'

export interface ImporterColumn {
  key: string
  label: string
  required: boolean
}

export interface PreviewRowResult {
  rowNumber: number
  data: Record<string, string>
  errors: string[]
}

export interface PreviewResult {
  importType: string
  columns: ImporterColumn[]
  totalRows: number
  validRows: PreviewRowResult[]
  invalidRows: PreviewRowResult[]
}

export interface CommitRowResult {
  rowNumber: number
  success: boolean
  error?: string
}

export interface CommitResult {
  importType: string
  committed: number
  failed: CommitRowResult[]
}

export async function previewBulkImport(importType: string, csvText: string): Promise<PreviewResult> {
  const { data } = await post<PreviewResult>(`/bulk-import/${importType}/preview`, { csvText })
  return data
}

export async function commitBulkImport(importType: string, rows: Record<string, string>[]): Promise<CommitResult> {
  const { data } = await post<CommitResult>(`/bulk-import/${importType}/commit`, { rows })
  return data
}
