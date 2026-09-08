import { get, post } from './client'

export type PsmfStatus = 'draft' | 'active' | 'retired'

/**
 * Real-usage content, 11 Sep 2026 — mirrors `vigicloud document
 * formats/kenya-psmf-template.docx`'s own 7 sections exactly. Every
 * field optional — a draft can be saved and re-saved at any point
 * while it's being filled in.
 */
export interface PsmfContent {
  reference?: {
    psmfReferenceNumber?: string
    mainLocationOfPvActivities?: string
  }
  qppv?: {
    primary?: {
      fullName?: string
      professionalQualification?: string
      professionalBoardRegistrationNo?: string
      physicalWorkAddress?: string
      emergencyMobileNumber?: string
      officialEmail?: string
    }
    backup?: {
      fullName?: string
      contactEmail?: string
      contactPhone?: string
    }
  }
  organizationalStructure?: {
    corporateGovernanceNarrative?: string
    ltrRegisteredName?: string
    ltrPremiseLicenseNumber?: string
    ltrScopeOfOperations?: string
  }
  sourcesOfSafetyData?: string[]
  computerizedSystems?: {
    localTrackingTool?: string
    globalSafetyDatabase?: string
    submissionPortal?: string
    dataBackupProtocol?: string
  }
  sops?: { reference?: string; title?: string; version?: string }[]
  qms?: {
    trainingCadence?: string
    internalAuditCadence?: string
    capaReviewCadence?: string
  }
  appendices?: string[]
}

export interface Psmf {
  id: string
  companyId: string
  version: number
  status: PsmfStatus
  title: string
  summary: string | null
  content: PsmfContent | null
  documentId: string | null
  createdBy: string | null
  createdAt: string
  activatedAt: string | null
  retiredAt: string | null
}

export interface CreatePsmfInput {
  title: string
  summary?: string
}

export async function createPsmf(input: CreatePsmfInput): Promise<Psmf> {
  const { data } = await post<Psmf>('/psmf', input)
  return data
}

export async function attachPsmfDocument(id: string, documentId: string): Promise<Psmf> {
  const { data } = await post<Psmf>(`/psmf/${id}/document`, { documentId })
  return data
}

export async function updatePsmfContent(id: string, content: PsmfContent): Promise<Psmf> {
  const { data } = await post<Psmf>(`/psmf/${id}/content`, { content })
  return data
}

export async function generatePsmfDocument(id: string): Promise<Psmf> {
  const { data } = await post<Psmf>(`/psmf/${id}/generate-document`, {})
  return data
}

export async function activatePsmf(id: string): Promise<Psmf> {
  const { data } = await post<Psmf>(`/psmf/${id}/activate`, {})
  return data
}

export async function listPsmf(): Promise<Psmf[]> {
  const { data } = await get<Psmf[]>('/psmf')
  return data
}
