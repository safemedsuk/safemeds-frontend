'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, Loader, Upload, X } from 'lucide-react'
import { AuthLayout } from '@/components/layout/auth-layout'
import { useAuthStore } from '@/lib/store/auth-store'
import { registerCompany, verifyEmail } from '@/lib/mock/auth'
import { FileUpload } from '@/components/ui/file-upload'

const COUNTRIES = [
  { id: 'us', label: 'United States', code: 'US' },
  { id: 'uk', label: 'United Kingdom', code: 'GB' },
  { id: 'de', label: 'Germany', code: 'DE' },
  { id: 'fr', label: 'France', code: 'FR' },
  { id: 'ca', label: 'Canada', code: 'CA' },
  { id: 'au', label: 'Australia', code: 'AU' },
  { id: 'jp', label: 'Japan', code: 'JP' },
]

const COMPANY_TYPES = [
  { id: 'manufacturer', label: 'Pharmaceutical Manufacturer', icon: '🏭' },
  { id: 'distributor', label: 'Wholesale Distributor', icon: '🚚' },
  { id: 'pharmacy', label: 'Pharmacy/Retail', icon: '💊' },
]

const PASSWORD_REQUIREMENTS = [
  { id: 'length', label: 'At least 12 characters', check: (pwd: string) => pwd.length >= 12 },
  { id: 'uppercase', label: 'Contains uppercase letter', check: (pwd: string) => /[A-Z]/.test(pwd) },
  { id: 'lowercase', label: 'Contains lowercase letter', check: (pwd: string) => /[a-z]/.test(pwd) },
  { id: 'number', label: 'Contains number', check: (pwd: string) => /\d/.test(pwd) },
  { id: 'special', label: 'Contains special character', check: (pwd: string) => /[!@#$%^&*]/.test(pwd) },
]

export default function RegisterPage() {
  const router = useRouter()
  const { setCurrentUser, setIsAuthenticated, setAuthError } = useAuthStore()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Company details (Step 1)
  const [companyName, setCompanyName] = useState('')
  const [companyType, setCompanyType] = useState('')
  const [countryId, setCountryId] = useState('')
  const [licenceNumber, setLicenceNumber] = useState('')
  const [licenseFile, setLicenseFile] = useState<File | null>(null)

  // Admin account (Step 2)
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPhone, setAdminPhone] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)

  // Verification (Step 3)
  const [verificationCode, setVerificationCode] = useState('')

  const passwordStrength = PASSWORD_REQUIREMENTS.filter(req => req.check(adminPassword))
  const isPasswordValid = passwordStrength.length === PASSWORD_REQUIREMENTS.length
  const passwordsMatch = adminPassword === adminPasswordConfirm && adminPassword.length > 0

  const canProceedStep1 = companyName && companyType && countryId && licenceNumber && licenseFile
  const canProceedStep2 =
    adminName &&
    adminEmail &&
    adminPhone &&
    isPasswordValid &&
    passwordsMatch &&
    agreeTerms

  const handleNextStep = async () => {
    setError(null)
    setLoading(true)

    try {
      if (step === 1) {
        // Validate company details
        if (!canProceedStep1) {
          setError('Please fill in all company details')
          setLoading(false)
          return
        }
        setStep(2)
      } else if (step === 2) {
        // Create registration
        if (!canProceedStep2) {
          setError('Please complete all required fields and agree to terms')
          setLoading(false)
          return
        }

        const result = await registerCompany({
          companyName,
          companyType: companyType as 'manufacturer' | 'distributor' | 'pharmacy',
          countryId,
          licenceNumber,
          adminFullName: adminName,
          adminEmail,
          adminPhone,
          adminPassword,
        })

        if (result.success) {
          setStep(3)
        } else {
          setError(result.error || 'Registration failed')
        }
      } else if (step === 3) {
        // Verify email
        if (verificationCode.length !== 6) {
          setError('Please enter a valid 6-digit code')
          setLoading(false)
          return
        }

        const result = await verifyEmail(adminEmail, verificationCode)

        if (result.success) {
          setStep(4)
        } else {
          setError(result.error || 'Invalid verification code')
        }
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handlePrevStep = () => {
    if (step > 1) {
      setError(null)
      setStep(step - 1)
    }
  }

  const handleSignIn = () => {
    router.push('/login')
  }

  return (
    <AuthLayout>
      <div className="w-full space-y-8">
        {/* Progress steps */}
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className="flex flex-col items-center">
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                  s < step
                    ? 'bg-[var(--primary)] text-white'
                    : s === step
                      ? 'bg-[var(--primary)] text-white ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--bg)]'
                      : 'bg-[var(--muted)] text-[var(--text-muted)]'
                }`}
              >
                {s < step ? <CheckCircle2 className="h-5 w-5" /> : s}
              </div>
              <p
                className={`mt-2 text-xs font-medium text-center ${
                  s <= step ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'
                }`}
              >
                {s === 1 && 'Company'}
                {s === 2 && 'Account'}
                {s === 3 && 'Verify'}
                {s === 4 && 'Complete'}
              </p>
            </div>
          ))}
        </div>

        {/* Step 1: Company Details */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-display font-bold text-[var(--text)]">Company Information</h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">Tell us about your pharmaceutical organization</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-2">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="PharmaTech Solutions Inc."
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-3">Company Type</label>
              <div className="grid grid-cols-1 gap-3">
                {COMPANY_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setCompanyType(type.id)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      companyType === type.id
                        ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                        : 'border-[var(--border)] hover:border-[var(--primary)]/50 bg-[var(--surface)]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{type.icon}</span>
                      <div>
                        <p className="font-medium text-[var(--text)]">{type.label}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">Regulatory Country</label>
                <select
                  value={countryId}
                  onChange={e => setCountryId(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
                >
                  <option value="">Select country...</option>
                  {COUNTRIES.map(country => (
                    <option key={country.id} value={country.id}>
                      {country.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">Licence Number</label>
                <input
                  type="text"
                  value={licenceNumber}
                  onChange={e => setLicenceNumber(e.target.value)}
                  placeholder="LIC-2024-001234"
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-2">License Document</label>
              <div className="border-2 border-dashed border-[var(--border)] rounded-lg p-6 bg-[var(--surface)]/50 hover:bg-[var(--surface)] transition-colors">
                {licenseFile ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
                        <svg className="h-6 w-6 text-[var(--primary)]" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--text)]">{licenseFile.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">{(licenseFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLicenseFile(null)}
                      className="p-2 hover:bg-[var(--surface-raised)] rounded-lg transition-colors"
                    >
                      <X className="h-4 w-4 text-[var(--text-muted)]" />
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="h-8 w-8 text-[var(--text-muted)] mx-auto mb-3" />
                    <p className="text-sm font-medium text-[var(--text)]">Upload license document</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">PDF, JPG or PNG up to 10MB</p>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file && file.size <= 10 * 1024 * 1024) {
                          setLicenseFile(file)
                        } else {
                          setError('File must be under 10MB')
                        }
                      }}
                      className="hidden"
                      id="license-upload"
                    />
                    <label htmlFor="license-upload" className="mt-3 inline-block">
                      <button
                        type="button"
                        onClick={() => document.getElementById('license-upload')?.click()}
                        className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors"
                      >
                        Select file
                      </button>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-status-error/10 border border-status-error text-status-error text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Admin Account */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground">Administrator Account</h2>
              <p className="mt-2 text-sm text-muted-foreground">Create the primary admin account for your company</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Full Name</label>
              <input
                type="text"
                value={adminName}
                onChange={e => setAdminName(e.target.value)}
                placeholder="John Smith"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-safemeds-teal/50 focus:border-safemeds-teal"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Email Address</label>
              <input
                type="email"
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                placeholder="john@pharmatech.com"
                autoComplete="email"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-safemeds-teal/50 focus:border-safemeds-teal"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Phone Number</label>
              <input
                type="tel"
                value={adminPhone}
                onChange={e => setAdminPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
                autoComplete="tel"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-safemeds-teal/50 focus:border-safemeds-teal"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
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

              {/* Password requirements checklist */}
              <div className="mt-3 space-y-2">
                {PASSWORD_REQUIREMENTS.map(req => (
                  <div key={req.id} className="flex items-center gap-2 text-sm">
                    <div
                      className={`h-4 w-4 rounded border flex items-center justify-center ${
                        req.check(adminPassword)
                          ? 'bg-status-success border-status-success'
                          : 'border-border bg-transparent'
                      }`}
                    >
                      {req.check(adminPassword) && <span className="text-white text-xs">✓</span>}
                    </div>
                    <span
                      className={
                        req.check(adminPassword) ? 'text-status-success' : 'text-muted-foreground'
                      }
                    >
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
                value={adminPasswordConfirm}
                onChange={e => setAdminPasswordConfirm(e.target.value)}
                placeholder="Confirm password"
                autoComplete="new-password"
                className={`w-full px-3 py-2 border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                  adminPasswordConfirm
                    ? passwordsMatch
                      ? 'border-status-success focus:ring-status-success/50 focus:border-status-success'
                      : 'border-status-error focus:ring-status-error/50 focus:border-status-error'
                    : 'border-border focus:ring-safemeds-teal/50 focus:border-safemeds-teal'
                }`}
              />
              {adminPasswordConfirm && !passwordsMatch && (
                <p className="mt-1 text-xs text-status-error">Passwords do not match</p>
              )}
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="terms"
                checked={agreeTerms}
                onChange={e => setAgreeTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border bg-background cursor-pointer accent-safemeds-teal"
              />
              <label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer">
                I agree to the SafeMeds <span className="text-foreground font-medium">Terms of Service</span> and{' '}
                <span className="text-foreground font-medium">Data Processing Agreement</span>, and confirm that I am
                authorized to register this company.
              </label>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-status-error/10 border border-status-error text-status-error text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Email Verification */}
        {step === 3 && (
          <div className="space-y-6 text-center">
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground">Verify Email Address</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                We&apos;ve sent a verification code to <span className="font-medium text-foreground">{adminEmail}</span>
              </p>
            </div>

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
              <button className="text-safemeds-teal hover:underline font-medium">Resend email</button>
            </p>

            {error && (
              <div className="p-3 rounded-lg bg-[var(--bad-bg)] border border-[var(--bad)] text-[var(--bad)] text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Registration Complete */}
        {step === 4 && (
          <div className="space-y-8 text-center py-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-status-success/10 border-2 border-status-success flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-status-success" />
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-display font-bold text-foreground">Registration Complete!</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your company account is under review. We&apos;ll notify you via email within 2-3 business days.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-card border border-border space-y-3">
              <div className="text-left">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reference Number</p>
                <p className="text-sm font-mono text-foreground mt-1">REG-2024-00{Math.floor(Math.random() * 10000)}</p>
              </div>
              <div className="text-left border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Next Steps</p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                  <li>✓ Check your email for confirmation</li>
                  <li>✓ Await regulatory review (2-3 business days)</li>
                  <li>✓ Log in once your account is approved</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex gap-3 pt-4">
          {step > 1 && step < 4 && (
            <button
              onClick={handlePrevStep}
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg border border-border bg-card hover:bg-card/80 text-foreground font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          )}

          {step < 4 && (
            <button
              onClick={handleNextStep}
              disabled={loading || (step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2)}
              className="flex-1 px-4 py-2 rounded-lg bg-safemeds-teal hover:bg-safemeds-teal/90 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {step === 3 ? 'Verify' : 'Next'}
                  {step < 3 && <ChevronRight className="h-4 w-4" />}
                </>
              )}
            </button>
          )}

          {step === 4 && (
            <button
              onClick={handleSignIn}
              className="w-full px-4 py-2 rounded-lg bg-safemeds-teal hover:bg-safemeds-teal/90 text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              Go to Login
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Sign in link */}
        <div className="text-center">
          {step < 4 && (
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <button
                onClick={handleSignIn}
                className="text-safemeds-teal hover:underline font-medium"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </AuthLayout>
  )
}
