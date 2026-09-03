'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { LogoMark } from '@/components/ui/logo-mark'
import {
  PublicCompanyDisplay,
  SubmitPublicReportInput,
  attachPublicSourceDocument,
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

const OUTCOME_OPTIONS: { value: ReactionOutcome; label: string }[] = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'recovered', label: 'Recovered' },
  { value: 'recovering', label: 'Recovering' },
  { value: 'not_recovered', label: 'Not recovered' },
  { value: 'recovered_with_sequelae', label: 'Recovered with sequelae' },
  { value: 'fatal', label: 'Fatal' },
]

const SERIOUSNESS_CRITERIA = [
  ['seriousnessDeath', 'Death'],
  ['seriousnessLifeThreatening', 'Life threatening'],
  ['seriousnessHospitalization', 'Hospitalization'],
  ['seriousnessDisabling', 'Disability'],
  ['seriousnessCongenitalAnomaly', 'Congenital anomaly'],
  ['seriousnessOther', 'Other'],
] as const
import type { PublicProductResult } from '@/lib/api/public-reporting'
import { PublicProductPicker } from '@/components/screens/public-product-picker'

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

export function PublicReportForm({ slug }: { slug: string }) {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [company, setCompany] = useState<PublicCompanyDisplay | null>(null)

  const [reporterType, setReporterType] = useState<ReporterType>('consumer')
  const [reporterFullName, setReporterFullName] = useState('')
  const [reporterEmail, setReporterEmail] = useState('')
  const [reporterPhone, setReporterPhone] = useState('')
  const [reporterQualification, setReporterQualification] = useState('')
  const [reporterOrganization, setReporterOrganization] = useState('')

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

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [referenceNumber, setReferenceNumber] = useState<string | null>(null)

  const [attaching, setAttaching] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const [attached, setAttached] = useState(false)
  const [skippedAttachment, setSkippedAttachment] = useState(false)

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
          qualification: reporterQualification.trim() || undefined,
          organization: reporterOrganization.trim() || undefined,
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
        suspectedFalsifiedOrSubstandard: suspectedFalsifiedOrSubstandard || undefined,
        pregnancy: pregnancyExposure
          ? ({ outcome: pregnancyOutcome, expectedDeliveryDate: pregnancyExpectedDeliveryDate || undefined } satisfies CreatePregnancyInput)
          : undefined,
      }
      const result = await submitPublicReport(slug, input)
      setReferenceNumber(result.referenceNumber)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong submitting your report. Please try again.')
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
      <div className="flex min-h-screen items-center justify-center bg-paper px-4">
        <div className="max-w-sm text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">This reporting link isn&apos;t valid. Please check the link or QR code and try again.</p>
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
        setAttachError(err instanceof Error ? err.message : 'Could not attach the document. Please try again.')
      } finally {
        setAttaching(false)
      }
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4 py-8">
        <div className="max-w-sm text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-status-success mb-4" />
          <h1 className="text-xl font-display font-semibold text-foreground mb-2">Report received</h1>
          <p className="text-sm text-muted-foreground mb-1">
            Thank you for reporting to {company?.companyName}. Your reference number is:
          </p>
          <p className="font-mono text-lg font-semibold text-foreground my-3">{referenceNumber}</p>
          <p className="text-xs text-muted-foreground">Our safety team will review this report. No further action is needed from you right now.</p>

          {showAttachmentStep && (
            <div className="mt-6 rounded-lg border border-border bg-card p-4 text-left">
              <p className="text-sm font-medium text-foreground mb-1">Have a photo or document to add?</p>
              <p className="text-xs text-muted-foreground mb-3">
                A photo of the product packaging, a pharmacy receipt, or a discharge note helps our safety team assess your
                report much more accurately. This is optional — you can still skip it.
              </p>
              {attachError && <p className="text-xs text-status-error mb-2">{attachError}</p>}
              <div className="flex flex-col gap-2">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted">
                  {attaching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {attaching ? 'Uploading…' : 'Choose a file to attach'}
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
                  Skip this step
                </button>
              </div>
            </div>
          )}

          {attached && <p className="mt-6 text-xs text-status-success">Your file was attached to this report. Thank you.</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
        <div className="flex flex-col items-center text-center gap-3">
          <LogoMark size="md" />
          <div>
            <h1 className="text-xl font-display font-semibold text-foreground">Report a Safety Concern</h1>
            <p className="mt-1 text-sm text-muted-foreground">to {company?.companyName}</p>
          </div>
        </div>

        {company?.reportTypeName && (
          <div className="rounded-lg border border-status-info/30 bg-status-info/5 px-4 py-3 text-sm text-foreground">
            You&apos;re filing a <span className="font-medium">{company.reportTypeName}</span> report. If your concern is about
            something other than a reaction to a product (for example a device fault or a quality problem), please still submit —
            our safety team will route it correctly.
          </div>
        )}

        <Section title="About you">
          <div className="space-y-3">
            <div>
              <label className={labelClass}>I am reporting as a…</label>
              <select value={reporterType} onChange={(e) => setReporterType(e.target.value as ReporterType)} className={inputClass}>
                <option value="consumer">Patient / consumer</option>
                <option value="healthcare_professional">Healthcare professional</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Your name</label>
              <input value={reporterFullName} onChange={(e) => setReporterFullName(e.target.value)} className={inputClass} />
            </div>
            {reporterType === 'healthcare_professional' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Qualification</label>
                  <input value={reporterQualification} onChange={(e) => setReporterQualification(e.target.value)} placeholder="e.g. Pharmacist, Nurse" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Organization</label>
                  <input value={reporterOrganization} onChange={(e) => setReporterOrganization(e.target.value)} className={inputClass} />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Email</label>
                <input type="email" value={reporterEmail} onChange={(e) => setReporterEmail(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input value={reporterPhone} onChange={(e) => setReporterPhone(e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>
        </Section>

        <Section title="About the patient" subtitle="Optional, but helps our safety team assess the report">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Age</label>
              <input type="number" min={0} max={130} value={patientAgeYears} onChange={(e) => setPatientAgeYears(e.target.value)} className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Sex</label>
              <select value={patientSex} onChange={(e) => setPatientSex(e.target.value as PatientSex)} className={inputClass}>
                <option value="unknown">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className={labelClass}>Relevant medical history</label>
            <textarea
              value={patientMedicalHistory}
              onChange={(e) => setPatientMedicalHistory(e.target.value)}
              rows={2}
              placeholder="Other conditions, allergies, or medications that might be relevant"
              className={inputClass}
            />
          </div>
        </Section>

        <Section title="Product(s) involved" subtitle="At least one is required">
          <div className="space-y-3">
            {products.map((product, index) => (
              <div key={product.key} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Product {index + 1}</p>
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
                <div>
                  <label className={labelClass}>Product / medicine name *</label>
                  <input
                    value={product.medicinalProduct}
                    onChange={(e) => updateProduct(product.key, { medicinalProduct: e.target.value })}
                    placeholder="e.g. Amoxil 500mg"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Batch/lot number (if visible on the pack)</label>
                  <input value={product.batchNumber ?? ''} onChange={(e) => updateProduct(product.key, { batchNumber: e.target.value })} className={inputClass} />
                </div>
              </div>
            ))}
            <button onClick={() => setProducts((prev) => [...prev, emptyProduct()])} className="flex items-center gap-1.5 text-sm font-medium text-safemeds-teal hover:underline">
              <Plus className="h-4 w-4" /> Add another product
            </button>
          </div>
        </Section>

        <Section title="What happened" subtitle="At least one is required">
          <div className="space-y-3">
            {events.map((event, index) => (
              <div key={event.key} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reaction {index + 1}</p>
                  {events.length > 1 && (
                    <button onClick={() => setEvents((prev) => prev.filter((e) => e.key !== event.key))} className="text-muted-foreground hover:text-status-error">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div>
                  <label className={labelClass}>In a few words *</label>
                  <input
                    value={event.reportedTerm}
                    onChange={(e) => updateEvent(event.key, { reportedTerm: e.target.value })}
                    placeholder="e.g. skin rash"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Please describe what happened *</label>
                  <textarea
                    value={event.narrative}
                    onChange={(e) => updateEvent(event.key, { narrative: e.target.value })}
                    rows={3}
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className={labelClass}>When did it start?</label>
                    <input type="date" value={event.onsetDate ?? ''} onChange={(e) => updateEvent(event.key, { onsetDate: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>When did it end? (if resolved)</label>
                    <input type="date" value={event.resolutionDate ?? ''} onChange={(e) => updateEvent(event.key, { resolutionDate: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Current status</label>
                    <select value={event.outcome ?? 'unknown'} onChange={(e) => updateEvent(event.key, { outcome: e.target.value as ReactionOutcome })} className={inputClass}>
                      {OUTCOME_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <p className={labelClass}>Did any of these happen? (check all that apply)</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {SERIOUSNESS_CRITERIA.map(([field, label]) => (
                      <label key={field} className="flex items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={Boolean(event[field])}
                          onChange={(e) => updateEvent(event.key, { [field]: e.target.checked } as Partial<EventRow>)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            <button onClick={() => setEvents((prev) => [...prev, emptyEvent()])} className="flex items-center gap-1.5 text-sm font-medium text-safemeds-teal hover:underline">
              <Plus className="h-4 w-4" /> Add another reaction
            </button>
          </div>
        </Section>

        <Section title="A few more details" subtitle="Optional — only complete what applies">
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={suspectedFalsifiedOrSubstandard} onChange={(e) => setSuspectedFalsifiedOrSubstandard(e.target.checked)} />
              I suspect this product may be fake or substandard
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={pregnancyExposure} onChange={(e) => setPregnancyExposure(e.target.checked)} />
              This report involves a pregnancy
            </label>
            {pregnancyExposure && (
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3">
                <div>
                  <label className={labelClass}>Pregnancy outcome</label>
                  <select value={pregnancyOutcome} onChange={(e) => setPregnancyOutcome(e.target.value as PregnancyOutcome)} className={inputClass}>
                    {Object.entries(PREGNANCY_OUTCOME_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Expected delivery date</label>
                  <input type="date" value={pregnancyExpectedDeliveryDate} onChange={(e) => setPregnancyExpectedDeliveryDate(e.target.value)} className={inputClass} />
                </div>
              </div>
            )}
          </div>
        </Section>

        <div className="rounded-lg border border-border bg-card p-4">
          <label className="flex items-start gap-2.5 text-sm text-foreground">
            <input type="checkbox" checked={consentGranted} onChange={(e) => setConsentGranted(e.target.checked)} className="mt-0.5" />
            <span>
              I consent to {company?.companyName} processing this report, including sharing it with the relevant medicines regulator if required.
            </span>
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
          Submit Report
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
