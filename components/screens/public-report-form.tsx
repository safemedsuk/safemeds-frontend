'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { LogoMark } from '@/components/ui/logo-mark'
import {
  PublicCompanyDisplay,
  PublicCountry,
  PublicOrganizationResult,
  SubmitPublicReportInput,
  attachPublicSourceDocument,
  getPublicCountries,
  listPublicOrganizations,
  resolvePublicCompany,
  submitPublicReport,
} from '@/lib/api/public-reporting'
import type {
  ConsentMethod,
  CreateAdverseEventInput,
  CreatePregnancyInput,
  CreateSuspectProductInput,
  PatientSex,
  PregnancyOutcome,
  ReactionOutcome,
  ReporterType,
} from '@/lib/api/pv-cases'
import { PREGNANCY_OUTCOME_LABELS } from '@/lib/api/pv-cases'
import type { PublicProductResult } from '@/lib/api/public-reporting'
import { PublicProductPicker } from '@/components/screens/public-product-picker'
import { useTranslation } from '@/lib/i18n/use-translation'
import { useLocaleStore, SUPPORTED_LOCALES, type Locale } from '@/lib/i18n/locale-store'
import type { MessageKey } from '@/lib/i18n/messages/en'

/** Real-usage request, 22 Sep 2026 (item 22-I) — a real dropdown instead of free text, with an "Other" fallback so no genuine qualification is ever blocked. */
const HCP_QUALIFICATION_KEYS: MessageKey[] = [
  'publicReportForm.hcpDoctor',
  'publicReportForm.hcpPharmacist',
  'publicReportForm.hcpNurse',
  'publicReportForm.hcpClinicalOfficer',
  'publicReportForm.hcpDentist',
  'publicReportForm.hcpRadiologist',
  'publicReportForm.hcpLabTechnician',
  'publicReportForm.hcpMedicalStudent',
  'publicReportForm.hcpIntern',
]
const OTHER_OPTION = '__other__'

const SERIOUSNESS_CRITERIA_KEYS = [
  ['seriousnessDeath', 'pvCaseDetail.seriousnessDeath'],
  ['seriousnessLifeThreatening', 'pvCaseDetail.seriousnessLifeThreatening'],
  ['seriousnessHospitalization', 'pvCaseDetail.seriousnessHospitalization'],
  ['seriousnessDisabling', 'pvCaseDetail.seriousnessDisabling'],
  ['seriousnessCongenitalAnomaly', 'pvCaseDetail.seriousnessCongenitalAnomaly'],
  ['seriousnessOther', 'pvCaseDetail.seriousnessOther'],
] as const

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

let keyCounter = 0
function nextKey(): string {
  keyCounter += 1
  return `row-${keyCounter}`
}

interface ProductRow extends CreateSuspectProductInput {
  key: string
}
interface EventRow extends CreateAdverseEventInput {
  key: string
}

function emptyProduct(): ProductRow {
  return { key: nextKey(), drugCharacterization: 'suspect', medicinalProduct: '' }
}
function emptyEvent(): EventRow {
  return { key: nextKey(), reportedTerm: '', narrative: '', outcome: 'unknown' }
}

type LoadState = 'loading' | 'ready' | 'not_found'

/**
 * Stage 2's own open sub-task — a locale selector independent of
 * `User.preferredLocale`, since an anonymous public reporter has no
 * logged-in account. `useLocaleStore` already persists to localStorage
 * regardless of auth state, so this is just a visible toggle onto that
 * same, already-working store — not a second locale mechanism.
 */
function PublicLocaleToggle() {
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)

  return (
    <div className="flex items-center justify-center gap-1 text-xs">
      {SUPPORTED_LOCALES.map((candidate: Locale) => (
        <button
          key={candidate}
          type="button"
          onClick={() => setLocale(candidate)}
          className={`rounded-md px-2 py-1 font-medium uppercase ${
            candidate === locale ? 'bg-safemeds-teal text-white' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          {candidate}
        </button>
      ))}
    </div>
  )
}

export function PublicReportForm({ slug }: { slug: string }) {
  const { t } = useTranslation()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [company, setCompany] = useState<PublicCompanyDisplay | null>(null)

  const [reporterType, setReporterType] = useState<ReporterType>('consumer')
  const [reporterFullName, setReporterFullName] = useState('')
  const [reporterEmail, setReporterEmail] = useState('')
  const [reporterPhone, setReporterPhone] = useState('')
  // Real-usage request, 22 Sep 2026 (item 22) — both are now a real
  // dropdown with an "Other" fallback, not free text only. The actual
  // value submitted is derived just before building the payload (see
  // `effectiveQualification`/`effectiveOrganization` below) — never a
  // second source of truth the submit handler could forget to read.
  const [qualificationOption, setQualificationOption] = useState('')
  const [reporterQualificationOther, setReporterQualificationOther] = useState('')
  const [organizationOption, setOrganizationOption] = useState('')
  const [reporterOrganizationOther, setReporterOrganizationOther] = useState('')
  const [organizations, setOrganizations] = useState<PublicOrganizationResult[]>([])
  /** Real-usage request, 22 Sep 2026 (item 12) — drives both intake classification and the case reference number for this self-report (see `PublicReportingService.submit()`'s own doc comment). */
  const [countryOfResidenceId, setCountryOfResidenceId] = useState('')
  const [countries, setCountries] = useState<PublicCountry[]>([])

  const [patientAgeYears, setPatientAgeYears] = useState('')
  const [patientSex, setPatientSex] = useState<PatientSex>('unknown')
  const [patientInitials, setPatientInitials] = useState('')
  const [patientMedicalHistory, setPatientMedicalHistory] = useState('')

  const [products, setProducts] = useState<ProductRow[]>([emptyProduct()])
  const [linkedProducts, setLinkedProducts] = useState<Record<string, PublicProductResult>>({})
  const [events, setEvents] = useState<EventRow[]>([emptyEvent()])

  const [suspectedFalsifiedOrSubstandard, setSuspectedFalsifiedOrSubstandard] = useState(false)
  const [pregnancyExposure, setPregnancyExposure] = useState(false)
  const [pregnancyOutcome, setPregnancyOutcome] = useState<PregnancyOutcome>('ongoing')
  const [pregnancyExpectedDeliveryDate, setPregnancyExpectedDeliveryDate] = useState('')

  const [consentGranted, setConsentGranted] = useState(false)
  /** Real-usage bug, 22 Sep 2026 — a genuinely separate consent from `consentGranted` above; see `CreatePvCaseDto.contactConsent`'s own backend doc comment for the full account of why this was missing everywhere, not just here. */
  const [contactConsentGranted, setContactConsentGranted] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [referenceNumber, setReferenceNumber] = useState<string | null>(null)

  const [attaching, setAttaching] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const [attached, setAttached] = useState(false)
  const [skippedAttachment, setSkippedAttachment] = useState(false)

  useEffect(() => {
    getPublicCountries()
      .then(setCountries)
      .catch(() => setCountries([])) // best-effort — the dropdown just shows empty if this fails, never blocks the rest of the form
  }, [])

  useEffect(() => {
    listPublicOrganizations(slug)
      .then(setOrganizations)
      .catch(() => setOrganizations([])) // best-effort — the "Other" free-text fallback still works if this fails
  }, [slug])

  useEffect(() => {
    resolvePublicCompany(slug)
      .then((result) => {
        setCompany(result)
        setLoadState('ready')
      })
      .catch(() => setLoadState('not_found'))
  }, [slug])

  const updateProduct = (key: string, patch: Partial<ProductRow>) => {
    setProducts((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)))
  }
  const updateEvent = (key: string, patch: Partial<EventRow>) => {
    setEvents((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)))
  }

  const handlePickProduct = (rowKey: string, picked: PublicProductResult) => {
    setLinkedProducts((prev) => ({ ...prev, [rowKey]: picked }))
    updateProduct(rowKey, {
      productId: picked.id,
      medicinalProduct: picked.brandName,
      activeSubstanceName: picked.innName ?? picked.genericName,
      atcCode: picked.atcCode ?? undefined,
    })
  }
  const handleClearLinkedProduct = (rowKey: string) => {
    setLinkedProducts((prev) => {
      const next = { ...prev }
      delete next[rowKey]
      return next
    })
    updateProduct(rowKey, { productId: undefined })
  }

  const validProducts = products.filter((p) => p.medicinalProduct.trim().length > 0)
  const validEvents = events.filter((e) => e.reportedTerm.trim().length > 0 && e.narrative.trim().length > 0)

  const canSubmit = validProducts.length > 0 && validEvents.length > 0 && consentGranted && !submitting

  // Real-usage request, 22 Sep 2026 (item 22) — the single actual value
  // that gets submitted, whichever way it was entered (a preset pick or
  // free text under "Other").
  const effectiveQualification = qualificationOption === OTHER_OPTION ? reporterQualificationOther.trim() : qualificationOption
  const effectiveOrganization =
    organizationOption === OTHER_OPTION
      ? reporterOrganizationOther.trim()
      : (organizations.find((o) => o.id === organizationOption)?.name ?? '')

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const input: SubmitPublicReportInput = {
        reporter: {
          reporterType,
          fullName: reporterFullName.trim() || undefined,
          email: reporterEmail.trim() || undefined,
          phone: reporterPhone.trim() || undefined,
          qualification: effectiveQualification || undefined,
          organization: effectiveOrganization || undefined,
        },
        patient: {
          ageYears: patientAgeYears ? Number(patientAgeYears) : undefined,
          sex: patientSex,
          initials: patientInitials.trim() || undefined,
          medicalHistory: patientMedicalHistory.trim() || undefined,
        },
        suspectProducts: validProducts.map(({ key: _key, ...rest }) => rest),
        adverseEvents: validEvents.map(({ key: _key, ...rest }) => rest),
        consent: { granted: true, method: 'written' as ConsentMethod },
        contactConsent: contactConsentGranted ? { granted: true, method: 'written' as ConsentMethod } : undefined,
        suspectedFalsifiedOrSubstandard: suspectedFalsifiedOrSubstandard || undefined,
        pregnancy: pregnancyExposure
          ? ({ outcome: pregnancyOutcome, expectedDeliveryDate: pregnancyExpectedDeliveryDate || undefined } satisfies CreatePregnancyInput)
          : undefined,
        countryOfResidenceId: countryOfResidenceId || undefined,
      }
      const result = await submitPublicReport(slug, input)
      setReferenceNumber(result.referenceNumber)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('publicReportForm.errorSubmit'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loadState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (loadState === 'not_found') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-4">
        <PublicLocaleToggle />
        <div className="max-w-sm text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">{t('publicReportForm.notValidLink')}</p>
        </div>
      </div>
    )
  }

  if (referenceNumber) {
    const showAttachmentStep = !attached && !skippedAttachment

    const handleAttach = async (file: File) => {
      setAttaching(true)
      setAttachError(null)
      try {
        await attachPublicSourceDocument(slug, referenceNumber, file)
        setAttached(true)
      } catch (err) {
        setAttachError(err instanceof Error ? err.message : t('publicReportForm.errorAttach'))
      } finally {
        setAttaching(false)
      }
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-4 py-8">
        <PublicLocaleToggle />
        <div className="max-w-sm text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-status-success mb-4" />
          <h1 className="text-xl font-display font-semibold text-foreground mb-2">{t('publicReportForm.reportReceived')}</h1>
          <p className="text-sm text-muted-foreground mb-1">{t('publicReportForm.thankYouPrefix', { company: company?.companyName ?? '' })}</p>
          <p className="font-mono text-lg font-semibold text-foreground my-3">{referenceNumber}</p>
          <p className="text-xs text-muted-foreground">{t('publicReportForm.safetyTeamReview')}</p>

          {showAttachmentStep && (
            <div className="mt-6 rounded-lg border border-border bg-card p-4 text-left">
              <p className="text-sm font-medium text-foreground mb-1">{t('publicReportForm.havePhotoQuestion')}</p>
              <p className="text-xs text-muted-foreground mb-3">{t('publicReportForm.photoHelp')}</p>
              {attachError && <p className="text-xs text-status-error mb-2">{attachError}</p>}
              <div className="flex flex-col gap-2">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted">
                  {attaching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {attaching ? t('publicReportForm.uploading') : t('publicReportForm.chooseFileToAttach')}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    disabled={attaching}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void handleAttach(file)
                    }}
                  />
                </label>
                <button
                  onClick={() => setSkippedAttachment(true)}
                  disabled={attaching}
                  className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  {t('publicReportForm.skipStep')}
                </button>
              </div>
            </div>
          )}

          {attached && <p className="mt-6 text-xs text-status-success">{t('publicReportForm.fileAttachedThanks')}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
        <div className="flex justify-end">
          <PublicLocaleToggle />
        </div>
        <div className="flex flex-col items-center text-center gap-3">
          <LogoMark size="md" />
          <div>
            <h1 className="text-xl font-display font-semibold text-foreground">{t('publicReportForm.pageTitle')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('publicReportForm.toCompany', { company: company?.companyName ?? '' })}</p>
          </div>
        </div>

        {company?.reportTypeName && (
          <div className="rounded-lg border border-status-info/30 bg-status-info/5 px-4 py-3 text-sm text-foreground">
            {t('publicReportForm.filingReportTypePrefix')} <span className="font-medium">{company.reportTypeName}</span>{' '}
            {t('publicReportForm.filingReportTypeSuffix')}
          </div>
        )}

        <Section title={t('publicReportForm.sectionAboutYou')}>
          <div className="space-y-3">
            <div>
              <label className={labelClass}>{t('publicReportForm.reportingAsLabel')}</label>
              <select value={reporterType} onChange={(e) => setReporterType(e.target.value as ReporterType)} className={inputClass}>
                <option value="consumer">{t('publicReportForm.patientConsumer')}</option>
                <option value="healthcare_professional">{t('publicReportForm.healthcareProfessionalOpt')}</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('publicReportForm.yourName')}</label>
              <input value={reporterFullName} onChange={(e) => setReporterFullName(e.target.value)} className={inputClass} />
            </div>
            {reporterType === 'healthcare_professional' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>{t('pvCaseWizard.qualification')}</label>
                  <select value={qualificationOption} onChange={(e) => setQualificationOption(e.target.value)} className={inputClass}>
                    <option value="">{t('common.selectPlaceholder')}</option>
                    {HCP_QUALIFICATION_KEYS.map((qKey) => (
                      <option key={qKey} value={t(qKey)}>
                        {t(qKey)}
                      </option>
                    ))}
                    <option value={OTHER_OPTION}>{t('publicReportForm.otherEllipsis')}</option>
                  </select>
                  {qualificationOption === OTHER_OPTION && (
                    <input
                      value={reporterQualificationOther}
                      onChange={(e) => setReporterQualificationOther(e.target.value)}
                      placeholder={t('publicReportForm.pleaseSpecify')}
                      className={`${inputClass} mt-2`}
                    />
                  )}
                </div>
                <div>
                  <label className={labelClass}>{t('pvCaseWizard.organization')}</label>
                  <select value={organizationOption} onChange={(e) => setOrganizationOption(e.target.value)} className={inputClass}>
                    <option value="">{t('common.selectPlaceholder')}</option>
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                    <option value={OTHER_OPTION}>{t('publicReportForm.otherNotListed')}</option>
                  </select>
                  {organizationOption === OTHER_OPTION && (
                    <input
                      value={reporterOrganizationOther}
                      onChange={(e) => setReporterOrganizationOther(e.target.value)}
                      placeholder={t('publicReportForm.pleaseSpecify')}
                      className={`${inputClass} mt-2`}
                    />
                  )}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t('pvCaseWizard.email')}</label>
                <input type="email" value={reporterEmail} onChange={(e) => setReporterEmail(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('pvCaseWizard.phone')}</label>
                <input value={reporterPhone} onChange={(e) => setReporterPhone(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>{t('publicReportForm.countryOfResidence')}</label>
              <select value={countryOfResidenceId} onChange={(e) => setCountryOfResidenceId(e.target.value)} className={inputClass}>
                <option value="">{t('publicReportForm.selectCountryEllipsis')}</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Section>

        <Section title={t('publicReportForm.sectionAboutPatient')} subtitle={t('publicReportForm.subtitleAboutPatient')}>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>{t('publicReportForm.age')}</label>
              <input type="number" min={0} max={130} value={patientAgeYears} onChange={(e) => setPatientAgeYears(e.target.value)} className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>{t('pvCaseWizard.sex')}</label>
              <select value={patientSex} onChange={(e) => setPatientSex(e.target.value as PatientSex)} className={inputClass}>
                <option value="unknown">{t('publicReportForm.preferNotToSay')}</option>
                <option value="female">{t('pvCaseWizard.female')}</option>
                <option value="male">{t('pvCaseWizard.male')}</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className={labelClass}>{t('pvCaseDetail.medicalHistory')}</label>
            <textarea
              value={patientMedicalHistory}
              onChange={(e) => setPatientMedicalHistory(e.target.value)}
              rows={2}
              placeholder={t('publicReportForm.medicalHistoryPlaceholder')}
              className={inputClass}
            />
          </div>
        </Section>

        <Section title={t('publicReportForm.sectionProducts')} subtitle={t('pvCaseWizard.atLeastOneRequired')}>
          <div className="space-y-3">
            {products.map((product, index) => (
              <div key={product.key} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('pvCaseWizard.productN', { n: String(index + 1) })}</p>
                  {products.length > 1 && (
                    <button
                      onClick={() => {
                        setProducts((prev) => prev.filter((p) => p.key !== product.key))
                        setLinkedProducts((prev) => {
                          const next = { ...prev }
                          delete next[product.key]
                          return next
                        })
                      }}
                      className="text-muted-foreground hover:text-status-error"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div>
                  <PublicProductPicker
                    slug={slug}
                    linkedProduct={linkedProducts[product.key] ?? null}
                    onSelect={(picked) => handlePickProduct(product.key, picked)}
                    onClear={() => handleClearLinkedProduct(product.key)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>{t('publicReportForm.brandNameRequired')}</label>
                    <input
                      value={product.medicinalProduct}
                      onChange={(e) => updateProduct(product.key, { medicinalProduct: e.target.value })}
                      placeholder={t('pvCaseWizard.medicinalProductPlaceholder')}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t('publicReportForm.genericNameIfKnown')}</label>
                    <input
                      value={product.genericName ?? ''}
                      onChange={(e) => updateProduct(product.key, { genericName: e.target.value })}
                      placeholder={t('publicReportForm.genericNamePlaceholder')}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>{t('pvCaseWizard.batchLotNumber')}</label>
                    <input
                      value={product.batchNumber ?? ''}
                      onChange={(e) => updateProduct(product.key, { batchNumber: e.target.value })}
                      placeholder={t('publicReportForm.ifVisibleOnPack')}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t('publicReportForm.manufacturingDate')}</label>
                    <input type="date" value={product.manufacturingDate ?? ''} onChange={(e) => updateProduct(product.key, { manufacturingDate: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>{t('publicReportForm.expiryDate')}</label>
                    <input type="date" value={product.expiryDate ?? ''} onChange={(e) => updateProduct(product.key, { expiryDate: e.target.value })} className={inputClass} />
                  </div>
                </div>
              </div>
            ))}
            <button onClick={() => setProducts((prev) => [...prev, emptyProduct()])} className="flex items-center gap-1.5 text-sm font-medium text-safemeds-teal hover:underline">
              <Plus className="h-4 w-4" /> {t('publicReportForm.addAnotherProduct')}
            </button>
          </div>
        </Section>

        <Section title={t('publicReportForm.sectionWhatHappened')} subtitle={t('pvCaseWizard.atLeastOneRequired')}>
          <div className="space-y-3">
            {events.map((event, index) => (
              <div key={event.key} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('publicReportForm.reactionN', { n: String(index + 1) })}</p>
                  {events.length > 1 && (
                    <button onClick={() => setEvents((prev) => prev.filter((e) => e.key !== event.key))} className="text-muted-foreground hover:text-status-error">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div>
                  <label className={labelClass}>{t('publicReportForm.inAFewWords')}</label>
                  <input
                    value={event.reportedTerm}
                    onChange={(e) => updateEvent(event.key, { reportedTerm: e.target.value })}
                    placeholder={t('publicReportForm.reactionPlaceholder')}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>{t('publicReportForm.pleaseDescribe')}</label>
                  <textarea
                    value={event.narrative}
                    onChange={(e) => updateEvent(event.key, { narrative: e.target.value })}
                    rows={3}
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className={labelClass}>{t('publicReportForm.whenDidItStart')}</label>
                    <input type="date" value={event.onsetDate ?? ''} onChange={(e) => updateEvent(event.key, { onsetDate: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>{t('publicReportForm.whenDidItEnd')}</label>
                    <input type="date" value={event.resolutionDate ?? ''} onChange={(e) => updateEvent(event.key, { resolutionDate: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>{t('publicReportForm.currentStatus')}</label>
                    <select value={event.outcome ?? 'unknown'} onChange={(e) => updateEvent(event.key, { outcome: e.target.value as ReactionOutcome })} className={inputClass}>
                      <option value="unknown">{t('common.unknown')}</option>
                      <option value="recovered">{t('pvCaseWizard.recovered')}</option>
                      <option value="recovering">{t('pvCaseWizard.recovering')}</option>
                      <option value="not_recovered">{t('pvCaseWizard.notRecovered')}</option>
                      <option value="recovered_with_sequelae">{t('pvCaseWizard.recoveredWithSequelae')}</option>
                      <option value="fatal">{t('pvCaseWizard.fatal')}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <p className={labelClass}>{t('publicReportForm.didAnyHappen')}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {SERIOUSNESS_CRITERIA_KEYS.map(([field, labelKey]) => (
                      <label key={field} className="flex items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={Boolean(event[field])}
                          onChange={(e) => updateEvent(event.key, { [field]: e.target.checked } as Partial<EventRow>)}
                        />
                        {t(labelKey)}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            <button onClick={() => setEvents((prev) => [...prev, emptyEvent()])} className="flex items-center gap-1.5 text-sm font-medium text-safemeds-teal hover:underline">
              <Plus className="h-4 w-4" /> {t('publicReportForm.addAnotherReaction')}
            </button>
          </div>
        </Section>

        <Section title={t('publicReportForm.sectionMoreDetails')} subtitle={t('pvCaseWizard.optionalApplicable')}>
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={suspectedFalsifiedOrSubstandard} onChange={(e) => setSuspectedFalsifiedOrSubstandard(e.target.checked)} />
              {t('publicReportForm.suspectFakeSubstandard')}
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={pregnancyExposure} onChange={(e) => setPregnancyExposure(e.target.checked)} />
              {t('publicReportForm.involvesPregnancy')}
            </label>
            {pregnancyExposure && (
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3">
                <div>
                  <label className={labelClass}>{t('publicReportForm.pregnancyOutcomeLabel')}</label>
                  <select value={pregnancyOutcome} onChange={(e) => setPregnancyOutcome(e.target.value as PregnancyOutcome)} className={inputClass}>
                    {Object.entries(PREGNANCY_OUTCOME_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>{t('pvCaseWizard.expectedDeliveryDate')}</label>
                  <input type="date" value={pregnancyExpectedDeliveryDate} onChange={(e) => setPregnancyExpectedDeliveryDate(e.target.value)} className={inputClass} />
                </div>
              </div>
            )}
          </div>
        </Section>

        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <label className="flex items-start gap-2.5 text-sm text-foreground">
            <input type="checkbox" checked={consentGranted} onChange={(e) => setConsentGranted(e.target.checked)} className="mt-0.5" />
            <span>{t('publicReportForm.consentProcessing', { company: company?.companyName ?? '' })}</span>
          </label>
          <label className="flex items-start gap-2.5 text-sm text-foreground">
            <input type="checkbox" checked={contactConsentGranted} onChange={(e) => setContactConsentGranted(e.target.checked)} className="mt-0.5" />
            <span>{t('publicReportForm.consentFollowUp')}</span>
          </label>
        </div>

        {submitError && (
          <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" /> {submitError}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-safemeds-teal px-4 py-3 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('publicReportForm.submitReport')}
        </button>
      </div>
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}
