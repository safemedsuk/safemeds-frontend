'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, AlertCircle, CheckCircle2, Loader } from 'lucide-react'
import { AuthLayout } from '@/components/layout/auth-layout'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState(1) // 1: request, 2: code entry, 3: reset, 4: success
  const [email, setEmail] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const isPasswordValid = newPassword.length >= 12 && /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) && /\d/.test(newPassword) && /[!@#$%^&*]/.test(newPassword)
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      if (!isEmailValid) {
        setError('Please enter a valid email address')
        return
      }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800))
      setSuccess('Verification code sent to your email')
      setStep(2)
    } catch (err) {
      setError('Failed to send reset code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (verificationCode.length !== 6) {
        setError('Please enter a 6-digit code')
        return
      }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800))
      setSuccess('Code verified. Please set a new password.')
      setStep(3)
    } catch (err) {
      setError('Invalid verification code')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (!isPasswordValid) {
        setError('Password does not meet security requirements')
        return
      }

      if (!passwordsMatch) {
        setError('Passwords do not match')
        return
      }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      setSuccess('Password reset successful')
      setStep(4)
    } catch (err) {
      setError('Failed to reset password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className="w-full space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">
            {step === 1 && 'Reset Your Password'}
            {step === 2 && 'Verify Email'}
            {step === 3 && 'Set New Password'}
            {step === 4 && 'Password Reset Complete'}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {step === 1 && 'Enter your email address to receive a reset code'}
            {step === 2 && `We sent a code to ${email}`}
            {step === 3 && 'Create a strong new password for your account'}
            {step === 4 && 'Your password has been reset successfully'}
          </p>
        </div>

        {/* Step 1: Request Reset */}
        {step === 1 && (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="john@pharmatech.com"
                autoComplete="email"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-safemeds-teal/50 focus:border-safemeds-teal"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-status-error/10 border border-status-error text-status-error text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!isEmailValid || loading}
              className="w-full px-4 py-2 rounded-lg bg-safemeds-teal hover:bg-safemeds-teal/90 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Reset Code'
              )}
            </button>
          </form>
        )}

        {/* Step 2: Verify Code */}
        {step === 2 && (
          <form onSubmit={handleVerifyCode} className="space-y-6 text-center">
            <div className="p-4 rounded-lg bg-card border border-border">
              <p className="text-xs text-muted-foreground mb-3">Enter the 6-digit code:</p>
              <input
                type="text"
                value={verificationCode}
                onChange={e => setVerificationCode(e.target.value.slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                autoComplete="one-time-code"
                className="w-full text-center text-3xl tracking-widest px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-safemeds-teal/50 focus:border-safemeds-teal font-mono"
              />
            </div>

            <p className="text-sm text-muted-foreground">
              Didn&apos;t receive the code?{' '}
              <button
                type="button"
                onClick={() => setSuccess('Code resent to your email')}
                className="text-safemeds-teal hover:underline font-medium"
              >
                Resend
              </button>
            </p>

            {error && (
              <div className="p-3 rounded-lg bg-status-error/10 border border-status-error text-status-error text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mx-auto" />
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 rounded-lg bg-status-success/10 border border-status-success text-status-success text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 mx-auto" />
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={verificationCode.length !== 6 || loading}
              className="w-full px-4 py-2 rounded-lg bg-safemeds-teal hover:bg-safemeds-teal/90 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Code'
              )}
            </button>
          </form>
        )}

        {/* Step 3: Reset Password */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter secure password"
                  autoComplete="new-password"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-safemeds-teal/50 focus:border-safemeds-teal pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>

              {/* Password requirements */}
              <div className="mt-3 space-y-2">
                {[
                  { label: 'At least 12 characters', check: newPassword.length >= 12 },
                  { label: 'Contains uppercase letter', check: /[A-Z]/.test(newPassword) },
                  { label: 'Contains lowercase letter', check: /[a-z]/.test(newPassword) },
                  { label: 'Contains number', check: /\d/.test(newPassword) },
                  { label: 'Contains special character', check: /[!@#$%^&*]/.test(newPassword) },
                ].map((req, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div
                      className={`h-4 w-4 rounded border flex items-center justify-center ${
                        req.check ? 'bg-status-success border-status-success' : 'border-border bg-transparent'
                      }`}
                    >
                      {req.check && <span className="text-white text-xs">✓</span>}
                    </div>
                    <span className={req.check ? 'text-status-success' : 'text-muted-foreground'}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Confirm Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                autoComplete="new-password"
                className={`w-full px-3 py-2 border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                  confirmPassword
                    ? passwordsMatch
                      ? 'border-status-success focus:ring-status-success/50 focus:border-status-success'
                      : 'border-status-error focus:ring-status-error/50 focus:border-status-error'
                    : 'border-border focus:ring-safemeds-teal/50 focus:border-safemeds-teal'
                }`}
              />
              {confirmPassword && !passwordsMatch && (
                <p className="mt-1 text-xs text-status-error">Passwords do not match</p>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-status-error/10 border border-status-error text-status-error text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!isPasswordValid || !passwordsMatch || loading}
              className="w-full px-4 py-2 rounded-lg bg-safemeds-teal hover:bg-safemeds-teal/90 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
            </button>
          </form>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-status-success/10 border-2 border-status-success flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-status-success" />
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Your password has been successfully reset. You can now sign in with your new password.
            </p>

            <button
              onClick={() => router.push('/login')}
              className="w-full px-4 py-2 rounded-lg bg-safemeds-teal hover:bg-safemeds-teal/90 text-white font-medium transition-colors"
            >
              Go to Login
            </button>
          </div>
        )}

        {/* Back button */}
        <button
          onClick={() => {
            if (step > 1) {
              setStep(step - 1)
              setError(null)
            } else {
              router.push('/login')
            }
          }}
          className="flex items-center gap-2 text-safemeds-teal hover:underline font-medium text-sm"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to {step === 1 ? 'Login' : 'Previous Step'}
        </button>
      </div>
    </AuthLayout>
  )
}
