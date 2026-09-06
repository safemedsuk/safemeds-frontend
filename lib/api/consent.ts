import { get, post } from './client'

export type ConsentType = 'report' | 'contact' | 'data_privacy'
export type ConsentMethod = 'verbal' | 'written' | 'implied'

export interface ConsentRecord {
  id: string
  companyId: string
  recordType: string
  recordId: string
  consentType: ConsentType
  granted: boolean
  method: ConsentMethod
  formVersion: number
  capturedBy: string | null
  grantedAt: string | null
  withdrawnAt: string | null
  createdAt: string
}

export interface ConsentCheckResult {
  hasRecord: boolean
  granted: boolean | null
  record: ConsentRecord | null
}

export async function captureConsent(
  recordType: string,
  recordId: string,
  consentType: ConsentType,
  granted: boolean,
  method: ConsentMethod,
): Promise<ConsentRecord> {
  const { data } = await post<ConsentRecord>('/consent-records', { recordType, recordId, consentType, granted, method })
  return data
}

export async function withdrawConsent(consentRecordId: string): Promise<ConsentRecord> {
  const { data } = await post<ConsentRecord>(`/consent-records/${consentRecordId}/withdraw`)
  return data
}

export async function checkConsent(recordType: string, recordId: string, consentType: ConsentType): Promise<ConsentCheckResult> {
  const { data } = await get<ConsentCheckResult>('/consent-records/check', { recordType, recordId, consentType })
  return data
}
