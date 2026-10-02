import { get, post } from './client'

export interface InspectionReadinessRow {
  sectionKey: string
  title: string
  description: string | null
  status: 'ready' | 'needs_attention'
  note: string
  guidelineReference: string | null
  unverified: boolean
}

export interface InspectionReadinessSnapshot {
  overall: 'ready' | 'needs_attention'
  homeCountryName: string
  authorityConfigured: boolean
  rows: InspectionReadinessRow[]
}

export async function getInspectionReadiness(): Promise<InspectionReadinessSnapshot> {
  const { data } = await get<InspectionReadinessSnapshot>('/inspection-readiness')
  return data
}

export interface InspectionReadinessPack {
  id: string
  companyId: string
  snapshot: InspectionReadinessSnapshot
  pdfDocumentId: string
  generatedBy: string | null
  generatedAt: string
}

export async function generateInspectionReadinessPack(): Promise<InspectionReadinessPack> {
  const { data } = await post<InspectionReadinessPack>('/inspection-readiness/packs')
  return data
}

export async function listInspectionReadinessPacks(): Promise<InspectionReadinessPack[]> {
  const { data } = await get<InspectionReadinessPack[]>('/inspection-readiness/packs')
  return data
}
