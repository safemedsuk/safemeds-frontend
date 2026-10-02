import { post } from './client'

/**
 * testing-correction-explanation.md §4.1 — a dedicated pair of endpoints
 * for the Regulatory Entities bulk import (Manufacturers, Manufacturing
 * Sites, Local Representatives), separate from the generic single-file
 * `/bulk-import/:importType/...` framework (`lib/api/bulk-import.ts`) —
 * this one spans up to 3 files with a real cross-file relational link
 * (a site's `manufacturerKey` resolves against the manufacturers file
 * uploaded in the same request, or an existing manufacturer by name).
 */

export interface RegEntitiesImporterColumn {
  key: string
  label: string
  required: boolean
}

export interface RegEntitiesPreviewRowResult {
  rowNumber: number
  data: Record<string, string>
  errors: string[]
}

export interface RegEntitiesFilePreview {
  columns: RegEntitiesImporterColumn[]
  totalRows: number
  validRows: RegEntitiesPreviewRowResult[]
  invalidRows: RegEntitiesPreviewRowResult[]
}

export interface RegEntitiesImportPreview {
  manufacturers: RegEntitiesFilePreview
  sites: RegEntitiesFilePreview
  localRepresentatives: RegEntitiesFilePreview
}

export interface RegEntitiesCommitRowResult {
  rowNumber: number
  success: boolean
  error?: string
}

export interface RegEntitiesFileCommitResult {
  committed: number
  failed: RegEntitiesCommitRowResult[]
}

export interface RegEntitiesImportCommitResult {
  manufacturers: RegEntitiesFileCommitResult
  sites: RegEntitiesFileCommitResult
  localRepresentatives: RegEntitiesFileCommitResult
}

export async function previewRegEntitiesImport(payload: {
  manufacturersCsv?: string
  sitesCsv?: string
  localRepresentativesCsv?: string
}): Promise<RegEntitiesImportPreview> {
  const { data } = await post<RegEntitiesImportPreview>('/reg-entities-import/preview', payload)
  return data
}

export async function commitRegEntitiesImport(payload: {
  manufacturers?: Record<string, string>[]
  sites?: Record<string, string>[]
  localRepresentatives?: Record<string, string>[]
}): Promise<RegEntitiesImportCommitResult> {
  const { data } = await post<RegEntitiesImportCommitResult>('/reg-entities-import/commit', payload)
  return data
}
