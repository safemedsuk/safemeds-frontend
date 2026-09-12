import { get, patch } from './client'

export interface SecurityPolicy {
  id: string
  companyId: string
  minPasswordLength: number
  sessionTimeoutMinutes: number
  mfaRequiredForSignatureRoles: boolean
  createdAt: string
  updatedAt: string
}

export interface UpdateSecurityPolicyPayload {
  minPasswordLength?: number
  sessionTimeoutMinutes?: number
  mfaRequiredForSignatureRoles?: boolean
}

export async function getSecurityPolicy(): Promise<SecurityPolicy> {
  const { data } = await get<SecurityPolicy>('/company/security-policy')
  return data
}

export async function updateSecurityPolicy(payload: UpdateSecurityPolicyPayload): Promise<SecurityPolicy> {
  const { data } = await patch<SecurityPolicy>('/company/security-policy', payload)
  return data
}
