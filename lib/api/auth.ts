import { ApiRequestError, API_BASE_URL, del, get, post } from './client'

export type CompanyType =
  | 'manufacturer'
  | 'importer_distributor'
  | 'pharmacy_chain'
  | 'e_pharmacy'
  | 'medical_facility'
  | 'ngo_social_health'
  | 'research_institution'
  | 'other'

export interface RegisterCompanyPayload {
  companyName: string
  companyType: CompanyType
  countryId: string
  licenceNumber: string
  adminFullName: string
  adminEmail: string
  adminPhone?: string
  adminPassword: string
}

export interface RegisterCompanyResult {
  referenceNumber: string
  status: string
}

export interface SafeUser {
  id: string
  email: string
  fullName: string
  companyId: string | null
  companyName: string | null
  roleKeys: string[]
  platformRole: string | null
  mustChangePassword: boolean
  /** Resolved server-side from roleKeys/platformRole at login/refresh time — usePermissions() reads this directly. The server still enforces every action independently; this only drives what the UI shows. */
  permissions?: string[]
}

export interface SecurityPolicySummary {
  minPasswordLength: number
  sessionTimeoutMinutes: number
  mfaRequiredForSignatureRoles: boolean
}

export interface LoginSuccessResult {
  mfaRequired: false
  user: SafeUser
  mfaSetupRequired: boolean
  securityPolicy: SecurityPolicySummary | null
}

export interface LoginMfaPendingResult {
  mfaRequired: true
  mfaPendingToken: string
  mfaPendingExpiresInSeconds: number
}

export type LoginResult = LoginSuccessResult | LoginMfaPendingResult

export interface SessionInfo {
  id: string
  device: string
  ip: string | null
  createdAt: string
  isCurrent: boolean
}

export async function registerCompany(payload: RegisterCompanyPayload): Promise<RegisterCompanyResult> {
  const { data } = await post<RegisterCompanyResult>('/auth/register-company', payload)
  return data
}

/**
 * Uses XMLHttpRequest rather than fetch so upload progress can be reported
 * — fetch has no upload-progress event. This endpoint is @Public (no
 * session exists yet mid-registration), so no CSRF header is needed.
 */
export function uploadLicence(
  referenceNumber: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ key: string; sha256: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append('file', file)

    xhr.open('POST', `${API_BASE_URL}/auth/register-company/${referenceNumber}/licence`)
    xhr.withCredentials = true

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      let payload: { data?: { key: string; sha256: string }; error?: { code: string; message: string; details?: unknown } } = {}
      try {
        payload = JSON.parse(xhr.responseText)
      } catch {
        // fall through to generic error below
      }

      if (xhr.status >= 200 && xhr.status < 300 && payload.data) {
        resolve(payload.data)
      } else {
        // Thrown as ApiRequestError (not a bare Error) so every consumer's
        // existing `err instanceof ApiRequestError ? err.message : ...`
        // handling picks up the real backend message here too, instead of
        // silently falling through to a generic fallback string.
        reject(
          new ApiRequestError(xhr.status || 0, payload.error ?? { code: 'UPLOAD_FAILED', message: 'Licence upload failed' }),
        )
      }
    })

    xhr.addEventListener('error', () =>
      reject(new ApiRequestError(0, { code: 'NETWORK_ERROR', message: 'Licence upload failed — check your connection' })),
    )
    xhr.send(formData)
  })
}

export async function verifyEmail(email: string, code: string): Promise<{ status: string }> {
  const { data } = await post<{ status: string }>('/auth/verify-email', { email, code })
  return data
}

export async function resendCode(email: string): Promise<{ sent: boolean }> {
  const { data } = await post<{ sent: boolean }>('/auth/resend-code', { email })
  return data
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const { data } = await post<LoginResult>('/auth/login', { email, password })
  return data
}

export async function logout(): Promise<void> {
  await post('/auth/logout')
}

/**
 * Phase 1.9 re-authentication — confirms the current user's password (and
 * MFA code, if the account has one active) and returns a short-lived,
 * single-use signature-grade token. The only thing this token is good for
 * is a signing action (Phase 6's `SignatureService.sign`, consumed today
 * via `POST /workflow/instances/:id/transition`'s `signatureToken` field).
 */
export async function reauth(password: string, mfaCode?: string): Promise<{ signatureToken: string }> {
  const { data } = await post<{ signatureToken: string }>('/auth/reauth', { password, mfaCode })
  return data
}

export async function getSessions(page = 1): Promise<{ sessions: SessionInfo[]; totalPages: number }> {
  const { data, meta } = await get<SessionInfo[]>('/auth/sessions', { page, limit: 25 })
  return { sessions: data, totalPages: meta?.totalPages ?? 1 }
}

export async function revokeSession(id: string): Promise<void> {
  await del(`/auth/sessions/${id}`)
}

export async function revokeAllOtherSessions(): Promise<void> {
  await del('/auth/sessions')
}
