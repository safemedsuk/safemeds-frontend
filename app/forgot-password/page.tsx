'use client'

import { useState, FormEvent } from 'react'
import { ChevronLeft, CheckCircle2, Loader2, Mail } from 'lucide-react'
import { AuthLayout } from '@/components/layout/auth-layout'
import { forgotPassword } from '@/lib/api/password'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!isEmailValid) return
    setLoading(true)

    try {
      // The backend always returns 200 regardless of whether the email
      // matches an account — never surface a distinct error here, that
      // would leak account existence.
      await forgotPassword(email)
    } finally {
      setLoading(false)
      setSent(true)
    }
  }

  if (sent) {
    return (
      <AuthLayout>
        <div className="space-y-6 text-center">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-full bg-[var(--primary)]/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-[var(--primary)]" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-display font-semibold text-[var(--text)] mb-2">Check your email</h1>
            <p className="text-sm text-[var(--text-muted)]">
              If an account exists for <span className="font-medium text-[var(--text)]">{email}</span>, a password
              reset link has been sent. The link expires in 30 minutes.
            </p>
          </div>
          <a
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-[var(--primary)] hover:opacity-90 font-medium"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to sign in
          </a>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-display font-semibold text-[var(--text)] mb-2">Reset your password</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Enter your account email and we&apos;ll send you a link to reset your password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
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
              disabled={loading}
              className="w-full pl-10 pr-4 py-2.5 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] disabled:opacity-50"
              placeholder="you@company.com"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!isEmailValid || loading}
          className="w-full h-10 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Send reset link
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-[var(--border)] text-center">
        <a href="/login" className="inline-flex items-center gap-2 text-sm text-[var(--primary)] hover:opacity-90 font-medium">
          <ChevronLeft className="h-4 w-4" />
          Back to sign in
        </a>
      </div>
    </AuthLayout>
  )
}
