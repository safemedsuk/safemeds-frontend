import { get, post } from './client'

export interface SignatureEvent {
  id: string
  companyId: string
  recordType: string
  recordId: string
  recordHashSha256: string
  canonicalPayload: Record<string, unknown>
  signerId: string
  roleAtSigning: string
  intentStatement: string
  signedAt: string
  authMethod: string
}

export interface SignatureVerifyResult {
  intact: boolean
  signedAt: string
  signerId: string
}

export async function getSignaturesForRecord(recordType: string, recordId: string): Promise<SignatureEvent[]> {
  const { data } = await get<SignatureEvent[]>(`/records/${encodeURIComponent(recordType)}/${encodeURIComponent(recordId)}/signatures`)
  return data
}

export async function verifySignature(id: string): Promise<SignatureVerifyResult> {
  const { data } = await post<SignatureVerifyResult>(`/signatures/${id}/verify`)
  return data
}
