'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'
import { ApiRequestError } from '@/lib/api/client'
import { changePassword } from '@/lib/api/password'
import { getSecurityPolicy } from '@/lib/api/security-policy'
import { DEFAULT_MIN_PASSWORD_LENGTH, getPasswordRequirements, isPasswordValid } from '@/lib/password-requirements'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'

export function ChangePasswordSection() {
  const [open, setOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useTimedMessage()
  const [minPasswordLength, setMinPasswordLength] = useState(DEFAULT_MIN_PASSWORD_LENGTH)

  // The company's policy can change at any time (Users & Roles' Security
  // Policy card) — fetch it fresh whenever this section opens rather than
  // once at mount, so the checklist always reflects the current value.
  useEffect(() => {
    if (!open) return
    getSecurityPolicy()
      .then((policy) => setMinPasswordLength(policy.minPasswordLength))
      .catch(() => setMinPasswordLength(DEFAULT_MIN_PASSWORD_LENGTH))
  }, [open])

  const passwordValid = isPasswordValid(newPassword, minPasswordLength)
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword

  const reset = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError(null)
  }

  const handleSubmit = async () => {
    if (!currentPassword || !passwordValid || !passwordsMatch) return
    setError(null)
    setLoading(true)
    try {
      await changePassword(currentPassword, newPassword)
      setSuccess('Password changed. Other sessions have been signed out.')
      reset()
      setOpen(false)
    } catch (err) {
      setError(
        err instanceof ApiRequestError && err.code === 'INVALID_CURRENT_PASSWORD'
          ? 'Current password is incorrect'
          : 'Could not change password. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
            <KeyRound className="h-5 w-5 text-[var(--primary)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text)]">Password</h2>
            <p className="text-xs text-[var(--text-muted)]">Change the password used to sign in</p>
          </div>
        </div>
        {!open && (
          <button
            onClick={() => {
              setOpen(true)
              setSuccess(null)
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-raised)] transition-colors"
          >
            Change password
          </button>
        )}
      </div>

      {success && !open && (
        <div className="m-5 p-3 rounded-lg bg-status-success/10 border border-status-success text-status-success text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {open && (
        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-status-error/10 border border-status-error text-status-error text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-medium text-[var(--text)]">Current password</label>
            <div className="relative">
              <input
                type={showPasswords ? 'text' : 'password'}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full pr-10 px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                {showPasswords ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-[var(--text)]">New password</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
            />
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1">
              {getPasswordRequirements(minPasswordLength).map((req) => {
                const met = req.check(newPassword)
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
            <label className="block text-xs font-medium text-[var(--text)]">Confirm new password</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 ${
                confirmPassword
                  ? passwordsMatch
                    ? 'border-status-success focus:ring-status-success/40'
                    : 'border-status-error focus:ring-status-error/40'
                  : 'border-[var(--border)] focus:ring-[var(--primary)]/50'
              }`}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSubmit}
              disabled={!currentPassword || !passwordValid || !passwordsMatch || loading}
              className="flex-1 h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Save new password
            </button>
            <button
              onClick={() => {
                setOpen(false)
                reset()
              }}
              className="px-4 h-9 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-raised)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
