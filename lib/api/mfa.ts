import { post } from './client'
import type { LoginSuccessResult } from './auth'

export interface MfaSetupResult {
  secret: string
  otpauthUri: string
  qrCodeDataUrl: string
}

export interface MfaVerifySetupResult {
  recoveryCodes: string[]
}

export async function setupMfa(): Promise<MfaSetupResult> {
  const { data } = await post<MfaSetupResult>('/auth/mfa/setup')
  return data
}

export async function verifyMfaSetup(code: string): Promise<MfaVerifySetupResult> {
  const { data } = await post<MfaVerifySetupResult>('/auth/mfa/verify-setup', { code })
  return data
}

export async function challengeMfa(
  mfaPendingToken: string,
  credential: { code: string } | { recoveryCode: string },
): Promise<LoginSuccessResult> {
  const { data } = await post<LoginSuccessResult>('/auth/mfa/challenge', { mfaPendingToken, ...credential })
  return data
}

export async function disableMfa(password: string, mfaCode: string): Promise<void> {
  await post('/auth/mfa/disable', { password, mfaCode })
}

export async function regenerateRecoveryCodes(password: string, mfaCode: string): Promise<MfaVerifySetupResult> {
  const { data } = await post<MfaVerifySetupResult>('/auth/mfa/recovery-codes/regenerate', { password, mfaCode })
  return data
}
