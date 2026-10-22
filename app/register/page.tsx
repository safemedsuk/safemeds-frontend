'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, Loader, Upload, X } from 'lucide-react'
import { AuthLayout } from '@/components/layout/auth-layout'
import { useAuthStore } from '@/lib/store/auth-store'
import { ApiRequestError, getErrorMessage } from '@/lib/api/client'
import { getAllCountries, type Country } from '@/lib/api/countries'
import { registerCompany, resendCode, uploadLicence, verifyEmail, type CompanyType } from '@/lib/api/auth'
import { getPasswordRequirements } from '@/lib/password-requirements'
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

const COMPANY_TYPES: Array<{ id: CompanyType; labelKey: MessageKey; icon: string }> = [
  { id: 'manufacturer', labelKey: 'auth.register.companyType.manufacturer', icon: '🏭' },
  { id: 'importer_distributor', labelKey: 'auth.register.companyType.importerDistributor', icon: '🚚' },
  { id: 'pharmacy_chain', labelKey: 'auth.register.companyType.pharmacyChain', icon: '💊' },
  { id: 'e_pharmacy', labelKey: 'auth.register.companyType.ePharmacy', icon: '📱' },
  { id: 'medical_facility', labelKey: 'auth.register.companyType.medicalFacility', icon: '🏥' },
  { id: 'ngo_social_health', labelKey: 'auth.register.companyType.ngoSocialHealth', icon: '🤝' },
  { id: 'research_institution', labelKey: 'auth.register.companyType.researchInstitution', icon: '🔬' },
  { id: 'other', labelKey: 'auth.register.companyType.other', icon: '📋' },
]

export default function RegisterPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { registrationDraft, setRegistrationDraft, resetRegistration } = useAuthStore()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [countries, setCountries] = useState<Country[]>([])
  const [countriesLoading, setCountriesLoading] = useState(true)

  // Company details (Step 1)
  const [companyName, setCompanyName] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [companyType, setCompanyType] = useState<CompanyType | ''>('')
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
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    getAllCountries()
      .then(setCountries)
      .catch(() => setError(t('auth.register.errorLoadCountries')))
      .finally(() => setCountriesLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // This page always starts the wizard at step 1 with blank fields (there's
  // no mid-flow "resume after refresh" UI built on top of it), so a
  // `registrationDraft` left over in localStorage from a *previous*,
  // possibly long-since-approved/rejected registration serves no purpose —
  // and reusing its stale referenceNumber for a brand-new submission causes
  // the licence upload to fail with REGISTRATION_NOT_EDITABLE. Clear it
  // once per fresh mount so every visit to this page starts a real new
  // registration.
  useEffect(() => {
    resetRegistration()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => setResendCooldown((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const passwordRequirements = getPasswordRequirements()
  const passwordStrength = passwordRequirements.filter(req => req.check(adminPassword))
  const isPasswordValid = passwordStrength.length === passwordRequirements.length
  const passwordsMatch = adminPassword === adminPasswordConfirm && adminPassword.length > 0

  const isCompanyEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmail)
  const canProceedStep1 = companyName && isCompanyEmailValid && companyType && countryId && licenceNumber && licenseFile
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
        if (!canProceedStep1) {
          setError(t('auth.register.errorFillCompanyDetails'))
          setLoading(false)
          return
        }
        setStep(2)
      } else if (step === 2) {
        if (!canProceedStep2) {
          setError(t('auth.register.errorFillRequiredFields'))
          setLoading(false)
          return
        }

        let draft = registrationDraft

        if (!draft) {
          draft = await registerCompany({
            companyName,
            companyEmail: companyEmail.trim(),
            companyType: companyType as CompanyType,
            countryId,
            licenceNumber,
            adminFullName: adminName,
            adminEmail,
            adminPhone,
            adminPassword,
          })
          setRegistrationDraft(draft)
        }

        if (licenseFile) {
          setUploadProgress(0)
          await uploadLicence(draft.referenceNumber, licenseFile, setUploadProgress)
          setUploadProgress(null)
        }

        setStep(3)
      } else if (step === 3) {
        if (verificationCode.length !== 6) {
          setError(t('auth.register.errorInvalidCode'))
          setLoading(false)
          return
        }

        await verifyEmail(adminEmail, verificationCode)
        setStep(4)
      }
    } catch (err) {
      setUploadProgress(null)
      setError(getErrorMessage(err, t('auth.register.errorGeneric')))
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (resendCooldown > 0) return
    setError(null)

    try {
      await resendCode(adminEmail)
      setResendCooldown(60)
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'RESEND_COOLDOWN') {
        const details = err.details as { retryAfterSeconds?: number } | undefined
        setResendCooldown(details?.retryAfterSeconds ?? 60)
      } else {
        setError(getErrorMessage(err, t('auth.register.errorResendFailed')))
      }
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
                {s === 1 && t('auth.register.stepCompany')}
                {s === 2 && t('auth.register.stepAccount')}
                {s === 3 && t('auth.register.stepVerify')}
                {s === 4 && t('auth.register.stepComplete')}
              </p>
            </div>
          ))}
        </div>

        {/* Step 1: Company Details */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-display font-bold text-[var(--text)]">{t('auth.register.companyInfoTitle')}</h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">{t('auth.register.companyInfoSubtitle')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-2">{t('auth.register.companyName')}</label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="PharmaTech Solutions Ltd"
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-2">{t('auth.register.companyEmail')}</label>
              <input
                type="email"
                value={companyEmail}
                onChange={e => setCompanyEmail(e.target.value)}
                placeholder="regulatory@pharmatech.co.ke"
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
              />
              <p className="mt-1.5 text-xs text-[var(--text-muted)]">{t('auth.register.companyEmailHelp')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-3">{t('auth.register.companyTypeLabel')}</label>
              <div className="grid grid-cols-1 gap-3">
                {COMPANY_TYPES.map(type => (
                  <button
                    key={type.id}
                    type="button"
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
                        <p className="font-medium text-[var(--text)]">{t(type.labelKey)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">{t('auth.register.regulatoryCountry')}</label>
                <select
                  value={countryId}
                  onChange={e => setCountryId(e.target.value)}
                  disabled={countriesLoading}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] disabled:opacity-50"
                >
                  <option value="">{countriesLoading ? t('auth.register.loadingCountries') : t('auth.register.selectCountry')}</option>
                  {countries.map(country => (
                    <option key={country.id} value={country.id}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">{t('auth.register.licenceNumber')}</label>
                <input
                  type="text"
                  value={licenceNumber}
                  onChange={e => setLicenceNumber(e.target.value)}
                  placeholder="PPB/LIC/2026/001234"
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-2">{t('auth.register.licenseDocument')}</label>
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
                    <p className="text-sm font-medium text-[var(--text)]">{t('auth.register.uploadLicenseDocument')}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">{t('auth.register.uploadHint')}</p>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file && file.size <= 10 * 1024 * 1024) {
                          setLicenseFile(file)
                        } else if (file) {
                          setError(t('auth.register.errorFileTooLarge'))
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
                        {t('auth.register.selectFile')}
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
              <h2 className="text-2xl font-display font-bold text-[var(--text)]">{t('auth.register.adminAccountTitle')}</h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">{t('auth.register.adminAccountSubtitle')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-2">{t('auth.register.fullName')}</label>
              <input
                type="text"
                value={adminName}
                onChange={e => setAdminName(e.target.value)}
                placeholder="Jane Wanjiru"
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-2">{t('auth.register.emailAddress')}</label>
              <input
                type="email"
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                placeholder="jane@pharmatech.co.ke"
                autoComplete="email"
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-2">{t('auth.register.phoneNumber')}</label>
              <input
                type="tel"
                value={adminPhone}
                onChange={e => setAdminPhone(e.target.value)}
                placeholder="+254712345678"
                autoComplete="tel"
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-2">{t('auth.register.password')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  placeholder={t('auth.register.passwordPlaceholder')}
                  autoComplete="new-password"
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {passwordRequirements.map(req => (
                  <div key={req.id} className="flex items-center gap-2 text-sm">
                    <div
                      className={`h-4 w-4 rounded border flex items-center justify-center ${
                        req.check(adminPassword)
                          ? 'bg-status-success border-status-success'
                          : 'border-[var(--border)] bg-transparent'
                      }`}
                    >
                      {req.check(adminPassword) && <span className="text-white text-xs">✓</span>}
                    </div>
                    <span
                      className={
                        req.check(adminPassword) ? 'text-status-success' : 'text-[var(--text-muted)]'
                      }
                    >
                      {t(req.labelKey, req.labelParams)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-2">{t('auth.register.confirmPassword')}</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={adminPasswordConfirm}
                onChange={e => setAdminPasswordConfirm(e.target.value)}
                placeholder={t('auth.register.confirmPasswordPlaceholder')}
                autoComplete="new-password"
                className={`w-full px-3 py-2 border rounded-lg bg-[var(--bg)] text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                  adminPasswordConfirm
                    ? passwordsMatch
                      ? 'border-status-success focus:ring-status-success/50 focus:border-status-success'
                      : 'border-status-error focus:ring-status-error/50 focus:border-status-error'
                    : 'border-[var(--border)] focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]'
                }`}
              />
              {adminPasswordConfirm && !passwordsMatch && (
                <p className="mt-1 text-xs text-status-error">{t('auth.register.passwordsDoNotMatch')}</p>
              )}
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="terms"
                checked={agreeTerms}
                onChange={e => setAgreeTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[var(--border)] bg-[var(--bg)] cursor-pointer accent-[var(--primary)]"
              />
              <label htmlFor="terms" className="text-sm text-[var(--text-muted)] cursor-pointer">
                {t('auth.register.agreeTermsPrefix')} <span className="text-[var(--text)] font-medium">{t('auth.register.termsOfService')}</span>{' '}
                {t('auth.register.and')} <span className="text-[var(--text)] font-medium">{t('auth.register.dataProcessingAgreement')}</span>
                {t('auth.register.agreeTermsSuffix')}
              </label>
            </div>

            {uploadProgress !== null && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-[var(--text-muted)]">
                  <span>{t('auth.register.uploadingLicence')}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--primary)] transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

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
              <h2 className="text-2xl font-display font-bold text-[var(--text)]">{t('auth.register.verifyEmailTitle')}</h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                {t('auth.register.verifyEmailSubtitle', { email: adminEmail })}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
              <p className="text-xs text-[var(--text-muted)] mb-3">{t('auth.register.enterSixDigitCode')}</p>
              <input
                type="text"
                value={verificationCode}
                onChange={e => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                autoComplete="one-time-code"
                className="w-full text-center text-3xl tracking-widest px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] font-mono"
              />
            </div>

            <p className="text-sm text-[var(--text-muted)]">
              {t('auth.register.didNotReceiveCode')}{' '}
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resendCooldown > 0}
                className="text-[var(--primary)] hover:underline font-medium disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
              >
                {resendCooldown > 0 ? t('auth.register.resendIn', { seconds: resendCooldown }) : t('auth.register.resendEmail')}
              </button>
            </p>

            {error && (
              <div className="p-3 rounded-lg bg-status-error/10 border border-status-error text-status-error text-sm flex items-center gap-2">
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
              <h2 className="text-2xl font-display font-bold text-[var(--text)]">{t('auth.register.completeTitle')}</h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">{t('auth.register.completeSubtitle')}</p>
            </div>

            <div className="p-4 rounded-lg bg-[var(--surface)] border border-[var(--border)] space-y-3">
              <div className="text-left">
                <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">{t('auth.register.referenceNumber')}</p>
                <p className="text-sm font-mono text-[var(--text)] mt-1">{registrationDraft?.referenceNumber}</p>
              </div>
              <div className="text-left border-t border-[var(--border)] pt-3">
                <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">{t('auth.register.nextSteps')}</p>
                <ul className="text-sm text-[var(--text-muted)] mt-2 space-y-1">
                  <li>✓ {t('auth.register.nextStepEmailVerified')}</li>
                  <li>✓ {t('auth.register.nextStepAwaitReview')}</li>
                  <li>✓ {t('auth.register.nextStepLogin')}</li>
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
              className="flex-1 px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-raised)] text-[var(--text)] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              {t('auth.register.back')}
            </button>
          )}

          {step < 4 && (
            <button
              onClick={handleNextStep}
              disabled={loading || (step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2)}
              className="flex-1 px-4 py-2 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  {t('auth.register.processing')}
                </>
              ) : (
                <>
                  {step === 3 ? t('auth.register.verify') : t('auth.register.next')}
                  {step < 3 && <ChevronRight className="h-4 w-4" />}
                </>
              )}
            </button>
          )}

          {step === 4 && (
            <button
              onClick={handleSignIn}
              className="w-full px-4 py-2 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              {t('auth.register.goToLogin')}
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Sign in link */}
        <div className="text-center">
          {step < 4 && (
            <p className="text-sm text-[var(--text-muted)]">
              {t('auth.register.alreadyHaveAccount')}{' '}
              <button
                onClick={handleSignIn}
                className="text-[var(--primary)] hover:underline font-medium"
              >
                {t('auth.register.signIn')}
              </button>
            </p>
          )}
        </div>
      </div>
    </AuthLayout>
  )
}
