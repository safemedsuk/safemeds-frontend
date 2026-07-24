/**
 * Sign In Page
 * Email + password authentication with progressive lockout
 */

'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Lock, Mail, Eye, EyeOff, Loader2 } from 'lucide-react'
import { AuthLayout } from '@/components/layout/auth-layout'
import { useAuthStore } from '@/lib/store/auth-store'
import { login } from '@/lib/mock/auth'

type ErrorType = 'invalid_credentials' | 'account_deactivated' | 'company_suspended' | 'account_locked' | 'mfa_required' | null

interface ErrorDisplay {
  type: ErrorType
  message: string
  details?: string
}

export default function LoginPage() {
  const router = useRouter()
  const {
    setCurrentUser,
    setIsAuthenticated,
    setAuthError,
    loginAttempts,
    setLoginAttempts,
    setIsAccountLocked,
    isAccountLocked,
    lockoutUntil,
  } = useAuthStore()

  const [email, setEmail] = useState('james.kipchoge@pharmatech.ke')
  const [password, setPassword] = useState('SecurePass@2024')
  const [showPassword, setShowPassword] = useState(false)
  const [keepSignedIn, setKeepSignedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ErrorDisplay | null>(null)
  const [attemptWarning, setAttemptWarning] = useState(false)

  const isLockedOut = isAccountLocked && lockoutUntil && new Date(lockoutUntil) > new Date()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setAttemptWarning(false)
    setIsLoading(true)

    try {
      const result = await login(email, password)

      if (!result.success) {
        const attempts = loginAttempts + 1
        setLoginAttempts(attempts)

        const errorMap: Record<string, ErrorDisplay> = {
          invalid_credentials: {
            type: 'invalid_credentials',
            message: 'Sign in unsuccessful',
            details: 'The email or password you entered is incorrect. Please try again.',
          },
          account_deactivated: {
            type: 'account_deactivated',
            message: 'Account deactivated',
            details: 'This account has been deactivated. Contact your administrator for assistance.',
          },
          company_suspended: {
            type: 'company_suspended',
            message: 'Company account suspended',
            details: 'Your company account has been suspended. Contact support for more information.',
          },
          account_locked: {
            type: 'account_locked',
            message: 'Account locked',
            details: 'This account has been locked due to multiple failed login attempts. Please try again in 15 minutes.',
          },
        }

        setError(errorMap[result.error] || errorMap.invalid_credentials)

        // Show warning after 3 failed attempts
        if (attempts === 3) {
          setAttemptWarning(true)
        }

        // Lock account after 5 failed attempts
        if (attempts >= 5) {
          setIsAccountLocked(true, new Date(Date.now() + 15 * 60000))
          setError(errorMap.account_locked)
        }
      } else {
        // Successful login
        setLoginAttempts(0)
        setCurrentUser(result.user)
        setIsAuthenticated(true)

        // Navigate based on MFA requirement
        if (result.mfaRequired) {
          router.push('/mfa-challenge')
        } else {
          router.push('/tasks')
        }
      }
    } catch (err) {
      setError({
        type: null,
        message: 'An error occurred',
        details: 'Please try again later.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const renderErrorMessage = () => {
    if (!error) return null

    const errorStyles: Record<ErrorType, string> = {
      invalid_credentials: 'bg-red-50 border-red-200 text-red-900',
      account_deactivated: 'bg-amber-50 border-amber-200 text-amber-900',
      company_suspended: 'bg-red-50 border-red-200 text-red-900',
      account_locked: 'bg-orange-50 border-orange-200 text-orange-900',
      mfa_required: 'bg-blue-50 border-blue-200 text-blue-900',
      null: 'bg-red-50 border-red-200 text-red-900',
    }

    return (
      <div className={`rounded-lg border ${errorStyles[error.type]} p-4 mb-6 flex gap-3`}>
        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-sm mb-1">{error.message}</h3>
          {error.details && <p className="text-sm opacity-90">{error.details}</p>}
        </div>
      </div>
    )
  }

  return (
    <AuthLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-display font-semibold text-foreground mb-2">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Access your compliance management platform
        </p>
      </div>

      {/* Error Messages */}
      {renderErrorMessage()}

      {/* Failed Attempts Warning */}
      {attemptWarning && !isLockedOut && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-sm text-amber-900 mb-1">Multiple failed attempts</h3>
            <p className="text-sm text-amber-800">
              Your account will be locked after {5 - loginAttempts} more unsuccessful attempt{5 - loginAttempts !== 1 ? 's' : ''}.
            </p>
          </div>
        </div>
      )}

      {/* Locked Out State */}
      {isLockedOut && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-orange-900 font-semibold mb-2">Account temporarily locked</p>
          <p className="text-xs text-orange-800 mb-3">
            Your account has been locked for security. Try again after the lockout period expires.
          </p>
          <p className="font-mono text-xs text-orange-600">
            Lockout until: {lockoutUntil?.toLocaleTimeString()}
          </p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email */}
        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-foreground">
            Work email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLockedOut || isLoading}
              className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-safemeds-teal/50 focus:border-safemeds-teal disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="you@company.com"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-foreground">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLockedOut || isLoading}
              className="w-full pl-10 pr-10 py-2.5 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-safemeds-teal/50 focus:border-safemeds-teal disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="••••••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLockedOut || isLoading}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="h-4 w-4 rounded border-border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <label htmlFor="keep-signed-in" className="text-sm text-foreground cursor-pointer select-none">
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
          className="w-full h-10 bg-safemeds-teal hover:bg-safemeds-teal/90 disabled:opacity-50 disabled:cursor-not-allowed text-paper font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLockedOut ? 'Account Locked' : 'Sign in'}
        </button>
      </form>

      {/* Footer Links */}
      <div className="mt-6 pt-6 border-t border-border space-y-3">
        <a
          href="/forgot-password"
          className="block text-center text-sm text-safemeds-teal hover:text-safemeds-teal/90 font-medium"
        >
          Forgot your password?
        </a>
        <div className="text-center text-xs text-muted-foreground">
          New to SafeMeds?{' '}
          <a href="/register" className="text-safemeds-teal hover:text-safemeds-teal/90 font-medium">
            Register your company
          </a>
        </div>
      </div>

      {/* Demo Credentials */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs font-mono text-blue-900 mb-2 font-semibold">Demo Credentials:</p>
        <div className="space-y-1 text-xs font-mono text-blue-800">
          <p>Email: james.kipchoge@pharmatech.ke</p>
          <p>Password: SecurePass@2024</p>
        </div>
      </div>
    </AuthLayout>
  )
}
