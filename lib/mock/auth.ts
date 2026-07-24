/**
 * Authentication Mock Data
 * Simulated auth flow with realistic latency and all state variations
 */

import type {
  RegistrationDraft,
  Invitation,
  SessionInfo,
  MfaState,
  SecurityPolicy,
  PharmaRole,
} from '@/lib/types'

const SIMULATED_LATENCY = 300 // ms
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/* Pharma Role Definitions */
export const PHARMA_ROLES: PharmaRole[] = [
  {
    key: 'admin',
    label: 'System Administrator',
    description: 'Full platform access, user management, compliance configuration',
    permissions: ['users.manage', 'compliance.configure', 'audit.view', 'signature.authorize'],
  },
  {
    key: 'qppv',
    label: 'QPPV',
    description: 'Quality and Product Person responsible for safety cases and regulatory submissions',
    permissions: ['safety.review', 'signature.authorize', 'compliance.view', 'audit.view'],
  },
  {
    key: 'compliance_officer',
    label: 'Compliance Officer',
    description: 'Manages regulatory requirements and compliance tracking',
    permissions: ['compliance.manage', 'audit.view', 'reports.view', 'signature.authorize'],
  },
  {
    key: 'data_manager',
    label: 'Data Manager',
    description: 'Product and batch data entry and maintenance',
    permissions: ['data.edit', 'compliance.view', 'audit.view'],
  },
  {
    key: 'viewer',
    label: 'Viewer',
    description: 'Read-only access to reports and dashboards',
    permissions: ['reports.view', 'audit.view'],
  },
]

/* Mock Registration Drafts */
export const mockRegistrationDrafts: RegistrationDraft[] = [
  {
    id: 'reg-draft-1',
    companyName: 'PharmaTech Solutions Kenya',
    companyType: 'manufacturer',
    countryId: 'KE',
    licenceNumber: 'PPB/LIC/2024/001',
    adminFullName: 'James Kipchoge',
    adminEmail: 'james.kipchoge@pharmatech.ke',
    adminPhone: '+254712345678',
    status: 'approved',
    referenceNumber: 'SR-20240723-001',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'reg-draft-2',
    companyName: 'Healthy Pharma Ltd',
    companyType: 'distributor',
    countryId: 'UG',
    licenceNumber: 'NDA/REG/2024/045',
    adminFullName: 'Sarah Mukwaya',
    adminEmail: 'sarah.mukwaya@healthypharma.ug',
    adminPhone: '+256701234567',
    status: 'under_review',
    referenceNumber: 'SR-20240722-002',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 43200000).toISOString(),
  },
]

/* Mock Invitations */
export const mockInvitations: Invitation[] = [
  {
    id: 'inv-1',
    companyId: 'company-1',
    email: 'amara.okafor@pharmatech.ng',
    roleKeys: ['compliance_officer'],
    invitedByName: 'James Kipchoge',
    sentAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    expiresAt: new Date(Date.now() + 86400000 * 5).toISOString(),
    status: 'pending',
    token: 'inv_token_123abc',
  },
  {
    id: 'inv-2',
    companyId: 'company-1',
    email: 'expired.user@pharmatech.ng',
    roleKeys: ['data_manager'],
    invitedByName: 'James Kipchoge',
    sentAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    expiresAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    status: 'expired',
    token: 'inv_token_456def',
  },
]

/* Mock Sessions */
export const mockSessions: SessionInfo[] = [
  {
    id: 'session-1',
    device: 'MacBook Pro',
    browser: 'Chrome 126.0',
    approxLocation: 'Nairobi, Kenya',
    lastActiveAt: new Date(Date.now() - 300000).toISOString(),
    isCurrent: true,
  },
  {
    id: 'session-2',
    device: 'iPhone 15 Pro',
    browser: 'Safari 17.5',
    approxLocation: 'Nairobi, Kenya',
    lastActiveAt: new Date(Date.now() - 86400000).toISOString(),
    isCurrent: false,
  },
  {
    id: 'session-3',
    device: 'Desktop PC',
    browser: 'Firefox 127.0',
    approxLocation: 'Kampala, Uganda',
    lastActiveAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    isCurrent: false,
  },
]

/* Mock MFA State */
export const mockMfaState: MfaState = {
  enabled: true,
  method: 'totp',
  recoveryCodesRemaining: 7,
}

/* Mock Security Policy */
export const mockSecurityPolicy: SecurityPolicy = {
  minPasswordLength: 12,
  sessionTimeoutMinutes: 15,
  mfaRequiredForSignatureRoles: true,
}

/* Auth Mock Functions */

export async function registerCompany(data: {
  companyName: string
  companyType: string
  countryId: string
  licenceNumber: string
  adminFullName: string
  adminEmail: string
  adminPhone: string
}) {
  await delay(SIMULATED_LATENCY)

  const draft: RegistrationDraft = {
    id: `reg-${Date.now()}`,
    ...data,
    status: 'email_verification',
    referenceNumber: `SR-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.random().toString(36).substr(2, 3).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  return {
    success: true,
    data: draft,
  }
}

export async function verifyEmail(email: string, code: string) {
  await delay(SIMULATED_LATENCY)

  // Accept any 6-digit code for testing (in production, validate against sent code)
  if (/^\d{6}$/.test(code)) {
    return {
      success: true,
      message: 'Email verified successfully',
    }
  }

  return {
    success: false,
    error: 'Invalid verification code',
  }
}

export async function submitRegistration(registrationId: string) {
  await delay(SIMULATED_LATENCY)

  return {
    success: true,
    status: 'under_review',
    message: 'Your registration has been submitted for review',
  }
}

export async function login(email: string, password: string) {
  await delay(SIMULATED_LATENCY)

  // Simulate account lockout after 5 failed attempts
  if (email === 'locked.user@safemeds.com' && password !== 'Correct@Password123') {
    return {
      success: false,
      error: 'account_locked' as const,
      lockedUntil: new Date(Date.now() + 15 * 60000).toISOString(),
    }
  }

  // Valid login
  if (email === 'james.kipchoge@pharmatech.ke' && password === 'SecurePass@2024') {
    return {
      success: true,
      user: {
        id: 'user-1',
        email: email,
        name: 'James Kipchoge',
        role: 'admin' as const,
        company: 'company-1',
        department: 'Operations',
        status: 'active' as const,
      },
      mfaRequired: false,
      sessionId: `session-${Date.now()}`,
    }
  }

  // Deactivated account
  if (email === 'deactivated.user@safemeds.com') {
    return {
      success: false,
      error: 'account_deactivated' as const,
    }
  }

  // Company suspended
  if (email === 'suspended.company@safemeds.com') {
    return {
      success: false,
      error: 'company_suspended' as const,
    }
  }

  // Invalid credentials (never reveal whether email exists)
  return {
    success: false,
    error: 'invalid_credentials' as const,
  }
}

export async function requestPasswordReset(email: string) {
  await delay(SIMULATED_LATENCY)

  return {
    success: true,
    message: 'If an account exists for this address, a password reset email has been sent',
  }
}

export async function resetPassword(token: string, newPassword: string) {
  await delay(SIMULATED_LATENCY)

  if (token === 'valid_reset_token') {
    return {
      success: true,
      message: 'Password has been reset successfully',
    }
  }

  if (token === 'expired_token') {
    return {
      success: false,
      error: 'reset_link_expired',
    }
  }

  return {
    success: false,
    error: 'invalid_token',
  }
}

export async function acceptInvitation(token: string, data: {
  fullName: string
  password: string
}) {
  await delay(SIMULATED_LATENCY)

  if (token === 'expired_invitation_token') {
    return {
      success: false,
      error: 'invitation_expired',
    }
  }

  if (token === 'valid_invitation_token') {
    return {
      success: true,
      user: {
        id: `user-${Date.now()}`,
        email: 'newuser@safemeds.com',
        name: data.fullName,
        role: 'compliance_officer' as const,
        company: 'company-1',
        department: 'Regulatory Affairs',
        status: 'active' as const,
      },
      message: 'Account created successfully',
    }
  }

  return {
    success: false,
    error: 'invalid_token',
  }
}

export async function setupMfa(method: 'totp' | 'sms') {
  await delay(SIMULATED_LATENCY)

  if (method === 'totp') {
    return {
      success: true,
      qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      manualKey: 'JBSWY3DPEBLW64TMMQ======',
      message: 'Scan the QR code with your authenticator app',
    }
  }

  return {
    success: true,
    message: 'SMS setup initiated. A verification code will be sent to your phone.',
  }
}

export async function verifyMfaSetup(code: string) {
  await delay(SIMULATED_LATENCY)

  if (code === '123456') {
    return {
      success: true,
      recoveryCodes: [
        '8F2K-3N7L',
        'Q9W1-5B6X',
        'C8V0-2J4M',
        'R3P7-8T2K',
        'L5F9-4H1X',
        'M6D2-9S7B',
        'N7G3-0Q8C',
        'X8K4-1V5P',
      ],
      message: 'MFA has been enabled',
    }
  }

  return {
    success: false,
    error: 'Invalid verification code',
  }
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await delay(SIMULATED_LATENCY)

  if (currentPassword === 'WrongPassword@2024') {
    return {
      success: false,
      error: 'Current password is incorrect',
    }
  }

  return {
    success: true,
    message: 'Password changed successfully',
  }
}

export async function getSessions() {
  await delay(SIMULATED_LATENCY)
  return {
    success: true,
    sessions: mockSessions,
  }
}

export async function signOutSession(sessionId: string) {
  await delay(SIMULATED_LATENCY)
  return {
    success: true,
    message: 'Session signed out',
  }
}

export async function signOutAllOtherSessions() {
  await delay(SIMULATED_LATENCY)
  return {
    success: true,
    message: 'All other sessions signed out',
  }
}

export async function getSecurityPolicy() {
  await delay(SIMULATED_LATENCY)
  return {
    success: true,
    policy: mockSecurityPolicy,
  }
}

export async function inviteUser(data: {
  email: string
  roleKeys: string[]
  companyId: string
}) {
  await delay(SIMULATED_LATENCY)

  const invitation: Invitation = {
    id: `inv-${Date.now()}`,
    ...data,
    roleKeys: data.roleKeys as any,
    invitedByName: 'System Administrator',
    sentAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 604800000).toISOString(), // 7 days
    status: 'pending',
    token: `inv_${Math.random().toString(36).substr(2, 9)}`,
  }

  return {
    success: true,
    invitation,
    message: `Invitation sent to ${data.email}`,
  }
}

export async function getPendingInvitations(companyId: string) {
  await delay(SIMULATED_LATENCY)

  return {
    success: true,
    invitations: mockInvitations.filter(inv => inv.companyId === companyId),
  }
}
