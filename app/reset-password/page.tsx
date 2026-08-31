'use client'

import { Suspense, useState, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Lock } from 'lucide-react'
import { AuthLayout } from '@/components/layout/auth-layout'
import { ApiRequestError, getErrorMessage } from '@/lib/api/client'
import { resetPassword } from '@/lib/api/password'
import { getPasswordRequirements, isPasswordValid } from '@/lib/password-requirements'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const passwordValid = isPasswordValid(newPassword)
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!token || !passwordValid || !passwordsMatch) return
    setError(null)
    setLoading(true)

    try {
      await resetPassword(token, newPassword)
      setDone(true)
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(
          err.code === 'RESET_TOKEN_INVALID'
            ? 'This reset link is invalid or has expired. Request a new one.'
            : getErrorMessage(err, 'Something went wrong. Please try again.'),
        )
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <AuthLayout>
        <div className="space-y-4 text-center">
          <h1 className="text-2xl font-display font-semibold text-[var(--text)]">Invalid reset link</h1>
          <p className="text-sm text-[var(--text-muted)]">
            This password reset link is missing its token. Request a new one from the forgot-password page.
          </p>
          <a href="/forgot-password" className="inline-block text-sm text-[var(--primary)] hover:opacity-90 font-medium">
            Request a new link
          </a>
        </div>
      </AuthLayout>
    )
  }

  if (done) {
    return (
      <AuthLayout>
        <div className="space-y-6 text-center">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-full bg-[var(--primary)]/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-[var(--primary)]" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-display font-semibold text-[var(--text)] mb-2">Password reset</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Your password has been changed and all other sessions have been signed out. You can now sign in with
              your new password.
            </p>
          </div>
          <button
            onClick={() => router.push('/login')}
            className="w-full h-10 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium rounded-lg transition-colors"
          >
            Go to sign in
          </button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-display font-semibold text-[var(--text)] mb-2">Set a new password</h1>
        <p className="text-sm text-[var(--text-muted)]">Choose a strong password you haven&apos;t used before.</p>
      </div>

      {error && (
        <div className="rounded-lg border bg-status-error/10 border-status-error/30 text-status-error p-4 mb-6 flex gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="newPassword" className="block text-sm font-medium text-[var(--text)]">
            New password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] pointer-events-none" />
            <input
              id="newPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              className="w-full pl-10 pr-10 py-2.5 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] disabled:opacity-50"
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

          <div className="mt-3 space-y-1.5">
            {getPasswordRequirements().map((req) => {
              const met = req.check(newPassword)
              return (
                <div key={req.id} className="flex items-center gap-2 text-xs">
                  <div
                    className={`h-3.5 w-3.5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      met ? 'bg-[var(--primary)]' : 'border border-[var(--border)]'
                    }`}
                  >
                    {met && <span className="text-white text-[9px]">✓</span>}
                  </div>
                  <span className={met ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}>{req.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--text)]">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            className={`w-full px-4 py-2.5 border rounded-lg bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:ring-2 disabled:opacity-50 ${
              confirmPassword
                ? passwordsMatch
                  ? 'border-status-success focus:ring-status-success/40 focus:border-status-success'
                  : 'border-status-error focus:ring-status-error/40 focus:border-status-error'
                : 'border-[var(--border)] focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]'
            }`}
            placeholder="••••••••••••"
          />
          {confirmPassword && !passwordsMatch && <p className="text-xs text-status-error">Passwords do not match</p>}
        </div>

        <button
          type="submit"
          disabled={!passwordValid || !passwordsMatch || loading}
          className="w-full h-10 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Reset password
        </button>
      </form>
    </AuthLayout>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
