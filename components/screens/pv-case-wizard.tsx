'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { Country, getAllCountries } from '@/lib/api/countries'
import { DocumentsPanel } from '@/components/documents/documents-panel'
import type { Product } from '@/lib/api/master-data'
import { ReportType, listReportTypes } from '@/lib/api/report-types'
import { getCountryConfig, type FormSchema } from '@/lib/api/country-config'
import { ClinicalTrial, ClinicalTrialSubject, getClinicalTrial, listClinicalTrials } from '@/lib/api/clinical-trials'
import {
  CASE_CHANNEL_LABELS,
  CaseChannel,
  ConsentMethod,
  CreateAdverseEventInput,
  CreatePregnancyInput,
  CreateSuspectProductInput,
  DrugCharacterization,
  PatientSex,
  PREGNANCY_OUTCOME_LABELS,
  PregnancyOutcome,
  ReactionOutcome,
  ReporterType,
  createPvCase,
} from '@/lib/api/pv-cases'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { ProductPicker } from '@/components/pv-cases/product-picker'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

let keyCounter = 0
function nextKey(): string {
  keyCounter += 1
  return `row-${keyCounter}`
}

interface SuspectProductRow extends CreateSuspectProductInput {
  key: string
}

interface AdverseEventRow extends CreateAdverseEventInput {
  key: string
}

function emptyProduct(): SuspectProductRow {
  return { key: nextKey(), drugCharacterization: 'suspect', medicinalProduct: '' }
}

function emptyEvent(): AdverseEventRow {
  return { key: nextKey(), reportedTerm: '', narrative: '', outcome: 'unknown' }
}

export function PvCaseWizard() {
  const router = useRouter()
  const { has } = usePermissions()
  const canCreate = has('pv.capture_case')

  const [countries, setCountries] = useState<Country[]>([])
  const [reportTypes, setReportTypes] = useState<ReportType[]>([])
  const [refDataLoading, setRefDataLoading] = useState(true)
  const [refDataError, setRefDataError] = useState<string | null>(null)

  const [reportTypeId, setReportTypeId] = useState('')
  const [countryOfOccurrenceId, setCountryOfOccurrenceId] = useState('')
  const [countryOfReportId, setCountryOfReportId] = useState('')
  // Stage 1 task 1.2 — the real digitized form (per report type × country
  // of report) the selection resolves to, sourced from the same
  // country-config resolution `Country Rules`/`CountryConfigService` already
  // use — never fabricated client-side.
  const [formSchema, setFormSchema] = useState<FormSchema | null>(null)
  const [formSchemaLoading, setFormSchemaLoading] = useState(false)
  const [channel, setChannel] = useState<CaseChannel>('form')
  const [clinicalTrials, setClinicalTrials] = useState<ClinicalTrial[]>([])
  const [clinicalTrialId, setClinicalTrialId] = useState('')
  const [clinicalTrialSubjects, setClinicalTrialSubjects] = useState<ClinicalTrialSubject[]>([])
  const [clinicalTrialSubjectId, setClinicalTrialSubjectId] = useState('')
  const [awarenessDate, setAwarenessDate] = useState('')
  const [receivedDate, setReceivedDate] = useState('')
  const [additionalInformation, setAdditionalInformation] = useState('')

  const [reporterType, setReporterType] = useState<ReporterType>('healthcare_professional')
  const [reporterFullName, setReporterFullName] = useState('')
  const [reporterEmail, setReporterEmail] = useState('')
  const [reporterPhone, setReporterPhone] = useState('')
  const [reporterQualification, setReporterQualification] = useState('')
  const [reporterOrganization, setReporterOrganization] = useState('')

  const [patientInitials, setPatientInitials] = useState('')
  const [patientAgeYears, setPatientAgeYears] = useState('')
  const [patientSex, setPatientSex] = useState<PatientSex>('unknown')
  const [patientWeightKg, setPatientWeightKg] = useState('')
  const [patientHeightCm, setPatientHeightCm] = useState('')
  const [patientMedicalHistory, setPatientMedicalHistory] = useState('')

  const [products, setProducts] = useState<SuspectProductRow[]>([emptyProduct()])
  const [linkedProducts, setLinkedProducts] = useState<Record<string, Product>>({})
  const [events, setEvents] = useState<AdverseEventRow[]>([emptyEvent()])

  const [consentGranted, setConsentGranted] = useState<'yes' | 'no' | 'not_captured'>('not_captured')
  const [consentMethod, setConsentMethod] = useState<ConsentMethod>('written')

  const [suspectedFalsifiedOrSubstandard, setSuspectedFalsifiedOrSubstandard] = useState(false)
  const [pregnancyExposure, setPregnancyExposure] = useState(false)
  const [pregnancyExpectedDeliveryDate, setPregnancyExpectedDeliveryDate] = useState('')
  const [pregnancyGestationWeeks, setPregnancyGestationWeeks] = useState('')
  const [pregnancyOutcome, setPregnancyOutcome] = useState<PregnancyOutcome>('ongoing')
  const [pregnancyCongenitalAnomalyDetail, setPregnancyCongenitalAnomalyDetail] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Set once the case is actually created — the wizard then shows a final "attach your source document" step (the backend can only link a document to a case that already exists) rather than immediately navigating away. */
  const [createdCase, setCreatedCase] = useState<{ id: string; referenceNumber: string } | null>(null)

  useEffect(() => {
    setRefDataLoading(true)
    Promise.all([getAllCountries(), listReportTypes('pv')])
      .then(([countryRows, reportTypeRows]) => {
        setCountries(countryRows)
        setReportTypes(reportTypeRows)
      })
      .catch((err) => setRefDataError(getErrorMessage(err, 'Could not load reference data.')))
      .finally(() => setRefDataLoading(false))
  }, [])

  // Stage 1 task 1.2 — resolve the real digitized form once both a report
  // type and a country of report are picked, the same country-specific-
  // overrides-global resolution `CountryConfigService.resolveActiveFormSchema()`
  // already uses server-side. Cleared (not stale) the moment either input
  // changes, so the banner below never shows a form that doesn't match the
  // current selection.
  useEffect(() => {
    if (!reportTypeId || !countryOfReportId) {
      setFormSchema(null)
      return
    }
    let cancelled = false
    setFormSchemaLoading(true)
    getCountryConfig(countryOfReportId)
      .then((authorities) => {
        if (cancelled) return
        const node = authorities.flatMap((a) => a.reportTypes).find((rt) => rt.id === reportTypeId)
        setFormSchema(node?.activeFormSchema ?? null)
      })
      .catch(() => {
        if (!cancelled) setFormSchema(null)
      })
      .finally(() => {
        if (!cancelled) setFormSchemaLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reportTypeId, countryOfReportId])

  const selectedReportType = reportTypes.find((rt) => rt.id === reportTypeId)
  const formCoversLackOfEfficacy = formSchema ? JSON.stringify(formSchema.jsonSchema).includes('therapeutic_ineffectiveness') : true

  // VigiCloud Stage 14 — the trial catalog is only relevant once the
  // reporter picks the clinical_study channel; loaded lazily rather than
  // upfront alongside countries/report types, since most cases never need it.
  useEffect(() => {
    if (channel !== 'clinical_study') {
      setClinicalTrialId('')
      setClinicalTrialSubjects([])
      setClinicalTrialSubjectId('')
      return
    }
    listClinicalTrials({ limit: 100 })
      .then(({ trials }) => setClinicalTrials(trials.filter((t) => t.status === 'active')))
      .catch(() => {
        // Best-effort — the picker just stays empty; the backend's own 400 ("clinicalTrialId required") still catches a missing selection on submit.
      })
  }, [channel])

  useEffect(() => {
    setClinicalTrialSubjectId('')
    if (!clinicalTrialId) {
      setClinicalTrialSubjects([])
      return
    }
    getClinicalTrial(clinicalTrialId)
      .then((trial) => setClinicalTrialSubjects(trial.subjects))
      .catch(() => setClinicalTrialSubjects([]))
  }, [clinicalTrialId])

  if (!canCreate) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">New PV Case</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to capture PV cases. Contact your System Administrator.</p>
        </div>
      </div>
    )
  }

  const updateProduct = (key: string, patch: Partial<SuspectProductRow>) => {
    setProducts((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)))
  }
  const updateEvent = (key: string, patch: Partial<AdverseEventRow>) => {
    setEvents((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)))
  }

  const handlePickProduct = (rowKey: string, picked: Product) => {
    setLinkedProducts((prev) => ({ ...prev, [rowKey]: picked }))
    updateProduct(rowKey, {
      productId: picked.id,
      medicinalProduct: picked.brandName,
      activeSubstanceName: picked.innName ?? picked.genericName,
      atcCode: picked.atcCode ?? undefined,
      dosageForm: picked.dosageForm,
      route: picked.routeOfAdministration ?? undefined,
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
  const removeProductRow = (rowKey: string) => {
    setProducts((prev) => prev.filter((p) => p.key !== rowKey))
    setLinkedProducts((prev) => {
      const next = { ...prev }
      delete next[rowKey]
      return next
    })
  }

  const validProducts = products.filter((p) => p.medicinalProduct.trim().length > 0)
  const validEvents = events.filter((e) => e.reportedTerm.trim().length > 0 && e.narrative.trim().length > 0)

  // Stage 1 task 1.3 — a disabled Submit button with zero explanation left a
  // real user guessing why. Each entry here names exactly one unmet
  // requirement in plain language; rendered as a summary list next to
  // Submit whenever it's non-empty, so nothing is silently blocking.
  const missingReasons: string[] = []
  if (!reportTypeId) missingReasons.push('Report type')
  if (!countryOfOccurrenceId) missingReasons.push('Country of occurrence')
  if (!countryOfReportId) missingReasons.push('Country of report')
  if (!awarenessDate) missingReasons.push('Awareness date')
  if (!receivedDate) missingReasons.push('Received date')
  if (validProducts.length === 0) missingReasons.push('At least one suspect product with a name')
  if (validEvents.length === 0) missingReasons.push('At least one adverse event with both a reported term and a narrative')
  if (channel === 'clinical_study' && !clinicalTrialId) missingReasons.push('Clinical trial (required for the clinical-study channel)')

  const canSubmit = missingReasons.length === 0 && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const created = await createPvCase({
        reportTypeId,
        countryOfOccurrenceId,
        countryOfReportId,
        channel,
        clinicalTrialId: channel === 'clinical_study' ? clinicalTrialId : undefined,
        clinicalTrialSubjectId: channel === 'clinical_study' && clinicalTrialSubjectId ? clinicalTrialSubjectId : undefined,
        awarenessDate,
        receivedDate,
        additionalInformation: additionalInformation.trim() || undefined,
        reporter: {
          reporterType,
          fullName: reporterFullName.trim() || undefined,
          email: reporterEmail.trim() || undefined,
          phone: reporterPhone.trim() || undefined,
          qualification: reporterQualification.trim() || undefined,
          organization: reporterOrganization.trim() || undefined,
        },
        patient: {
          initials: patientInitials.trim() || undefined,
          ageYears: patientAgeYears ? Number(patientAgeYears) : undefined,
          sex: patientSex,
          weightKg: patientWeightKg ? Number(patientWeightKg) : undefined,
          heightCm: patientHeightCm ? Number(patientHeightCm) : undefined,
          medicalHistory: patientMedicalHistory.trim() || undefined,
        },
        suspectProducts: validProducts.map(({ key: _key, ...rest }) => rest),
        adverseEvents: validEvents.map(({ key: _key, ...rest }) => rest),
        consent: consentGranted === 'not_captured' ? undefined : { granted: consentGranted === 'yes', method: consentMethod },
        suspectedFalsifiedOrSubstandard: suspectedFalsifiedOrSubstandard || undefined,
        pregnancy: pregnancyExposure
          ? ({
              expectedDeliveryDate: pregnancyExpectedDeliveryDate || undefined,
              gestationWeeksAtExposure: pregnancyGestationWeeks ? Number(pregnancyGestationWeeks) : undefined,
              outcome: pregnancyOutcome,
              congenitalAnomalyDetail: pregnancyCongenitalAnomalyDetail.trim() || undefined,
            } satisfies CreatePregnancyInput)
          : undefined,
      })
      setCreatedCase({ id: created.id, referenceNumber: created.referenceNumber })
      setSubmitting(false)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this case.'))
      setSubmitting(false)
    }
  }

  if (createdCase) {
    return (
      <div className="space-y-6 p-6 max-w-2xl">
        <div className="rounded-lg border border-status-success/30 bg-status-success/5 p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-status-success mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Case {createdCase.referenceNumber} created</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Every case needs at least one source document (the original report form, email, or photo it was captured from) before it can leave Intake — attach it now, or from the case page later.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-base font-semibold text-foreground">Source Document</h2>
          <DocumentsPanel recordType="pv_case" recordId={createdCase.id} />
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => router.push(`/pv-cases/${createdCase.id}`)}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce"
          >
            Continue to case
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">New PV Case</h1>
        <p className="mt-1 text-sm text-muted-foreground">Capture a suspected adverse event or product-quality report.</p>
      </div>

      {refDataError && <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{refDataError}</div>}
      {refDataLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading reference data…
        </div>
      )}

      {!refDataLoading && (
        <>
          <Section title="Case Information">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Report type *</label>
                <select value={reportTypeId} onChange={(e) => setReportTypeId(e.target.value)} className={inputClass}>
                  <option value="">Select…</option>
                  {reportTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Intake channel</label>
                <select value={channel} onChange={(e) => setChannel(e.target.value as CaseChannel)} className={inputClass}>
                  {Object.entries(CASE_CHANNEL_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Country of occurrence *</label>
                <select value={countryOfOccurrenceId} onChange={(e) => setCountryOfOccurrenceId(e.target.value)} className={inputClass}>
                  <option value="">Select…</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Country of report *</label>
                <select value={countryOfReportId} onChange={(e) => setCountryOfReportId(e.target.value)} className={inputClass}>
                  <option value="">Select…</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Awareness date * (reporting-clock start)</label>
                <input type="date" value={awarenessDate} onChange={(e) => setAwarenessDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Received date *</label>
                <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className={inputClass} />
              </div>
            </div>

            {reportTypeId && countryOfReportId && (
              <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-xs">
                {formSchemaLoading ? (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Resolving the official form for this selection…
                  </span>
                ) : formSchema ? (
                  <p className="text-foreground">
                    You&apos;re completing: <span className="font-semibold">{selectedReportType?.name}</span>
                    {formSchema.officialFormCode && <span className="text-muted-foreground"> — official form {formSchema.officialFormCode}</span>}
                    . The fields below map onto this form&apos;s own captured data.
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    No digitized official form is configured yet for {selectedReportType?.name ?? 'this report type'} in the selected country of
                    report — the generic fields below are still captured and reportable, they just don&apos;t map to a specific PPB form number.
                  </p>
                )}
              </div>
            )}

            {channel === 'clinical_study' && (
              <div className="mt-4 rounded-lg border border-safemeds-teal/30 bg-safemeds-teal/5 p-4 space-y-3">
                <p className="text-xs text-foreground">
                  <span className="font-semibold">Clinical-trial SAE:</span> this is solicited data, not a spontaneous report — it must trace back to a specific trial.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Clinical trial *</label>
                    <select value={clinicalTrialId} onChange={(e) => setClinicalTrialId(e.target.value)} className={inputClass}>
                      <option value="">Select…</option>
                      {clinicalTrials.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.trialReference} — {t.trialName}
                        </option>
                      ))}
                    </select>
                    {clinicalTrials.length === 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">No active trials set up yet — create one under Clinical Trials first.</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Trial subject (optional)</label>
                    <select value={clinicalTrialSubjectId} onChange={(e) => setClinicalTrialSubjectId(e.target.value)} disabled={!clinicalTrialId} className={inputClass}>
                      <option value="">Not pre-enrolled / unknown</option>
                      {clinicalTrialSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.subjectCode}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4">
              <label className={labelClass}>Additional information</label>
              <textarea
                value={additionalInformation}
                onChange={(e) => setAdditionalInformation(e.target.value)}
                rows={2}
                className={inputClass}
                placeholder="Any context not captured elsewhere — encrypted at rest"
              />
            </div>
          </Section>

          <Section title="Reporter">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Reporter type</label>
                <select value={reporterType} onChange={(e) => setReporterType(e.target.value as ReporterType)} className={inputClass}>
                  <option value="healthcare_professional">Healthcare Professional</option>
                  <option value="consumer">Consumer / Patient</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Qualification</label>
                <input value={reporterQualification} onChange={(e) => setReporterQualification(e.target.value)} placeholder="e.g. Pharmacist, Nurse" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Full name</label>
                <input value={reporterFullName} onChange={(e) => setReporterFullName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Organization</label>
                <input value={reporterOrganization} onChange={(e) => setReporterOrganization(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input type="email" value={reporterEmail} onChange={(e) => setReporterEmail(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input value={reporterPhone} onChange={(e) => setReporterPhone(e.target.value)} className={inputClass} />
              </div>
            </div>
          </Section>

          <Section title="Patient">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className={labelClass}>Initials</label>
                <input value={patientInitials} onChange={(e) => setPatientInitials(e.target.value)} placeholder="e.g. J.M." className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Age (years)</label>
                <input type="number" min={0} max={130} value={patientAgeYears} onChange={(e) => setPatientAgeYears(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Sex</label>
                <select value={patientSex} onChange={(e) => setPatientSex(e.target.value as PatientSex)} className={inputClass}>
                  <option value="unknown">Unknown</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Weight (kg)</label>
                <input type="number" min={0} value={patientWeightKg} onChange={(e) => setPatientWeightKg(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Height (cm)</label>
                <input type="number" min={0} value={patientHeightCm} onChange={(e) => setPatientHeightCm(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="mt-4">
              <label className={labelClass}>Relevant medical history</label>
              <textarea
                value={patientMedicalHistory}
                onChange={(e) => setPatientMedicalHistory(e.target.value)}
                rows={2}
                className={inputClass}
                placeholder="Encrypted at rest"
              />
            </div>
          </Section>

          <Section title="Suspect Products" subtitle="At least one is required">
            <div className="space-y-4">
              {products.map((product, index) => (
                <div key={product.key} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Product {index + 1}</p>
                    {products.length > 1 && (
                      <button onClick={() => removeProductRow(product.key)} className="text-muted-foreground hover:text-status-error">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>Match against your product catalog</label>
                    <ProductPicker
                      linkedProduct={linkedProducts[product.key] ?? null}
                      onSelect={(picked) => handlePickProduct(product.key, picked)}
                      onClear={() => handleClearLinkedProduct(product.key)}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Medicinal product *</label>
                      <input
                        value={product.medicinalProduct}
                        onChange={(e) => updateProduct(product.key, { medicinalProduct: e.target.value })}
                        placeholder="e.g. Amoxil 500mg"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Characterization</label>
                      <select
                        value={product.drugCharacterization}
                        onChange={(e) => updateProduct(product.key, { drugCharacterization: e.target.value as DrugCharacterization })}
                        className={inputClass}
                      >
                        <option value="suspect">Suspect</option>
                        <option value="concomitant">Concomitant</option>
                        <option value="interacting">Interacting</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Active substance</label>
                      <input
                        value={product.activeSubstanceName ?? ''}
                        onChange={(e) => updateProduct(product.key, { activeSubstanceName: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Batch/lot number</label>
                      <input value={product.batchNumber ?? ''} onChange={(e) => updateProduct(product.key, { batchNumber: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Dose</label>
                      <input value={product.doseText ?? ''} onChange={(e) => updateProduct(product.key, { doseText: e.target.value })} placeholder="e.g. 500mg TDS" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Route</label>
                      <input value={product.route ?? ''} onChange={(e) => updateProduct(product.key, { route: e.target.value })} placeholder="e.g. Oral" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Start date</label>
                      <input type="date" value={product.startDate ?? ''} onChange={(e) => updateProduct(product.key, { startDate: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>End date</label>
                      <input type="date" value={product.endDate ?? ''} onChange={(e) => updateProduct(product.key, { endDate: e.target.value })} className={inputClass} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Action taken with drug</label>
                      <input
                        value={product.actionTaken ?? ''}
                        onChange={(e) => updateProduct(product.key, { actionTaken: e.target.value })}
                        placeholder="e.g. Drug withdrawn"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div>
                    <p className={labelClass}>Special situations for this product</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {(
                        [
                          ['isOverdose', 'Overdose'],
                          ['isOffLabelUse', 'Off-label use'],
                          ['isMisuse', 'Misuse'],
                          ['isMedicationError', 'Medication error'],
                        ] as const
                      ).map(([field, label]) => (
                        <label key={field} className="flex items-center gap-2 text-sm text-foreground">
                          <input
                            type="checkbox"
                            checked={Boolean(product[field])}
                            onChange={(e) => updateProduct(product.key, { [field]: e.target.checked } as Partial<SuspectProductRow>)}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={() => setProducts((prev) => [...prev, emptyProduct()])}
                className="flex items-center gap-1.5 text-sm font-medium text-safemeds-teal hover:underline"
              >
                <Plus className="h-4 w-4" /> Add another suspect product
              </button>
            </div>
          </Section>

          <Section title="Adverse Events" subtitle="At least one is required">
            <div className="space-y-4">
              {events.map((event, index) => (
                <div key={event.key} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Event {index + 1}</p>
                    {events.length > 1 && (
                      <button onClick={() => setEvents((prev) => prev.filter((e) => e.key !== event.key))} className="text-muted-foreground hover:text-status-error">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Reported term *</label>
                      <input
                        value={event.reportedTerm}
                        onChange={(e) => updateEvent(event.key, { reportedTerm: e.target.value })}
                        placeholder="Reporter's own words, e.g. 'skin rash'"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Outcome</label>
                      <select value={event.outcome} onChange={(e) => updateEvent(event.key, { outcome: e.target.value as ReactionOutcome })} className={inputClass}>
                        <option value="unknown">Unknown</option>
                        <option value="recovered">Recovered</option>
                        <option value="recovering">Recovering</option>
                        <option value="not_recovered">Not recovered</option>
                        <option value="recovered_with_sequelae">Recovered with sequelae</option>
                        <option value="fatal">Fatal</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Onset date</label>
                      <input type="date" value={event.onsetDate ?? ''} onChange={(e) => updateEvent(event.key, { onsetDate: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Resolution date</label>
                      <input type="date" value={event.resolutionDate ?? ''} onChange={(e) => updateEvent(event.key, { resolutionDate: e.target.value })} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Narrative *</label>
                    <textarea
                      value={event.narrative}
                      onChange={(e) => updateEvent(event.key, { narrative: e.target.value })}
                      rows={2}
                      placeholder="Full description of the reaction — encrypted at rest"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <p className={labelClass}>Seriousness criteria (FOM001 §8.III)</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {(
                        [
                          ['seriousnessDeath', 'Death'],
                          ['seriousnessLifeThreatening', 'Life threatening'],
                          ['seriousnessHospitalization', 'Hospitalization'],
                          ['seriousnessDisabling', 'Disability'],
                          ['seriousnessCongenitalAnomaly', 'Congenital anomaly'],
                          ['seriousnessOther', 'Other'],
                        ] as const
                      ).map(([field, label]) => (
                        <label key={field} className="flex items-center gap-2 text-sm text-foreground">
                          <input
                            type="checkbox"
                            checked={Boolean(event[field])}
                            onChange={(e) => updateEvent(event.key, { [field]: e.target.checked } as Partial<AdverseEventRow>)}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                  {formCoversLackOfEfficacy && (
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={Boolean(event.isLackOfEfficacy)}
                        onChange={(e) => updateEvent(event.key, { isLackOfEfficacy: e.target.checked })}
                      />
                      Lack of efficacy (therapeutic ineffectiveness)
                    </label>
                  )}
                </div>
              ))}
              <button
                onClick={() => setEvents((prev) => [...prev, emptyEvent()])}
                className="flex items-center gap-1.5 text-sm font-medium text-safemeds-teal hover:underline"
              >
                <Plus className="h-4 w-4" /> Add another adverse event
              </button>
            </div>
          </Section>

          <Section title="Special Situations" subtitle="Optional — only complete what applies to this case">
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={suspectedFalsifiedOrSubstandard}
                  onChange={(e) => setSuspectedFalsifiedOrSubstandard(e.target.checked)}
                />
                Suspected falsified or substandard product
              </label>

              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={pregnancyExposure} onChange={(e) => setPregnancyExposure(e.target.checked)} />
                Pregnancy exposure
              </label>

              {pregnancyExposure && (
                <div className="rounded-lg border border-border p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Expected delivery date</label>
                      <input
                        type="date"
                        value={pregnancyExpectedDeliveryDate}
                        onChange={(e) => setPregnancyExpectedDeliveryDate(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Gestation weeks at exposure</label>
                      <input
                        type="number"
                        min={0}
                        max={45}
                        value={pregnancyGestationWeeks}
                        onChange={(e) => setPregnancyGestationWeeks(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Outcome</label>
                      <select value={pregnancyOutcome} onChange={(e) => setPregnancyOutcome(e.target.value as PregnancyOutcome)} className={inputClass}>
                        {Object.entries(PREGNANCY_OUTCOME_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {pregnancyOutcome === 'live_birth_congenital_anomaly' && (
                    <div className="mt-4">
                      <label className={labelClass}>Congenital anomaly detail</label>
                      <textarea
                        value={pregnancyCongenitalAnomalyDetail}
                        onChange={(e) => setPregnancyCongenitalAnomalyDetail(e.target.value)}
                        rows={2}
                        className={inputClass}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </Section>

          <Section title="Consent">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Was consent to report obtained?</label>
                <select value={consentGranted} onChange={(e) => setConsentGranted(e.target.value as typeof consentGranted)} className={inputClass}>
                  <option value="not_captured">Not captured now</option>
                  <option value="yes">Granted</option>
                  <option value="no">Declined</option>
                </select>
              </div>
              {consentGranted !== 'not_captured' && (
                <div>
                  <label className={labelClass}>Method</label>
                  <select value={consentMethod} onChange={(e) => setConsentMethod(e.target.value as ConsentMethod)} className={inputClass}>
                    <option value="written">Written</option>
                    <option value="verbal">Verbal</option>
                    <option value="implied">Implied</option>
                  </select>
                </div>
              )}
            </div>
          </Section>

          {error && (
            <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
            </div>
          )}

          {!submitting && missingReasons.length > 0 && (
            <div className="rounded-lg border border-status-warning/30 bg-status-warning/5 p-4 text-sm text-foreground">
              <p className="flex items-center gap-2 font-medium text-status-warning">
                <AlertCircle className="h-4 w-4 flex-shrink-0" /> Still needed before this case can be submitted:
              </p>
              <ul className="mt-2 ml-6 list-disc space-y-0.5 text-muted-foreground">
                {missingReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-3 pb-6">
            <button onClick={() => router.push('/pv-cases')} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              title={missingReasons.length > 0 ? `Still needed: ${missingReasons.join(', ')}` : undefined}
              className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit Case
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}
