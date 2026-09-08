import { get, post } from './client'

export type QppvNominationRole = 'primary' | 'backup'
export type QppvNominationStatus = 'active' | 'superseded'

export interface QppvNomination {
  id: string
  companyId: string
  qppvUserId: string
  role: QppvNominationRole
  status: QppvNominationStatus
  nominationLetterDocumentId: string | null
  regulatorConfirmationDocumentId: string | null
  nominatedAt: string
  supersededAt: string | null
  createdBy: string | null
}

export interface QppvStatus {
  primaryQppvUserId: string | null
  backupQppvUserId: string | null
  nominations: QppvNomination[]
}

export async function setQppvNomination(role: QppvNominationRole, qppvUserId: string): Promise<QppvNomination> {
  const { data } = await post<QppvNomination>('/qppv/nominations', { role, qppvUserId })
  return data
}

export async function uploadQppvRegulatorConfirmation(nominationId: string, documentId: string): Promise<QppvNomination> {
  const { data } = await post<QppvNomination>(`/qppv/nominations/${nominationId}/regulator-confirmation`, { documentId })
  return data
}

export async function getQppvStatus(): Promise<QppvStatus> {
  const { data } = await get<QppvStatus>('/qppv/status')
  return data
}
