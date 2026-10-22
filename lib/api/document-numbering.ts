import { get, put } from './client'

/** Phase 2 Pass C — per-company document numbering scheme. */

export const NUMBERING_TOKEN_LABELS: Record<NumberingToken, string> = {
  company: 'Company initials',
  type: 'Document type initials',
  year: 'Year (YYYY)',
  sequence: 'Sequence (0001)',
}

export type NumberingToken = 'company' | 'type' | 'year' | 'sequence'
export const NUMBERING_SEPARATORS = ['-', '/', '.', '_'] as const
export type NumberingSeparator = (typeof NUMBERING_SEPARATORS)[number]

export interface NumberingTypeConfig {
  documentType: string
  label: string
  initials: string
  initialsIsDefault: boolean
  ownScheme: boolean
  tokenOrder: NumberingToken[]
  separator: NumberingSeparator
  nextNumber: string
}

export interface DocumentNumberingConfig {
  companyInitials: string
  companyInitialsIsDefault: boolean
  tokenOrder: NumberingToken[]
  separator: NumberingSeparator
  types: NumberingTypeConfig[]
  yearOfPreview: number
}

export interface SaveDocumentNumberingInput {
  companyInitials: string
  tokenOrder: NumberingToken[]
  separator: NumberingSeparator
  types: { documentType: string; initials: string | null; tokenOrder: NumberingToken[] | null; separator: NumberingSeparator | null }[]
}

export async function getDocumentNumbering(): Promise<DocumentNumberingConfig> {
  const { data } = await get<DocumentNumberingConfig>('/quality/config/document-numbering')
  return data
}

export async function saveDocumentNumbering(input: SaveDocumentNumberingInput): Promise<DocumentNumberingConfig> {
  const { data } = await put<DocumentNumberingConfig>('/quality/config/document-numbering', input)
  return data
}

/** Formats a number locally for the live preview (mirrors the backend's buildDocumentNumber). */
export function previewNumber(
  companyInitials: string,
  typeInitials: string,
  tokenOrder: NumberingToken[],
  separator: string,
  year: number,
): string {
  const tokens: Record<NumberingToken, string> = {
    company: companyInitials.trim().toUpperCase() || 'CO',
    type: typeInitials.trim().toUpperCase() || 'DOC',
    year: String(year),
    sequence: '0001',
  }
  return tokenOrder.map((t) => tokens[t]).join(separator)
}
