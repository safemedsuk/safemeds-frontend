'use client'

import { Suspense, useEffect, useState, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, Building2, Eye, EyeOff, Loader2, UserPlus } from 'lucide-react'
import { AuthLayout } from '@/components/layout/auth-layout'
import { ApiRequestError } from '@/lib/api/client'
import {
  acceptInvitation,
  lookupInvitation,
  resendInvitationVerificationCode,
  verifyInvitationEmail,
  type InvitationLookup,
} from '@/lib/api/invitations'
import { getPasswordRequirements, isPasswordValid } from '@/lib/password-requirements'
import { tenantRoleLabel } from '@/lib/tenant-roles'
import { useAuthStore } from '@/lib/store/auth-store'

type Step = 'loading' | 'invalid' | 'form' | 'verify'

function AcceptInvitationForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const { setCurrentUser, setSecurityPolicy, setMfaEnabled, setIsAuthenticated } = useAuthStore()

  const [step, setStep] = useState<Step>('loading')
  const [invalidReason, setInvalidReason] = useState('')
  const [invitation, setInvitation] = useState<InvitationLookup | null>(null)

  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resent, setResent] = useState(false)

  useEffect(() => {
    if (!token) {
      setInvalidReason('This invitation link is missing its token.')
      setStep('invalid')
      return
    }

    lookupInvitation(token)
      .then((data) => {
        setInvitation(data)
        setStep('form')
      })
      .catch((err) => {
        if (err instanceof ApiRequestError) {
          if (err.code === 'INVITATION_REVOKED') setInvalidReason('This invitation has been revoked.')
          else if (err.code === 'INVITATION_ALREADY_ACCEPTED') setInvalidReason('This invitation has already been accepted.')
          else if (err.code === 'INVITATION_EXPIRED') setInvalidReason('This invitation has expired. Ask your administrator to send a new one.')
          else setInvalidReason('This invitation link is invalid.')
        } else {
          setInvalidReason('This invitation link is invalid.')
        }
        setStep('invalid')
      })
  }, [token])

  const passwordValid = isPasswordValid(password, invitation?.minPasswordLength)
  const passwordsMatch = password.length > 0 && password === confirmPassword

  const handleAccept = async (e: FormEvent) => {
    e.preventDefault()
    if (!token || fullName.trim().length < 2 || !passwordValid || !passwordsMatch) return
    setError(null)
    setLoading(true)

    try {
      await acceptInvitation(token, fullName.trim(), password)
      setStep('verify')
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not accept the invitation. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault()
    if (!invitation || code.length !== 6) return
    setError(null)
    setLoading(true)

    try {
      const result = await verifyInvitationEmail(invitation.email, code)
      if (result.mfaRequired) {
        // Shouldn't happen for a brand-new account, but stay safe if it ever does.
        setError('Please sign in to continue.')
        router.push('/login')
        return
      }

      setCurrentUser(result.user)
      setSecurityPolicy(result.securityPolicy)
      setMfaEnabled(false)
      setIsAuthenticated(true)

      if (result.mfaSetupRequired) {
        router.push('/settings?forceMfaSetup=1')
      } else {
        router.push('/tasks')
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!invitation) return
    try {
      await resendInvitationVerificationCode(invitation.email)
      setResent(true)
    } catch {
      // Non-critical — user can just retry the button.
    }
  }

  if (step === 'loading') {
    return (
      <AuthLayout>
        <div className="flex items-center justify-center py-16 text-[var(--text-muted)]">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Checking your invitation…
        </div>
      </AuthLayout>
    )
  }

  if (step === 'invalid') {
    return (
      <AuthLayout>
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-full bg-status-error/10 flex items-center justify-center">
              <AlertCircle className="h-7 w-7 text-status-error" />
            </div>
          </div>
          <h1 className="text-2xl font-display font-semibold text-[var(--text)]">Invitation unavailable</h1>
          <p className="text-sm text-[var(--text-muted)]">{invalidReason}</p>
          <a href="/login" className="inline-block text-sm text-[var(--primary)] hover:opacity-90 font-medium">
            Back to sign in
          </a>
        </div>
      </AuthLayout>
    )
  }

  if (step === 'verify' && invitation) {
    return (
      <AuthLayout>
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-display font-semibold text-[var(--text)] mb-2">Verify your email</h1>
          <p className="text-sm text-[var(--text-muted)]">We sent a 6-digit code to {invitation.email}</p>
        </div>

        {error && (
          <div className="rounded-lg border bg-status-error/10 border-status-error/30 text-status-error p-4 mb-6 flex gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-5">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            className="w-full text-center text-2xl tracking-[0.5em] font-mono px-4 py-3 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
          />
          <button
            type="submit"
            disabled={code.length !== 6 || loading}
            className="w-full h-10 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Verify and continue
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={handleResend}
            disabled={resent}
            className="text-sm text-[var(--primary)] hover:opacity-90 font-medium disabled:opacity-50"
          >
            {resent ? 'Code resent' : "Didn't get a code? Resend"}
          </button>
        </div>
      </AuthLayout>
    )
  }

  if (!invitation) return null

  return (
    <AuthLayout>
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--primary)] uppercase tracking-wide mb-3">
          <Building2 className="h-3.5 w-3.5" />
          {invitation.companyName}
        </div>
        <h1 className="text-2xl font-display font-semibold text-[var(--text)] mb-2">You&apos;ve been invited</h1>
        <p className="text-sm text-[var(--text-muted)]">
          {invitation.inviterName} invited you to join {invitation.companyName} as{' '}
          {invitation.roleKeys.map(tenantRoleLabel).join(', ')}. Set up your account below.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border bg-status-error/10 border-status-error/30 text-status-error p-4 mb-6 flex gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleAccept} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-[var(--text)]">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={invitation.email}
            disabled
            className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg bg-[var(--surface-raised)] text-[var(--text-muted)]"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="fullName" className="block text-sm font-medium text-[var(--text)]">
            Full name
          </label>
          <div className="relative">
            <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] pointer-events-none" />
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
              placeholder="Jane Doe"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-[var(--text)]">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pr-10 px-4 py-2.5 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
              placeholder="••••••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1">
            {getPasswordRequirements(invitation.minPasswordLength).map((req) => {
              const met = req.check(password)
              return (
                <div key={req.id} className="flex items-center gap-1.5 text-[11px]">
                  <div
                    className={`h-3 w-3 rounded-full flex items-center justify-center flex-shrink-0 ${
                      met ? 'bg-[var(--primary)]' : 'border border-[var(--border)]'
                    }`}
                  >
                    {met && <span className="text-white text-[8px]">✓</span>}
                  </div>
                  <span className={met ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}>{req.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--text)]">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`w-full px-4 py-2.5 border rounded-lg bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:ring-2 ${
              confirmPassword
                ? passwordsMatch
                  ? 'border-status-success focus:ring-status-success/40'
                  : 'border-status-error focus:ring-status-error/40'
                : 'border-[var(--border)] focus:ring-[var(--primary)]/50'
            }`}
          />
        </div>

        <button
          type="submit"
          disabled={fullName.trim().length < 2 || !passwordValid || !passwordsMatch || loading}
          className="w-full h-10 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Create account
        </button>
      </form>
    </AuthLayout>
  )
}

export default function AcceptInvitationPage() {
  return (
    <Suspense>
      <AcceptInvitationForm />
    </Suspense>
  )
}
