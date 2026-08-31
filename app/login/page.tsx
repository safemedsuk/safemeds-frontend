/**
 * Sign In Page
 * Email + password authentication with server-driven account lockout
 */

'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, AlertTriangle, Lock, Mail, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
import { AuthLayout } from '@/components/layout/auth-layout'
import { useAuthStore } from '@/lib/store/auth-store'
import { ApiRequestError } from '@/lib/api/client'
import { login, type LoginSuccessResult } from '@/lib/api/auth'
import { challengeMfa } from '@/lib/api/mfa'

type ErrorType = 'INVALID_CREDENTIALS' | 'ACCOUNT_DEACTIVATED' | 'COMPANY_SUSPENDED' | 'ACCOUNT_LOCKED' | null

interface ErrorDisplay {
  type: ErrorType
  message: string
  details?: string
}

const ERROR_COPY: Record<Exclude<ErrorType, null>, { message: string; details: string }> = {
  INVALID_CREDENTIALS: {
    message: 'Sign in unsuccessful',
    details: 'The email or password you entered is incorrect. Please try again.',
  },
  ACCOUNT_DEACTIVATED: {
    message: 'Account deactivated',
    details: 'This account has been deactivated. Contact your administrator for assistance.',
  },
  COMPANY_SUSPENDED: {
    message: 'Company account suspended',
    details: 'Your company account has been suspended. Contact support for more information.',
  },
  ACCOUNT_LOCKED: {
    message: 'Account locked',
    details: 'Too many failed sign-in attempts. Try again once the lockout period ends.',
  },
}

const ERROR_STYLES: Record<Exclude<ErrorType, null>, string> = {
  INVALID_CREDENTIALS: 'bg-status-error/10 border-status-error/30 text-status-error',
  ACCOUNT_DEACTIVATED: 'bg-status-warning/10 border-status-warning/30 text-status-warning',
  COMPANY_SUSPENDED: 'bg-status-error/10 border-status-error/30 text-status-error',
  ACCOUNT_LOCKED: 'bg-status-warning/10 border-status-warning/30 text-status-warning',
}

export default function LoginPage() {
  const router = useRouter()
  const { setCurrentUser, setSecurityPolicy, setIsAuthenticated, setMfaEnabled, lockoutUntil, setLockoutUntil } =
    useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [keepSignedIn, setKeepSignedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ErrorDisplay | null>(null)
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)
  const [now, setNow] = useState(() => new Date())

  // MFA challenge step — set once /auth/login responds with mfaRequired:true.
  const [mfaPendingToken, setMfaPendingToken] = useState<string | null>(null)
  const [mfaPendingExpiresAt, setMfaPendingExpiresAt] = useState<Date | null>(null)
  const [mfaAttemptsRemaining, setMfaAttemptsRemaining] = useState<number | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [useRecoveryCode, setUseRecoveryCode] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState('')

  const isLockedOut = Boolean(lockoutUntil) && new Date(lockoutUntil!) > now
  const mfaSecondsLeft = mfaPendingExpiresAt ? Math.max(0, Math.ceil((mfaPendingExpiresAt.getTime() - now.getTime()) / 1000)) : null
  const mfaSessionExpired = mfaSecondsLeft === 0

  const resetMfaChallenge = () => {
    setMfaPendingToken(null)
    setMfaPendingExpiresAt(null)
    setMfaAttemptsRemaining(null)
    setMfaCode('')
    setRecoveryCode('')
  }

  // Live countdown while locked out or mid MFA-challenge, so the user
  // watches time actually run out instead of guessing and getting an
  // unexplained failure.
  useEffect(() => {
    if (!isLockedOut && !mfaPendingToken) return
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [isLockedOut, mfaPendingToken])

  // The pending session is still technically alive server-side for a
  // moment after the countdown UI hits zero (clock skew) — bounce back to
  // a fresh login rather than let the user submit into a near-certain
  // MFA_PENDING_TOKEN_INVALID.
  useEffect(() => {
    if (!mfaSessionExpired) return
    setError({ type: null, message: 'Verification window expired', details: 'Please sign in again.' })
    resetMfaChallenge()
  }, [mfaSessionExpired])

  const finishLogin = (result: LoginSuccessResult, cameFromMfaChallenge: boolean) => {
    setLockoutUntil(null)
    setAttemptsRemaining(null)
    setCurrentUser(result.user)
    setSecurityPolicy(result.securityPolicy)
    setMfaEnabled(cameFromMfaChallenge)
    setIsAuthenticated(true)

    if (result.user.mustChangePassword) {
      router.push('/settings?forceChangePassword=1')
    } else if (result.mfaSetupRequired) {
      router.push('/settings?forceMfaSetup=1')
    } else {
      router.push(result.user.platformRole ? '/admin' : '/tasks')
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const result = await login(email, password)

      if (result.mfaRequired) {
        setMfaPendingToken(result.mfaPendingToken)
        // Guard against a malformed/missing TTL from the API rather than
        // silently propagating NaN through Date arithmetic into the
        // countdown display — falls back to the backend's own default
        // pending-session window (5 minutes) if the field is ever absent.
        const ttlSeconds = Number.isFinite(result.mfaPendingExpiresInSeconds) ? result.mfaPendingExpiresInSeconds : 300
        setMfaPendingExpiresAt(new Date(Date.now() + ttlSeconds * 1000))
        setMfaAttemptsRemaining(null)
      } else {
        finishLogin(result, false)
      }
    } catch (err) {
      if (err instanceof ApiRequestError) {
        const code = err.code as ErrorType

        if (code === 'ACCOUNT_LOCKED') {
          const details = err.details as { unlockAt?: string } | undefined
          setLockoutUntil(details?.unlockAt ?? null)
          setAttemptsRemaining(null)
        } else if (code === 'INVALID_CREDENTIALS') {
          const details = err.details as { attemptsRemaining?: number } | undefined
          setAttemptsRemaining(typeof details?.attemptsRemaining === 'number' ? details.attemptsRemaining : null)
        } else {
          setAttemptsRemaining(null)
        }

        const copy = code ? ERROR_COPY[code] : undefined
        setError(copy ? { type: code, ...copy } : { type: null, message: 'Sign in failed', details: err.message })
      } else {
        setError({ type: null, message: 'An error occurred', details: 'Please try again later.' })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleMfaChallenge = async (e: FormEvent) => {
    e.preventDefault()
    if (!mfaPendingToken) return
    setError(null)
    setIsLoading(true)

    try {
      const result = await challengeMfa(
        mfaPendingToken,
        useRecoveryCode ? { recoveryCode } : { code: mfaCode },
      )
      finishLogin(result, true)
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.code === 'MFA_PENDING_TOKEN_INVALID') {
          setError({ type: null, message: 'Session expired', details: err.message || 'Please sign in again.' })
          resetMfaChallenge()
        } else {
          const details = err.details as { attemptsRemaining?: number } | undefined
          setMfaAttemptsRemaining(typeof details?.attemptsRemaining === 'number' ? details.attemptsRemaining : null)
          setError({ type: null, message: 'Verification failed', details: err.message })
          setMfaCode('')
        }
      } else {
        setError({ type: null, message: 'An error occurred', details: 'Please try again later.' })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const formatCountdown = (totalSeconds: number) => {
    if (!Number.isFinite(totalSeconds)) return '--:--'
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const countdownLabel = (() => {
    if (!lockoutUntil) return ''
    const remainingMs = new Date(lockoutUntil).getTime() - now.getTime()
    return remainingMs <= 0 ? '0:00' : formatCountdown(Math.ceil(remainingMs / 1000))
  })()

  const mfaCountdownLabel = mfaSecondsLeft !== null ? formatCountdown(mfaSecondsLeft) : ''
  const mfaCountdownIsLow = mfaSecondsLeft !== null && mfaSecondsLeft <= 30

  const renderErrorMessage = () => {
    if (!error) return null

    const style = error.type ? ERROR_STYLES[error.type] : 'bg-status-error/10 border-status-error/30 text-status-error'

    return (
      <div className={`rounded-lg border ${style} p-4 mb-6 flex gap-3`}>
        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-sm mb-1">{error.message}</h3>
          {error.details && <p className="text-sm opacity-90">{error.details}</p>}
        </div>
      </div>
    )
  }

  if (mfaPendingToken) {
    return (
      <AuthLayout>
        <div className="mb-8 flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-3 mb-1">
              <h1 className="text-2xl font-display font-semibold text-[var(--text)]">Two-factor verification</h1>
              {mfaCountdownLabel && (
                <span
                  className={`font-mono text-sm tabular-nums rounded-full px-2.5 py-1 border ${
                    mfaCountdownIsLow
                      ? 'text-status-error bg-status-error/10 border-status-error/30'
                      : 'text-[var(--text-muted)] bg-[var(--bg-secondary)] border-[var(--border)]'
                  }`}
                  title="Time left before you need to sign in again"
                >
                  {mfaCountdownLabel}
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              {useRecoveryCode
                ? 'Enter one of your unused recovery codes.'
                : 'Enter the 6-digit code from your authenticator app.'}
            </p>
          </div>
        </div>

        {renderErrorMessage()}

        {mfaAttemptsRemaining !== null && mfaAttemptsRemaining > 0 && (
          <div className="rounded-lg border bg-status-warning/10 border-status-warning/30 text-status-warning p-3 mb-6 flex gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              {mfaAttemptsRemaining} attempt{mfaAttemptsRemaining === 1 ? '' : 's'} left before you&apos;ll need to
              sign in again.
            </span>
          </div>
        )}

        <form onSubmit={handleMfaChallenge} className="space-y-5">
          {useRecoveryCode ? (
            <div className="space-y-2">
              <label htmlFor="recoveryCode" className="block text-sm font-medium text-[var(--text)]">
                Recovery code
              </label>
              <input
                id="recoveryCode"
                type="text"
                autoComplete="off"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value.trim())}
                disabled={isLoading}
                placeholder="XXXXX-XXXXX"
                className="w-full text-center tracking-widest font-mono px-4 py-3 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label htmlFor="mfaCode" className="block text-sm font-medium text-[var(--text)]">
                Authentication code
              </label>
              <input
                id="mfaCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={isLoading}
                placeholder="000000"
                maxLength={6}
                className="w-full text-center text-2xl tracking-[0.5em] font-mono px-4 py-3 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || (useRecoveryCode ? recoveryCode.length === 0 : mfaCode.length !== 6)}
            className="w-full h-10 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Verify
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-[var(--border)] space-y-3 text-center">
          <button
            type="button"
            onClick={() => {
              setUseRecoveryCode(!useRecoveryCode)
              setError(null)
            }}
            className="text-sm text-[var(--primary)] hover:opacity-90 font-medium"
          >
            {useRecoveryCode ? 'Use authenticator code instead' : "Can't access your authenticator? Use a recovery code"}
          </button>
          <div>
            <button
              type="button"
              onClick={() => {
                resetMfaChallenge()
                setError(null)
              }}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-display font-semibold text-[var(--text)] mb-2">Sign in</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Access your compliance management platform
        </p>
      </div>

      {/* Error Messages */}
      {renderErrorMessage()}

      {/* Attempts-remaining warning — escalates in tone as the count drops */}
      {!isLockedOut && attemptsRemaining !== null && attemptsRemaining > 0 && (
        <div
          className={`rounded-lg border p-4 mb-6 flex gap-3 ${
            attemptsRemaining <= 2
              ? 'bg-status-error/10 border-status-error/30 text-status-error'
              : 'bg-status-warning/10 border-status-warning/30 text-status-warning'
          }`}
        >
          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-sm mb-1">
              {attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'} remaining
            </p>
            <p className="text-sm opacity-90">
              {attemptsRemaining === 1
                ? 'One more incorrect attempt will lock your account for 15 minutes.'
                : `Your account will be locked for 15 minutes after ${attemptsRemaining} more failed attempts.`}
            </p>
          </div>
        </div>
      )}

      {/* Locked Out State */}
      {isLockedOut && (
        <div className="bg-status-warning/10 border border-status-warning/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-status-warning font-semibold mb-2">Account temporarily locked</p>
          <p className="text-xs text-[var(--text-muted)] mb-3">
            Too many failed sign-in attempts. For your security, this account is locked until the countdown below
            reaches zero.
          </p>
          <p className="font-mono text-2xl text-status-warning tabular-nums">{countdownLabel}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email */}
        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-[var(--text)]">
            Work email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] pointer-events-none" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLockedOut || isLoading}
              className="w-full pl-10 pr-4 py-2.5 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="you@company.com"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-[var(--text)]">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] pointer-events-none" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLockedOut || isLoading}
              className="w-full pl-10 pr-10 py-2.5 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="••••••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLockedOut || isLoading}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Keep signed in */}
        <div className="flex items-center gap-2">
          <input
            id="keep-signed-in"
            type="checkbox"
            checked={keepSignedIn}
            onChange={(e) => setKeepSignedIn(e.target.checked)}
            disabled={isLockedOut || isLoading}
            className="h-4 w-4 rounded border-[var(--border)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <label htmlFor="keep-signed-in" className="text-sm text-[var(--text)] cursor-pointer select-none">
            Keep me signed in on this device
          </label>
        </div>

        {keepSignedIn && (
          <p className="text-xs text-status-warning bg-status-warning/10 border border-status-warning/30 rounded-lg p-3">
            ⚠ Shared workstations should not use this option. Ensure only you use this device before enabling.
          </p>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLockedOut || isLoading}
          className="w-full h-10 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLockedOut ? 'Account Locked' : 'Sign in'}
        </button>
      </form>

      {/* Footer Links */}
      <div className="mt-6 pt-6 border-t border-[var(--border)] space-y-3">
        <a
          href="/forgot-password"
          className="block text-center text-sm text-[var(--primary)] hover:opacity-90 font-medium"
        >
          Forgot your password?
        </a>
        <div className="text-center text-xs text-[var(--text-muted)]">
          New to SafeMeds?{' '}
          <a href="/register" className="text-[var(--primary)] hover:opacity-90 font-medium">
            Register your company
          </a>
        </div>
      </div>
    </AuthLayout>
  )
}
