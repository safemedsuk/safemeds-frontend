import { get, patch, post } from './client'

export interface InspectionChecklistTemplate {
  id: string
  authorityId: string
  sectionKey: string
  title: string
  description: string | null
  mappedRecordType: string | null
  guidelineReference: string | null
  unverified: boolean
  sortOrder: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export async function listInspectionChecklistTemplates(authorityId?: string): Promise<InspectionChecklistTemplate[]> {
  const { data } = await get<InspectionChecklistTemplate[]>('/inspection-checklist-templates', { authorityId })
  return data
}

export async function createInspectionChecklistTemplate(input: {
  authorityId: string
  sectionKey: string
  title: string
  description?: string
  mappedRecordType?: string
  guidelineReference?: string
  sortOrder?: number
  unverified?: boolean
}): Promise<InspectionChecklistTemplate> {
  const { data } = await post<InspectionChecklistTemplate>('/inspection-checklist-templates', input)
  return data
}

export async function updateInspectionChecklistTemplate(
  id: string,
  input: {
    title?: string
    description?: string
    guidelineReference?: string
    sortOrder?: number
    unverified?: boolean
    active?: boolean
  },
): Promise<InspectionChecklistTemplate> {
  const { data } = await patch<InspectionChecklistTemplate>(`/inspection-checklist-templates/${id}`, input)
  return data
}
