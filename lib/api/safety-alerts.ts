import { get, patch, post } from './client'
import { GeneratedReport } from './reports'

export type SafetyAlertStatus = 'open' | 'reviewed' | 'actioned' | 'dismissed'

export const SAFETY_ALERT_STATUS_LABELS: Record<SafetyAlertStatus, string> = {
  open: 'Open',
  reviewed: 'Reviewed',
  actioned: 'Actioned',
  dismissed: 'Dismissed',
}

export interface SafetyAlert {
  id: string
  companyId: string
  title: string
  source: string
  sourceUrl: string | null
  summary: string
  affectedProductId: string | null
  status: SafetyAlertStatus
  reviewNote: string | null
  loggedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateSafetyAlertInput {
  title: string
  source: string
  sourceUrl?: string
  summary: string
  affectedProductId?: string
}

export interface UpdateSafetyAlertStatusInput {
  status: 'reviewed' | 'actioned' | 'dismissed'
  reviewNote?: string
}

export async function createSafetyAlert(input: CreateSafetyAlertInput): Promise<SafetyAlert> {
  const { data } = await post<SafetyAlert>('/safety-alerts', input)
  return data
}

export async function listSafetyAlerts(status?: SafetyAlertStatus): Promise<SafetyAlert[]> {
  const { data } = await get<SafetyAlert[]>('/safety-alerts', status ? { status } : undefined)
  return data
}

export async function getSafetyAlert(id: string): Promise<SafetyAlert> {
  const { data } = await get<SafetyAlert>(`/safety-alerts/${id}`)
  return data
}

export async function updateSafetyAlertStatus(id: string, input: UpdateSafetyAlertStatusInput): Promise<SafetyAlert> {
  const { data } = await patch<SafetyAlert>(`/safety-alerts/${id}/status`, input)
  return data
}

export type SafetyLetterType = 'dhcp' | 'dil'

export const SAFETY_LETTER_TYPE_LABELS: Record<SafetyLetterType, string> = {
  dhcp: 'Dear Healthcare Professional Letter',
  dil: 'Dear Investigator Letter',
}

export interface SafetyLetterRecipient {
  id: string
  companyId: string
  generatedReportId: string
  recipientName: string
  recipientEmail: string
  sentAt: string | null
  createdAt: string
}

export interface SafetyLetterWithRecipients extends GeneratedReport {
  recipients: SafetyLetterRecipient[]
}

export interface GenerateSafetyLetterInput {
  safetyAlertId: string
  letterType: SafetyLetterType
  productId?: string
  /** Real header field on the sample DHCPL — required, the pre-approval gate. */
  ppbApprovalReference: string
  /** "Background Information & Clinical Relevance" section. */
  backgroundInformation: string
  /** "Actionable Guidance for Healthcare Providers" section. */
  actionableGuidance: string
  signatoryName: string
  /** Defaults server-side to "Medical Director / QPPV" if omitted. */
  signatoryTitle?: string
  recipients: { name: string; email: string }[]
}

export async function generateSafetyLetter(input: GenerateSafetyLetterInput): Promise<SafetyLetterWithRecipients> {
  const { data } = await post<SafetyLetterWithRecipients>('/safety-letters', input)
  return data
}

export async function dispatchSafetyLetter(id: string): Promise<SafetyLetterWithRecipients> {
  const { data } = await post<SafetyLetterWithRecipients>(`/safety-letters/${id}/dispatch`, {})
  return data
}

export async function getSafetyLetter(id: string): Promise<SafetyLetterWithRecipients> {
  const { data } = await get<SafetyLetterWithRecipients>(`/safety-letters/${id}`)
  return data
}
