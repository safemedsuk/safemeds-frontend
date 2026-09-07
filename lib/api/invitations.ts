import { del, get, post } from './client'
import type { LoginSuccessResult } from './auth'

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

export interface Invitation {
  id: string
  companyId: string
  email: string
  roleKeys: string[]
  /** RegCloud (Phase 12) Stage 15 — the "multi-client consultant" case; carried through to the created `User.isExternal` once accepted. */
  isExternal: boolean
  invitedBy: string
  acceptedByUserId: string | null
  expiresAt: string
  status: InvitationStatus
  createdAt: string
  updatedAt: string
}

export interface InvitationLookup {
  companyName: string
  inviterName: string
  roleKeys: string[]
  email: string
  expiresAt: string
  minPasswordLength: number
}

export async function createInvitation(email: string, roleKeys: string[], isExternal?: boolean): Promise<Invitation> {
  const { data } = await post<Invitation>('/invitations', { email, roleKeys, isExternal })
  return data
}

export async function listInvitations(
  status?: InvitationStatus,
  page = 1,
): Promise<{ invitations: Invitation[]; totalPages: number }> {
  const { data, meta } = await get<Invitation[]>('/invitations', { status, page, limit: 25 })
  return { invitations: data, totalPages: meta?.totalPages ?? 1 }
}

export async function resendInvitation(id: string): Promise<void> {
  await post(`/invitations/${id}/resend`)
}

export async function revokeInvitation(id: string): Promise<void> {
  await del(`/invitations/${id}`)
}

export async function lookupInvitation(token: string): Promise<InvitationLookup> {
  const { data } = await get<InvitationLookup>(`/auth/invitations/${token}`)
  return data
}

export async function acceptInvitation(token: string, fullName: string, password: string): Promise<{ email: string }> {
  const { data } = await post<{ email: string }>(`/auth/invitations/${token}/accept`, { fullName, password })
  return data
}

export async function verifyInvitationEmail(email: string, code: string): Promise<LoginSuccessResult> {
  const { data } = await post<LoginSuccessResult>('/auth/invitations/verify-email', { email, code })
  return data
}

export async function resendInvitationVerificationCode(email: string): Promise<void> {
  await post('/auth/invitations/resend-code', { email })
}
