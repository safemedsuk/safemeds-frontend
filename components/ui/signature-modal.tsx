'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Check, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { reauth } from '@/lib/api/auth'
import { ApiRequestError, getErrorMessage } from '@/lib/api/client'
import { useAuthStore } from '@/lib/store/auth-store'
import { useTranslation } from '@/lib/i18n/use-translation'

interface SignatureModalProps {
  isOpen: boolean
  onClose: () => void
  /**
   * Called once re-authentication succeeds, with the resulting single-use
   * signature-grade token — the caller is responsible for the actual
   * signing action (e.g. `postTransition(instanceId, toStateKey, {
   * signatureToken, intentStatement })`), since what gets signed differs
   * per record type. If this rejects, its message is shown inline and the
   * modal stays open so the user can retry.
   */
  onSigned: (params: { intentStatement: string; signatureToken: string }) => Promise<void>
  documentTitle: string
  documentId: string
}

export function SignatureModal({
  isOpen,
  onClose,
  onSigned,
  documentTitle,
  documentId,
}: SignatureModalProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const mfaEnabled = useAuthStore((s) => s.mfaEnabled)
  const [intent, setIntent] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreeToTerms, setAgreeToTerms] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  // testing-todo Stage 12.1 — the system already knows whether this
  // account has MFA active (`useAuthStore().mfaEnabled`, set at login
  // and kept live by the Settings MFA section) before this modal ever
  // opens, so the code field shows up front for an MFA account instead
  // of round-tripping a guaranteed `MFA_CODE_REQUIRED` failure first.
  // Still corrected reactively from the backend's own response below —
  // `mfaEnabled` is a UX head start, not the source of truth.
  const [mfaCodeRequired, setMfaCodeRequired] = useState(mfaEnabled)
  const [mfaSetupRequired, setMfaSetupRequired] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setMfaCodeRequired(mfaEnabled)
    }
  }, [isOpen, mfaEnabled])

  const isFormValid =
    intent.trim().length > 0 &&
    password.length >= 8 &&
    agreeToTerms &&
    !mfaSetupRequired &&
    (!mfaCodeRequired || mfaCode.trim().length === 6)

  const handleSubmit = async () => {
    if (!isFormValid) return

    setError('')
    setIsSubmitting(true)

    try {
      // Step 1: re-authenticate (Phase 1.9) — proves presence right now,
      // independent of the existing session cookie, and mints a 5-minute
      // single-use token that only a signing action can consume.
      const { signatureToken } = await reauth(password, mfaCodeRequired ? mfaCode : undefined)

      // Step 2: the caller performs the actual signed action with that
      // token. On success, the intent/password/terms all reset and the
      // modal closes — on failure (wrong password, or the signing action
      // itself rejects for an unrelated reason), the error surfaces here
      // and the modal stays open so the user isn't forced to re-enter
      // their intent statement over a transient failure.
      await onSigned({ intentStatement: intent, signatureToken })

      setIntent('')
      setPassword('')
      setMfaCode('')
      setMfaCodeRequired(false)
      setAgreeToTerms(false)
      onClose()
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'MFA_CODE_REQUIRED') {
        setMfaCodeRequired(true)
        setError(t('signature.errorMfaCodeRequired'))
      } else if (err instanceof ApiRequestError && err.code === 'MFA_SETUP_REQUIRED') {
        setMfaSetupRequired(true)
        setError(t('signature.errorMfaSetupRequired'))
      } else if (err instanceof ApiRequestError && err.code === 'REAUTH_FAILED' && mfaCodeRequired) {
        setError(t('signature.errorIncorrectPasswordOrCode'))
        setMfaCode('')
      } else {
        setError(getErrorMessage(err, t('signature.errorGeneric')))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-display font-bold text-lg text-foreground">{t('signature.title')}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 px-6 py-4">
          {/* Document Info */}
          <div className="rounded-lg bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              {t('signature.documentToSign')}
            </p>
            <div>
              <p className="font-medium text-foreground text-sm">{documentTitle}</p>
              <p className="text-xs text-muted-foreground font-mono mt-1">{documentId}</p>
            </div>
          </div>

          {/* Intent */}
          <div>
            <label className="text-sm font-semibold text-foreground block mb-2">
              {t('signature.intentToSign')}
            </label>
            <textarea
              value={intent}
              onChange={e => setIntent(e.target.value)}
              placeholder={t('signature.intentPlaceholder')}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-safemeds-teal"
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1">{t('signature.intentHelp')}</p>
          </div>

          {/* Password */}
          <div>
            <label className="text-sm font-semibold text-foreground block mb-2">
              {t('signature.passwordVerification')}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={t('signature.passwordPlaceholder')}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-safemeds-teal"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('signature.passwordHelp')}</p>
          </div>

          {/* MFA code — only shown once the backend tells us this account actually has one */}
          {mfaCodeRequired && !mfaSetupRequired && (
            <div>
              <label className="text-sm font-semibold text-foreground block mb-2">
                {t('signature.authenticatorCode')}
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={mfaCode}
                onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={t('signature.authenticatorCodePlaceholder')}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground tracking-widest focus:outline-none focus:ring-2 focus:ring-safemeds-teal"
              />
              <p className="text-xs text-muted-foreground mt-1">{t('signature.authenticatorCodeHelp')}</p>
            </div>
          )}

          {mfaSetupRequired && (
            <div className="rounded-lg border border-safemeds-teal/30 bg-safemeds-teal/5 p-3 flex items-start gap-3">
              <ShieldCheck className="h-4 w-4 text-safemeds-teal flex-shrink-0 mt-0.5" />
              <div className="text-xs text-foreground">
                <p className="font-semibold mb-1">{t('signature.mfaRequiredTitle')}</p>
                <p className="mb-2">{t('signature.mfaRequiredBody')}</p>
                <button
                  type="button"
                  onClick={() => router.push('/settings?forceMfaSetup=1')}
                  className="font-medium text-safemeds-teal hover:underline"
                >
                  {t('signature.setUpMfaNow')}
                </button>
              </div>
            </div>
          )}

          {/* Terms */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="terms"
              checked={agreeToTerms}
              onChange={e => setAgreeToTerms(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border accent-safemeds-teal"
            />
            <label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed">
              {t('signature.termsAcknowledgement')}
            </label>
          </div>

          {/* Error — suppressed when mfaSetupRequired, whose own dedicated box above already says this */}
          {error && !mfaSetupRequired && (
            <div className="flex items-center gap-2 rounded-lg bg-status-error/10 px-3 py-2">
              <AlertCircle className="h-4 w-4 text-status-error flex-shrink-0" />
              <p className="text-xs text-status-error">{error}</p>
            </div>
          )}

          {/* Info Box */}
          <div className="rounded-lg border border-safemeds-teal/30 bg-safemeds-teal/5 p-3">
            <p className="text-xs text-foreground">
              <span className="font-semibold">{t('signature.legalNoticeLabel')}</span> {t('signature.legalNoticeBody')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                {t('signature.signing')}
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                {t('signature.signDocument')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
