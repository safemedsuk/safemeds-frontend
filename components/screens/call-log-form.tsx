'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Clock, FileAudio, Loader2, Phone, Plus, ShieldAlert, Trash2, Voicemail } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { Country, getAllCountries } from '@/lib/api/countries'
import { ReportType, listReportTypes } from '@/lib/api/report-types'
import { CALL_OUTCOME_LABELS, CallOutcome, CallLog, listCallLogs, logCall } from '@/lib/api/call-logs'
import { uploadDocument } from '@/lib/api/documents'
import type { ConsentMethod, CreateAdverseEventInput, CreateSuspectProductInput, DrugCharacterization, PatientSex, ReporterType } from '@/lib/api/pv-cases'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useAuthStore } from '@/lib/store/auth-store'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'

/**
 * Holding `recordType` for a voicemail's audio file, uploaded *before*
 * the `CallLog` row exists (there's no PATCH to attach it afterward —
 * `CallLogService` is create-then-list only). The backend's own
 * `audioDocumentId` check only verifies the document belongs to the
 * same company, not that its `recordType`/`recordId` literally match a
 * call log, so any pre-existing company-scoped document qualifies.
 */
const VOICEMAIL_AUDIO_RECORD_TYPE = 'pv_call_log'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
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
  return { key: nextKey(), reportedTerm: '', narrative: '' }
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString()
}

/**
 * VigiCloud Stage 3.5 (+ Stage 21) — the "Log a call" quick-entry
 * screen: call metadata always, plus (only when outcome is
 * "case_created") the core fields needed to create a real case through
 * the exact same `POST /pv/cases` graph the web-form wizard uses —
 * `channel` is forced to `hotline_phone` server-side regardless of
 * what's sent. Deliberately doesn't replicate the full wizard's
 * special-situation section (pregnancy, per-item overdose/off-label/
 * misuse/lack-of-efficacy) — this is a *quick*-entry tool per the todo
 * doc's own framing; a call needing those captured in detail can still
 * use the full wizard afterward, since this screen creates a real,
 * editable case like any other.
 *
 * Stage 21 extends this same screen for a missed call/voicemail — a
 * QPPV or delegate is required to be reachable 24/7, and a genuine
 * after-hours voicemail is itself evidence of that reachability (see
 * `isAfterHoursOrWeekend()` on the backend, reused by the audit-
 * readiness "availability evidence" resolver). Toggling "Missed call /
 * voicemail" reveals an optional audio recording upload and a
 * transcription note; neither is required, since not every voicemail
 * has a recording or was transcribed.
 */
export function CallLogForm() {
  const router = useRouter()
  const { has } = usePermissions()
  const canLog = has('pv.capture_case')
  const companyId = useAuthStore((state) => state.currentUser?.companyId)

  const [countries, setCountries] = useState<Country[]>([])
  const [reportTypes, setReportTypes] = useState<ReportType[]>([])
  const [refDataLoading, setRefDataLoading] = useState(true)

  const [callerNumber, setCallerNumber] = useState('')
  const [occurredAt, setOccurredAt] = useState('')
  const [durationSeconds, setDurationSeconds] = useState('')
  const [outcome, setOutcome] = useState<CallOutcome>('information_only')
  const [notes, setNotes] = useState('')

  const [isVoicemail, setIsVoicemail] = useState(false)
  const [audioDocumentId, setAudioDocumentId] = useState<string | null>(null)
  const [audioFilename, setAudioFilename] = useState<string | null>(null)
  const [audioUploading, setAudioUploading] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [transcriptionNote, setTranscriptionNote] = useState('')

  const [reportTypeId, setReportTypeId] = useState('')
  const [countryOfOccurrenceId, setCountryOfOccurrenceId] = useState('')
  const [countryOfReportId, setCountryOfReportId] = useState('')
  const [awarenessDate, setAwarenessDate] = useState('')
  const [receivedDate, setReceivedDate] = useState('')
  const [reporterType, setReporterType] = useState<ReporterType>('consumer')
  const [reporterFullName, setReporterFullName] = useState('')
  const [reporterPhone, setReporterPhone] = useState('')
  const [reporterEmail, setReporterEmail] = useState('')
  const [patientInitials, setPatientInitials] = useState('')
  const [patientAgeYears, setPatientAgeYears] = useState('')
  const [patientSex, setPatientSex] = useState<PatientSex>('unknown')
  const [products, setProducts] = useState<ProductRow[]>([emptyProduct()])
  const [events, setEvents] = useState<EventRow[]>([emptyEvent()])
  const [consentGranted, setConsentGranted] = useState<'yes' | 'no' | 'not_captured'>('not_captured')
  const [consentMethod, setConsentMethod] = useState<ConsentMethod>('verbal')

  const [recentCalls, setRecentCalls] = useState<CallLog[]>([])
  const [recentLoading, setRecentLoading] = useState(true)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ referenceNumber?: string; caseId?: string } | null>(null)

  useEffect(() => {
    setRefDataLoading(true)
    Promise.all([getAllCountries(), listReportTypes('pv')])
      .then(([countryRows, reportTypeRows]) => {
        setCountries(countryRows)
        setReportTypes(reportTypeRows)
      })
      .finally(() => setRefDataLoading(false))
  }, [])

  const loadRecent = () => {
    setRecentLoading(true)
    listCallLogs({ limit: 10 })
      .then(({ callLogs }) => setRecentCalls(callLogs))
      .finally(() => setRecentLoading(false))
  }
  useEffect(loadRecent, [])

  if (!canLog) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">Log a Call</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to log calls. Contact your System Administrator.</p>
        </div>
      </div>
    )
  }

  const handleAudioSelect = async (file: File) => {
    if (!companyId) return
    setAudioUploading(true)
    setAudioError(null)
    try {
      const version = await uploadDocument(VOICEMAIL_AUDIO_RECORD_TYPE, companyId, file, { title: 'Voicemail recording' })
      setAudioDocumentId(version.documentId)
      setAudioFilename(file.name)
    } catch (err) {
      setAudioError(getErrorMessage(err, 'Could not upload the recording.'))
    } finally {
      setAudioUploading(false)
    }
  }

  const updateProduct = (key: string, patch: Partial<ProductRow>) => setProducts((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)))
  const updateEvent = (key: string, patch: Partial<EventRow>) => setEvents((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)))

  const validProducts = products.filter((p) => p.medicinalProduct.trim().length > 0)
  const validEvents = events.filter((e) => e.reportedTerm.trim().length > 0 && e.narrative.trim().length > 0)

  const caseFieldsValid =
    outcome !== 'case_created' ||
    (reportTypeId.length > 0 &&
      countryOfOccurrenceId.length > 0 &&
      countryOfReportId.length > 0 &&
      awarenessDate.length > 0 &&
      receivedDate.length > 0 &&
      validProducts.length > 0 &&
      validEvents.length > 0)

  const canSubmit = callerNumber.trim().length > 0 && occurredAt.length > 0 && caseFieldsValid && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const created = await logCall({
        callerNumber: callerNumber.trim(),
        occurredAt: new Date(occurredAt).toISOString(),
        durationSeconds: durationSeconds ? Number(durationSeconds) : undefined,
        outcome,
        notes: notes.trim() || undefined,
        isVoicemail,
        audioDocumentId: audioDocumentId ?? undefined,
        transcriptionNote: transcriptionNote.trim() || undefined,
        case:
          outcome === 'case_created'
            ? {
                reportTypeId,
                countryOfOccurrenceId,
                countryOfReportId,
                awarenessDate,
                receivedDate,
                reporter: {
                  reporterType,
                  fullName: reporterFullName.trim() || undefined,
                  phone: reporterPhone.trim() || callerNumber.trim(),
                  email: reporterEmail.trim() || undefined,
                },
                patient: {
                  initials: patientInitials.trim() || undefined,
                  ageYears: patientAgeYears ? Number(patientAgeYears) : undefined,
                  sex: patientSex,
                },
                suspectProducts: validProducts.map(({ key: _key, ...rest }) => rest),
                adverseEvents: validEvents.map(({ key: _key, ...rest }) => rest),
                consent: consentGranted === 'not_captured' ? undefined : { granted: consentGranted === 'yes', method: consentMethod },
              }
            : undefined,
      })
      setSuccess({ caseId: created.caseId ?? undefined })
      loadRecent()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not log this call.'))
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setCallerNumber('')
    setOccurredAt('')
    setDurationSeconds('')
    setOutcome('information_only')
    setNotes('')
    setIsVoicemail(false)
    setAudioDocumentId(null)
    setAudioFilename(null)
    setAudioError(null)
    setTranscriptionNote('')
    setReportTypeId('')
    setCountryOfOccurrenceId('')
    setCountryOfReportId('')
    setAwarenessDate('')
    setReceivedDate('')
    setReporterFullName('')
    setReporterPhone('')
    setReporterEmail('')
    setPatientInitials('')
    setPatientAgeYears('')
    setPatientSex('unknown')
    setProducts([emptyProduct()])
    setEvents([emptyEvent()])
    setConsentGranted('not_captured')
    setSuccess(null)
  }

  const columns: DataTableColumn<CallLog>[] = [
    { key: 'callerNumber', label: 'Caller' },
    {
      key: 'occurredAt',
      label: 'When',
      render: (v, row) => (
        <span className="inline-flex items-center gap-1.5">
          {formatDateTime(v as string)}
          {row.isAfterHours && (
            <span title="Outside business hours (08:00-18:00 Mon-Fri)">
              <Clock className="h-3.5 w-3.5 text-status-warning" />
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'outcome',
      label: 'Outcome',
      render: (v) => <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{CALL_OUTCOME_LABELS[v as CallOutcome]}</span>,
    },
    {
      key: 'isVoicemail',
      label: 'Type',
      render: (v) =>
        v ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Voicemail className="h-3.5 w-3.5" /> Voicemail
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="h-3.5 w-3.5" /> Live
          </span>
        ),
    },
    {
      key: 'caseId',
      label: 'Case',
      render: (v) => (v ? <span className="font-mono text-xs text-safemeds-teal">Linked</span> : <span className="text-xs text-muted-foreground">—</span>),
    },
  ]

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Log a Call</h1>
        <p className="mt-1 text-sm text-muted-foreground">Record a hotline/phone report and, if it results in a reportable case, capture it here too.</p>
      </div>

      {success ? (
        <div className="rounded-lg border border-status-success/30 bg-status-success/5 p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-status-success mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Call logged{success.caseId ? ' — case created' : ''}</p>
            <div className="mt-3 flex gap-3">
              {success.caseId && (
                <button onClick={() => router.push(`/pv-cases/${success.caseId}`)} className="text-sm font-medium text-safemeds-teal hover:underline">
                  Open the case →
                </button>
              )}
              <button onClick={resetForm} className="text-sm font-medium text-muted-foreground hover:text-foreground">
                Log another call
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <Section title="Call Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Caller number *</label>
                <input value={callerNumber} onChange={(e) => setCallerNumber(e.target.value)} placeholder="+254700000000" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Date and time *</label>
                <input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Duration (seconds)</label>
                <input type="number" min={0} value={durationSeconds} onChange={(e) => setDurationSeconds(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Outcome *</label>
                <select value={outcome} onChange={(e) => setOutcome(e.target.value as CallOutcome)} className={inputClass}>
                  {Object.entries(CALL_OUTCOME_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className={labelClass}>Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} placeholder="What the caller said, in brief" />
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm text-foreground cursor-pointer w-fit">
              <input type="checkbox" checked={isVoicemail} onChange={(e) => setIsVoicemail(e.target.checked)} className="h-4 w-4 rounded border-input" />
              <Voicemail className="h-4 w-4 text-muted-foreground" />
              Missed call / voicemail (no one answered live)
            </label>

            {isVoicemail && (
              <div className="mt-3 rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <div>
                  <label className={labelClass}>Recording (optional)</label>
                  {audioFilename ? (
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <FileAudio className="h-4 w-4 text-safemeds-teal" />
                      {audioFilename}
                      <button
                        type="button"
                        onClick={() => {
                          setAudioDocumentId(null)
                          setAudioFilename(null)
                        }}
                        className="text-xs text-muted-foreground hover:text-status-error"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <input
                      type="file"
                      accept="audio/*"
                      disabled={audioUploading || !companyId}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) void handleAudioSelect(file)
                      }}
                      className="text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-safemeds-teal file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-safemeds-spruce"
                    />
                  )}
                  {audioUploading && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
                    </p>
                  )}
                  {audioError && <p className="mt-1 text-xs text-status-error">{audioError}</p>}
                </div>
                <div>
                  <label className={labelClass}>Transcription note (optional)</label>
                  <textarea
                    value={transcriptionNote}
                    onChange={(e) => setTranscriptionNote(e.target.value)}
                    rows={2}
                    className={inputClass}
                    placeholder="What the voicemail said, if you listened to it"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Stored encrypted — only ever readable back through this app.</p>
                </div>
              </div>
            )}
          </Section>

          {outcome === 'case_created' && !refDataLoading && (
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
                  <div />
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
                    <label className={labelClass}>Awareness date *</label>
                    <input type="date" value={awarenessDate} onChange={(e) => setAwarenessDate(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Received date *</label>
                    <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className={inputClass} />
                  </div>
                </div>
              </Section>

              <Section title="Reporter">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Reporter type</label>
                    <select value={reporterType} onChange={(e) => setReporterType(e.target.value as ReporterType)} className={inputClass}>
                      <option value="consumer">Consumer / Patient</option>
                      <option value="healthcare_professional">Healthcare Professional</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Full name</label>
                    <input value={reporterFullName} onChange={(e) => setReporterFullName(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Phone</label>
                    <input value={reporterPhone} onChange={(e) => setReporterPhone(e.target.value)} placeholder="Defaults to the caller number" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Email</label>
                    <input type="email" value={reporterEmail} onChange={(e) => setReporterEmail(e.target.value)} className={inputClass} />
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
                </div>
              </Section>

              <Section title="Suspect Products" subtitle="At least one is required">
                <div className="space-y-3">
                  {products.map((product, index) => (
                    <div key={product.key} className="rounded-lg border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Product {index + 1}</p>
                        {products.length > 1 && (
                          <button onClick={() => setProducts((prev) => prev.filter((p) => p.key !== product.key))} className="text-muted-foreground hover:text-status-error">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className={labelClass}>Medicinal product *</label>
                          <input value={product.medicinalProduct} onChange={(e) => updateProduct(product.key, { medicinalProduct: e.target.value })} className={inputClass} />
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
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setProducts((prev) => [...prev, emptyProduct()])} className="flex items-center gap-1.5 text-sm font-medium text-safemeds-teal hover:underline">
                    <Plus className="h-4 w-4" /> Add another product
                  </button>
                </div>
              </Section>

              <Section title="Adverse Events" subtitle="At least one is required">
                <div className="space-y-3">
                  {events.map((event, index) => (
                    <div key={event.key} className="rounded-lg border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Event {index + 1}</p>
                        {events.length > 1 && (
                          <button onClick={() => setEvents((prev) => prev.filter((e) => e.key !== event.key))} className="text-muted-foreground hover:text-status-error">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div>
                        <label className={labelClass}>Reported term *</label>
                        <input value={event.reportedTerm} onChange={(e) => updateEvent(event.key, { reportedTerm: e.target.value })} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Narrative *</label>
                        <textarea value={event.narrative} onChange={(e) => updateEvent(event.key, { narrative: e.target.value })} rows={2} className={inputClass} />
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setEvents((prev) => [...prev, emptyEvent()])} className="flex items-center gap-1.5 text-sm font-medium text-safemeds-teal hover:underline">
                    <Plus className="h-4 w-4" /> Add another adverse event
                  </button>
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
                        <option value="verbal">Verbal</option>
                        <option value="written">Written</option>
                        <option value="implied">Implied</option>
                      </select>
                    </div>
                  )}
                </div>
              </Section>
            </>
          )}

          {error && (
            <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pb-6">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Log Call
            </button>
          </div>
        </>
      )}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Recent Calls</h2>
        </div>
        <div className="p-2">
          <DataTableV2 data={recentCalls} columns={columns} searchable={false} exportable={false} showDensityToggle={false} loading={recentLoading} />
        </div>
      </div>
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
