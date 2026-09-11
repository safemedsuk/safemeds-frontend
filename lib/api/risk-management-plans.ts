import { get, patch, post } from './client'

export type RiskManagementPlanStatus = 'draft' | 'active' | 'retired'

/**
 * Real-document-fidelity request, 12 Sep 2026 — mirrors `vigicloud
 * document formats/Drat Kenya RMP.docx`'s own 6-part structure
 * exactly. Every field optional — a draft can be saved and re-saved at
 * any point while it's being filled in.
 */
export interface RmpContent {
  header?: {
    dosageFormAndStrength?: string
    mahApplicant?: string
    localTechnicalRepresentative?: string
    dateOfApplication?: string
    rmpVersionAndDate?: string
  }
  partI?: {
    activeSubstance?: string
    atcCode?: string
    indications?: string
    targetPopulation?: string
    productType?: string
    qppvNameAndLicense?: string
  }
  partII?: {
    moduleSI?: { incidencePrevalence?: string; relevantComorbidities?: string }
    moduleSIV?: { exclusionCriteriaReview?: string; kenyanContext?: string }
    moduleSVII?: { identifiedRisks?: string; potentialRisks?: string; missingInformation?: string }
  }
  partIII?: {
    additionalStudiesPlanned?: boolean
    additionalStudiesDescription?: string
  }
  partIV?: {
    mandatedLocalEfficacyStudies?: string
  }
  partV?: {
    additionalToolsRequired?: boolean
    additionalToolsDescription?: string
  }
  partVI?: {
    summary?: string
  }
  signOff?: {
    preparedByName?: string
  }
}

export interface RiskManagementPlan {
  id: string
  companyId: string
  productId: string
  version: number
  status: RiskManagementPlanStatus
  title: string
  summary: string | null
  content: RmpContent | null
  documentId: string | null
  nextRenewalDueAt: string | null
  submittedAt: string | null
  createdBy: string | null
  createdAt: string
  activatedAt: string | null
  retiredAt: string | null
}

export interface CreateRmpInput {
  productId: string
  title: string
  summary?: string
  nextRenewalDueAt?: string
}

export async function createRmp(input: CreateRmpInput): Promise<RiskManagementPlan> {
  const { data } = await post<RiskManagementPlan>('/rmp', input)
  return data
}

export async function attachRmpDocument(id: string, documentId: string): Promise<RiskManagementPlan> {
  const { data } = await post<RiskManagementPlan>(`/rmp/${id}/document`, { documentId })
  return data
}

export async function updateRmpContent(id: string, content: RmpContent): Promise<RiskManagementPlan> {
  const { data } = await post<RiskManagementPlan>(`/rmp/${id}/content`, { content })
  return data
}

export async function generateRmpDocument(id: string): Promise<RiskManagementPlan> {
  const { data } = await post<RiskManagementPlan>(`/rmp/${id}/generate-document`, {})
  return data
}

export async function activateRmp(id: string): Promise<RiskManagementPlan> {
  const { data } = await post<RiskManagementPlan>(`/rmp/${id}/activate`, {})
  return data
}

export async function updateRmpRenewal(id: string, nextRenewalDueAt: string): Promise<RiskManagementPlan> {
  const { data } = await patch<RiskManagementPlan>(`/rmp/${id}/renewal`, { nextRenewalDueAt })
  return data
}

export async function listRmp(productId?: string): Promise<RiskManagementPlan[]> {
  const { data } = await get<RiskManagementPlan[]>('/rmp', productId ? { productId } : undefined)
  return data
}
