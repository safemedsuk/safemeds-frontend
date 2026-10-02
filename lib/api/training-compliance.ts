import { del, get, post } from './client'

/** QualCloud (Phase 13) Stage 12 — Training & Competency Management. */

export interface RoleTrainingCurriculum {
  id: string
  companyId: string
  roleKey: string
  trainingTypeId: string
  trainingType?: { id: string; typeKey: string; label: string }
  isMandatory: boolean
  recertificationIntervalMonths: number | null
  documentTypeTrigger: string | null
  createdAt: string
}

export async function createCurriculum(input: {
  roleKey: string
  trainingTypeId: string
  isMandatory?: boolean
  recertificationIntervalMonths?: number
  documentTypeTrigger?: string
}): Promise<RoleTrainingCurriculum> {
  const { data } = await post<RoleTrainingCurriculum>('/training/curriculum', input)
  return data
}

export async function listCurriculum(): Promise<RoleTrainingCurriculum[]> {
  const { data } = await get<RoleTrainingCurriculum[]>('/training/curriculum')
  return data
}

export async function removeCurriculum(id: string): Promise<void> {
  await del(`/training/curriculum/${id}`)
}

export type ComplianceStatus = 'valid' | 'expiring' | 'expired' | 'missing'

export interface ComplianceStatusRow {
  curriculumId: string
  roleKey: string
  trainingTypeId: string
  trainingTypeLabel: string
  isMandatory: boolean
  status: ComplianceStatus
  latestTrainingRecordId: string | null
  latestCompletionDate: string | null
  latestExpiryDate: string | null
}

export async function getComplianceStatus(userId: string): Promise<ComplianceStatusRow[]> {
  const { data } = await get<ComplianceStatusRow[]>(`/training/compliance/${userId}`)
  return data
}

export type CompetencyAssessmentMethod = 'written_test' | 'practical_observation' | 'supervisor_signoff'
export type CompetencyAssessmentResult = 'competent' | 'not_yet_competent'

export interface CompetencyAssessment {
  id: string
  trainingRecordId: string
  assessmentMethod: CompetencyAssessmentMethod
  result: CompetencyAssessmentResult
  notes: string | null
  assessedBy: string | null
  assessedAt: string
}

export async function recordCompetencyAssessment(input: {
  trainingRecordId: string
  assessmentMethod: CompetencyAssessmentMethod
  result: CompetencyAssessmentResult
  notes?: string
}): Promise<CompetencyAssessment> {
  const { data } = await post<CompetencyAssessment>('/training/competency-assessments', input)
  return data
}

export async function listCompetencyAssessments(trainingRecordId: string): Promise<CompetencyAssessment[]> {
  const { data } = await get<CompetencyAssessment[]>(
    `/training/training-records/${trainingRecordId}/competency-assessments`,
  )
  return data
}
