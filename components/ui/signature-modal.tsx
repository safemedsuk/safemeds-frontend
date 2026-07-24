'use client'

import { useState } from 'react'
import { X, Check, AlertCircle, Eye, EyeOff } from 'lucide-react'

interface SignatureModalProps {
  isOpen: boolean
  onClose: () => void
  onSign: (intent: string, password: string) => void
  documentTitle: string
  documentId: string
}

export function SignatureModal({
  isOpen,
  onClose,
  onSign,
  documentTitle,
  documentId,
}: SignatureModalProps) {
  const [intent, setIntent] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreeToTerms, setAgreeToTerms] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isFormValid = intent.trim().length > 0 && password.length >= 8 && agreeToTerms

  const handleSubmit = async () => {
    if (!isFormValid) return

    setError('')
    setIsSubmitting(true)

    // Simulate API call
    setTimeout(() => {
      try {
        onSign(intent, password)
        setIntent('')
        setPassword('')
        setAgreeToTerms(false)
        setIsSubmitting(false)
      } catch (err) {
        setError('Failed to sign document. Please try again.')
        setIsSubmitting(false)
      }
    }, 1500)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-display font-bold text-lg text-foreground">Electronic Signature</h2>
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
              Document to Sign
            </p>
            <div>
              <p className="font-medium text-foreground text-sm">{documentTitle}</p>
              <p className="text-xs text-muted-foreground font-mono mt-1">{documentId}</p>
            </div>
          </div>

          {/* Intent */}
          <div>
            <label className="text-sm font-semibold text-foreground block mb-2">
              Intent to Sign
            </label>
            <textarea
              value={intent}
              onChange={e => setIntent(e.target.value)}
              placeholder="I confirm that I have reviewed and approved this document."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-safemeds-teal"
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1">Explain why you are signing this document</p>
          </div>

          {/* Password */}
          <div>
            <label className="text-sm font-semibold text-foreground block mb-2">
              Password Verification
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
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
            <p className="text-xs text-muted-foreground mt-1">Minimum 8 characters</p>
          </div>

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
              I understand that this electronic signature is legally binding and equivalent to my
              handwritten signature. This document will be stored in our secure audit trail.
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-status-error/10 px-3 py-2">
              <AlertCircle className="h-4 w-4 text-status-error flex-shrink-0" />
              <p className="text-xs text-status-error">{error}</p>
            </div>
          )}

          {/* Info Box */}
          <div className="rounded-lg border border-safemeds-teal/30 bg-safemeds-teal/5 p-3">
            <p className="text-xs text-foreground">
              <span className="font-semibold">Legal Notice:</span> By signing, you confirm that you
              have the authority to execute this agreement and accept all terms and conditions.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                Signing...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Sign Document
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
