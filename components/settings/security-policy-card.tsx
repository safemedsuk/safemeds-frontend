'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react'
import { ApiRequestError } from '@/lib/api/client'
import { getSecurityPolicy, updateSecurityPolicy, type SecurityPolicy } from '@/lib/api/security-policy'
import { usePermissions } from '@/lib/hooks/use-permissions'

export function SecurityPolicyCard() {
  const { has } = usePermissions()
  const canManage = has('security_policy.manage')
  const [policy, setPolicy] = useState<SecurityPolicy | null>(null)
  const [minPasswordLength, setMinPasswordLength] = useState(12)
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(30)
  const [mfaRequiredForSignatureRoles, setMfaRequiredForSignatureRoles] = useState(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getSecurityPolicy()
      setPolicy(data)
      setMinPasswordLength(data.minPasswordLength)
      setSessionTimeoutMinutes(data.sessionTimeoutMinutes)
      setMfaRequiredForSignatureRoles(data.mfaRequiredForSignatureRoles)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load the security policy.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const dirty =
    policy !== null &&
    (minPasswordLength !== policy.minPasswordLength ||
      sessionTimeoutMinutes !== policy.sessionTimeoutMinutes ||
      mfaRequiredForSignatureRoles !== policy.mfaRequiredForSignatureRoles)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const updated = await updateSecurityPolicy({ minPasswordLength, sessionTimeoutMinutes, mfaRequiredForSignatureRoles })
      setPolicy(updated)
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save the security policy.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 flex items-center justify-center text-[var(--text-muted)] text-sm">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading policy…
      </div>
    )
  }

  if (!policy) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">
        {error ?? 'Security policy unavailable.'}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2 text-sm">
        <ShieldAlert className="h-4 w-4" />
        Security Policy
      </h3>
      <p className="text-xs text-[var(--text-muted)] mb-4">Applies to every user in your company</p>

      {error && (
        <div className="mb-3 p-2.5 rounded-lg bg-status-error/10 border border-status-error text-status-error text-xs flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="flex items-center justify-between text-xs font-medium text-[var(--text)] mb-1.5">
            <span>Minimum password length</span>
            <span className="font-mono">{minPasswordLength}</span>
          </label>
          <input
            type="range"
            min={12}
            max={24}
            value={minPasswordLength}
            onChange={(e) => setMinPasswordLength(Number(e.target.value))}
            disabled={!canManage}
            className="w-full accent-[var(--primary)] disabled:opacity-50"
          />
          <p className="text-[10px] text-[var(--text-muted)] mt-1">Platform floor is 12 characters.</p>
        </div>

        <div>
          <label className="flex items-center justify-between text-xs font-medium text-[var(--text)] mb-1.5">
            <span>Session timeout</span>
            <span className="font-mono">{sessionTimeoutMinutes} min</span>
          </label>
          <input
            type="range"
            min={5}
            max={120}
            step={5}
            value={sessionTimeoutMinutes}
            onChange={(e) => setSessionTimeoutMinutes(Number(e.target.value))}
            disabled={!canManage}
            className="w-full accent-[var(--primary)] disabled:opacity-50"
          />
        </div>

        <label className={`flex items-start gap-2.5 ${canManage ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
          <input
            type="checkbox"
            checked={mfaRequiredForSignatureRoles}
            onChange={(e) => setMfaRequiredForSignatureRoles(e.target.checked)}
            disabled={!canManage}
            className="h-4 w-4 mt-0.5 rounded border-[var(--border)]"
          />
          <span className="text-xs text-[var(--text)]">
            Require MFA for signature-gated roles
            <span className="block text-[10px] text-[var(--text-muted)] mt-0.5">
              QPPV, Quality Manager, and Regulatory Affairs Officer will be prompted to set up MFA on next sign-in.
            </span>
          </span>
        </label>

        {!canManage && (
          <p className="text-[10px] text-[var(--text-muted)] italic">Only a System Administrator can change these settings.</p>
        )}

        {canManage && (
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="w-full h-8 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {saved && !dirty && !saving ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" /> Saved
            </>
          ) : (
            'Save changes'
          )}
        </button>
        )}
      </div>
    </div>
  )
}
