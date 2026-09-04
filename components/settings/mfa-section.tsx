'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, KeyRound, Loader2, ShieldCheck, ShieldOff } from 'lucide-react'
import { ApiRequestError } from '@/lib/api/client'
import { setupMfa, verifyMfaSetup, disableMfa, regenerateRecoveryCodes, type MfaSetupResult } from '@/lib/api/mfa'
import { useAuthStore } from '@/lib/store/auth-store'

type Mode = 'idle' | 'setup' | 'disable' | 'regenerate'

interface Props {
  autoOpenSetup?: boolean
}

export function MfaSection({ autoOpenSetup }: Props) {
  const { mfaEnabled, setMfaEnabled } = useAuthStore()
  const [mode, setMode] = useState<Mode>(autoOpenSetup ? 'setup' : 'idle')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Setup flow state
  const [setupData, setSetupData] = useState<MfaSetupResult | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)

  // Disable / regenerate flow state (both require password + current MFA code)
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')

  const beginSetup = async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await setupMfa()
      setSetupData(data)
      setMode('setup')
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not start MFA setup')
    } finally {
      setLoading(false)
    }
  }

  // `autoOpenSetup` (from ?forceMfaSetup=1) only sets `mode` to 'setup' up
  // front — it doesn't fetch the QR/secret, so without this the setup
  // panel had nothing to render (it needs `setupData`) while the "Enable
  // MFA" button itself was hidden because `mode !== 'idle'`. Fire the same
  // fetch `beginSetup` does, once, when landing pre-opened.
  useEffect(() => {
    if (!autoOpenSetup) return
    if (mfaEnabled) {
      // Already set up (e.g. this link was opened stale) — nothing to do, fall back to the normal idle view.
      setMode('idle')
      return
    }
    beginSetup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleVerifySetup = async () => {
    if (!setupData || verifyCode.length !== 6) return
    setError(null)
    setLoading(true)
    try {
      const { recoveryCodes: codes } = await verifyMfaSetup(verifyCode)
      setRecoveryCodes(codes)
      setMfaEnabled(true)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const finishSetup = () => {
    setMode('idle')
    setSetupData(null)
    setVerifyCode('')
    setRecoveryCodes(null)
  }

  const handleDisable = async () => {
    if (!password || mfaCode.length !== 6) return
    setError(null)
    setLoading(true)
    try {
      await disableMfa(password, mfaCode)
      setMfaEnabled(false)
      setMode('idle')
      setPassword('')
      setMfaCode('')
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not disable MFA')
    } finally {
      setLoading(false)
    }
  }

  const handleRegenerate = async () => {
    if (!password || mfaCode.length !== 6) return
    setError(null)
    setLoading(true)
    try {
      const { recoveryCodes: codes } = await regenerateRecoveryCodes(password, mfaCode)
      setRecoveryCodes(codes)
      setPassword('')
      setMfaCode('')
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not regenerate recovery codes')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-[var(--primary)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text)]">Multi-Factor Authentication</h2>
            <p className="text-xs text-[var(--text-muted)]">
              {mfaEnabled ? 'Enabled — an authenticator code is required at sign-in' : 'Add an authenticator app for a second sign-in factor'}
            </p>
          </div>
        </div>

        {mode === 'idle' && (
          <div className="flex gap-2">
            {mfaEnabled ? (
              <>
                <button
                  onClick={() => setMode('regenerate')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-raised)] transition-colors flex items-center gap-1.5"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  New recovery codes
                </button>
                <button
                  onClick={() => setMode('disable')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-status-error/30 text-status-error hover:bg-status-error/10 transition-colors flex items-center gap-1.5"
                >
                  <ShieldOff className="h-3.5 w-3.5" />
                  Disable
                </button>
              </>
            ) : (
              <button
                onClick={beginSetup}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Enable MFA
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="m-5 p-3 rounded-lg bg-status-error/10 border border-status-error text-status-error text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Setup flow */}
      {mode === 'setup' && setupData && !recoveryCodes && (
        <div className="p-5 space-y-5">
          <div>
            <p className="text-sm text-[var(--text)] font-medium mb-1">1. Scan this QR code</p>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              Use Google Authenticator, 1Password, or any TOTP app.
            </p>
            <div className="flex flex-col items-center gap-3 p-4 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
              {/* eslint-disable-next-line @next/next/no-img-element -- server-generated data: URI, not an optimizable remote image */}
              <img src={setupData.qrCodeDataUrl} alt="MFA setup QR code" className="h-40 w-40" />
              <p className="text-[11px] text-[var(--text-muted)]">Or enter manually:</p>
              <code className="text-xs font-mono px-3 py-1.5 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] tracking-wider select-all">
                {setupData.secret}
              </code>
            </div>
          </div>

          <div>
            <p className="text-sm text-[var(--text)] font-medium mb-2">2. Enter the 6-digit code</p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="flex-1 text-center text-xl tracking-[0.4em] font-mono px-4 py-2.5 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
              />
              <button
                onClick={handleVerifySetup}
                disabled={verifyCode.length !== 6 || loading}
                className="px-4 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify
              </button>
            </div>
          </div>

          <button
            onClick={() => setMode('idle')}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            Cancel setup
          </button>
        </div>
      )}

      {/* Recovery codes reveal (from either setup or regenerate) */}
      {recoveryCodes && (
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-status-success">
            <CheckCircle2 className="h-4 w-4" />
            <p className="text-sm font-semibold">
              {mode === 'setup' ? 'MFA is now enabled' : 'New recovery codes generated'}
            </p>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Save these recovery codes somewhere safe. Each one can be used once if you lose access to your
            authenticator app. Old codes are no longer valid.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {recoveryCodes.map((code) => (
              <code
                key={code}
                className="text-center text-sm font-mono px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] tracking-wider"
              >
                {code}
              </code>
            ))}
          </div>
          <button
            onClick={finishSetup}
            className="w-full h-10 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium rounded-lg transition-colors"
          >
            I&apos;ve saved these codes
          </button>
        </div>
      )}

      {/* Disable / regenerate — both require password + current MFA code */}
      {(mode === 'disable' || mode === 'regenerate') && !recoveryCodes && (
        <div className="p-5 space-y-4">
          <p className="text-sm text-[var(--text)]">
            {mode === 'disable'
              ? 'Confirm your password and current authenticator code to disable MFA.'
              : 'Confirm your password and current authenticator code to generate new recovery codes.'}
          </p>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[var(--text)]">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[var(--text)]">Authenticator code</label>
            <input
              type="text"
              inputMode="numeric"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="w-full text-center tracking-[0.4em] font-mono px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={mode === 'disable' ? handleDisable : handleRegenerate}
              disabled={!password || mfaCode.length !== 6 || loading}
              className={`flex-1 h-9 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                mode === 'disable'
                  ? 'bg-status-error text-white hover:opacity-90'
                  : 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]'
              }`}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'disable' ? 'Disable MFA' : 'Generate new codes'}
            </button>
            <button
              onClick={() => {
                setMode('idle')
                setPassword('')
                setMfaCode('')
                setError(null)
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
