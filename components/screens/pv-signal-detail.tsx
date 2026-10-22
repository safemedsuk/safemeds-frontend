'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, FileText, Link2, Loader2, Radar, Search, UploadCloud } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { PvCase, listPvCases } from '@/lib/api/pv-cases'
import { attachReportEvidence, GeneratedReport, listGeneratedReports } from '@/lib/api/reports'
import { getDownloadUrl, listDocuments } from '@/lib/api/documents'
import {
  generateSignalReport,
  getSignal,
  linkCasesToSignal,
  recordSignalAssessment,
  recordSignalPrioritisation,
  recordSignalRecommendation,
  recordSignalValidation,
  SIGNAL_RECOMMENDATION_ACTION_LABELS,
  SIGNAL_STATUS_LABELS,
  SignalRecommendationAction,
  SignalStatus,
  SignalWithDetail,
} from '@/lib/api/signals'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { WorkflowActionsPanel } from '@/components/pv-cases/workflow-actions-panel'
import { RecordTasksPanel } from '@/components/tasks/record-tasks-panel'
import { DecisionHistoryCard } from '@/components/ui/decision-history-card'
import { DocumentPreviewModal } from '@/components/ui/document-preview-modal'
import { useTranslation } from '@/lib/i18n/use-translation'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const STATUS_STYLES: Record<SignalStatus, string> = {
  detected: 'bg-status-warning/10 text-status-warning',
  validated: 'bg-status-info/10 text-status-info',
  non_validated: 'bg-muted text-muted-foreground',
  confirmed: 'bg-status-info/10 text-status-info',
  not_confirmed: 'bg-muted text-muted-foreground',
  analysed_prioritised: 'bg-status-info/10 text-status-info',
  assessed: 'bg-status-info/10 text-status-info',
  action_recommended: 'bg-status-success/10 text-status-success',
  refuted: 'bg-muted text-muted-foreground',
}

interface Props {
  signalId: string
}

/**
 * VigiCloud Stage 17 — Signal Management (GVP Module IX). Lifecycle data
 * (validation/prioritisation/assessment/recommendation) is deliberately
 * always editable regardless of the signal's current state — matching
 * `SignalService`'s own documented design (a QPPV can fill in
 * prioritisation notes before formally transitioning into that state).
 * Only the transition itself, via `WorkflowActionsPanel`, is gated —
 * both by role and, here specifically, by `requireNote` (every signal
 * transition requires a documented rationale).
 */
export function PvSignalDetail({ signalId }: Props) {
  const router = useRouter()
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canManage = has('pv.manage_signals')

  const [signal, setSignal] = useState<SignalWithDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()

  // `silent` refreshes must never re-show the spinner — see
  // `pv-case-detail.tsx`'s identical fix for the full reasoning (every
  // save action on this page used to unmount the whole page behind a
  // bare spinner, resetting scroll position).
  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      setError(null)
      try {
        setSignal(await getSignal(signalId))
      } catch (err) {
        setError(getErrorMessage(err, t('pvSignalDetail.errorLoad')))
      } finally {
        if (!silent) setLoading(false)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [signalId],
  )

  const refresh = useCallback(() => load(true), [load])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !signal) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error ?? t('pvSignalDetail.notFound')}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <button onClick={() => router.push('/pv-signals')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t('pvSignalDetail.backToSignals')}
      </button>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Radar className="h-6 w-6 text-safemeds-teal" />
            <h1 className="text-2xl font-display font-bold text-foreground">{signal.title}</h1>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>
              {signal.productIdentifier}
              {signal.batchNumber ? t('pvSignalDetail.batchInfo', { batch: signal.batchNumber }) : t('pvSignalDetail.allBatches')} ·{' '}
              {signal.detectionMethod === 'pattern_flag' ? t('pvSignalDetail.automaticPatternFlag') : t('pvSignalDetail.manuallyRaised')}
            </span>
            {signal.productId && (
              <span className="flex items-center gap-1 rounded-full bg-status-success/10 px-2 py-0.5 text-xs font-medium text-status-success" title={t('pvSignalDetail.catalogLinkedTitle')}>
                <CheckCircle2 className="h-3 w-3" /> {t('pvSignalDetail.catalogLinked')}
              </span>
            )}
          </p>
          <p className="mt-2 text-sm text-foreground">{signal.description}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap ${STATUS_STYLES[signal.status]}`}>{SIGNAL_STATUS_LABELS[signal.status]}</span>
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}

      <WorkflowActionsPanel workflowInstanceId={signal.workflowInstanceId} onTransitioned={refresh} requireNote />

      <RecordTasksPanel recordType="signal" recordId={signal.id} />

      <SignalReportsCard signal={signal} canManage={canManage} setNotice={setNotice} setError={setError} />

      <EvidenceCasesCard signal={signal} canManage={canManage} onLinked={refresh} setNotice={setNotice} setError={setError} />

      <ValidationCard signal={signal} canManage={canManage} onSaved={refresh} setNotice={setNotice} setError={setError} />
      <PrioritisationCard signal={signal} canManage={canManage} onSaved={refresh} setNotice={setNotice} setError={setError} />
      <AssessmentCard signal={signal} canManage={canManage} onSaved={refresh} setNotice={setNotice} setError={setError} />
      <RecommendationCard signal={signal} canManage={canManage} onSaved={refresh} setNotice={setNotice} setError={setError} />

      <DecisionHistoryCard entries={signal.transitionHistory} resolveLabel={(key) => SIGNAL_STATUS_LABELS[key as SignalStatus] ?? key} />
    </div>
  )
}

interface CardProps {
  signal: SignalWithDetail
  canManage: boolean
  setNotice: (msg: string) => void
  setError: (msg: string | null) => void
}

/**
 * Real-usage request, 22 Sep 2026 (item 22) — "generate signal reports;
 * clients should be able to upload proof they submitted the report to
 * the authority." Every generation is tracked via the generic
 * `GeneratedReport` primitive (`lib/api/reports.ts`) — the same one
 * every periodic report already uses — filtered to this one signal.
 */
function SignalReportsCard({ signal, canManage, setNotice, setError }: CardProps) {
  const { t } = useTranslation()
  const [reports, setReports] = useState<GeneratedReport[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [previewing, setPreviewing] = useState<{ documentId: string; versionId: string; filename: string; contentType: string } | null>(null)
  const [attachingId, setAttachingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { reports: rows } = await listGeneratedReports({ recordType: 'signal', recordId: signal.id })
      setReports(rows)
    } catch {
      // Best-effort — the signal itself already loaded; a reports-list hiccup shouldn't block the page.
    } finally {
      setLoading(false)
    }
  }, [signal.id])

  useEffect(() => {
    void load()
  }, [load])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await generateSignalReport(signal.id)
      setNotice(t('pvSignalDetail.signalReportGenerated'))
      await load()
    } catch (err) {
      setError(getErrorMessage(err, t('pvSignalDetail.errorGenerateReport')))
    } finally {
      setGenerating(false)
    }
  }

  const handleView = async (reportId: string) => {
    setError(null)
    try {
      const docs = await listDocuments('generated_report', reportId)
      const latestVersion = docs[0]?.versions[0]
      if (!latestVersion) throw new Error('Report document not found')
      setPreviewing({ documentId: docs[0].id, versionId: latestVersion.id, filename: latestVersion.filename, contentType: latestVersion.contentType })
    } catch (err) {
      setError(getErrorMessage(err, t('pvSignalDetail.errorLoadReport')))
    }
  }

  const handleAttachEvidence = async (reportId: string, file: File) => {
    setAttachingId(reportId)
    setError(null)
    try {
      await attachReportEvidence(reportId, file)
      setNotice(t('pvSignalDetail.submissionEvidenceAttachedNotice'))
      await load()
    } catch (err) {
      setError(getErrorMessage(err, t('pvSignalDetail.errorAttachEvidence')))
    } finally {
      setAttachingId(null)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t('pvSignalDetail.signalReports')}</h2>
          <p className="text-xs text-muted-foreground">{t('pvSignalDetail.signalReportsHelp')}</p>
        </div>
        {canManage && (
          <button onClick={handleGenerate} disabled={generating} className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50 whitespace-nowrap">
            {generating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t('pvSignalDetail.generateReport')}
          </button>
        )}
      </div>

      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('pvSignalDetail.noReportYet')}</p>
      ) : (
        <ul className="space-y-2">
          {reports.map((r) => (
            <li key={r.id} className="rounded-md border border-border/60 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button onClick={() => handleView(r.id)} className="flex items-center gap-1.5 text-xs font-medium text-safemeds-teal hover:underline">
                  <FileText className="h-3.5 w-3.5" /> {new Date(r.createdAt).toLocaleString()}
                </button>
                {r.evidenceDocumentId ? (
                  <span className="flex items-center gap-1 rounded-full bg-status-success/10 px-2 py-0.5 text-xs font-medium text-status-success">
                    <CheckCircle2 className="h-3 w-3" /> {t('pvSignalDetail.submissionEvidenceAttached')}
                  </span>
                ) : canManage ? (
                  <EvidenceUpload busy={attachingId === r.id} onUpload={(file) => handleAttachEvidence(r.id, file)} />
                ) : (
                  <span className="text-xs text-muted-foreground">{t('pvSignalDetail.awaitingProofOfSubmission')}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {previewing && (
        <DocumentPreviewModal
          title={t('pvSignalDetail.signalReportTitle')}
          filename={previewing.filename}
          contentType={previewing.contentType}
          getUrl={() => getDownloadUrl(previewing.documentId, previewing.versionId)}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  )
}

function EvidenceUpload({ busy, onUpload }: { busy: boolean; onUpload: (file: File) => void }) {
  const { t } = useTranslation()
  return (
    <label className="flex items-center gap-1.5 text-xs font-medium text-safemeds-teal hover:underline cursor-pointer">
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
      {t('pvSignalDetail.attachProofOfSubmission')}
      <input
        type="file"
        className="hidden"
        disabled={busy}
        onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
      />
    </label>
  )
}

function EvidenceCasesCard({ signal, canManage, onLinked, setNotice, setError }: CardProps & { onLinked: () => void }) {
  const router = useRouter()
  const { t } = useTranslation()
  const [showSearch, setShowSearch] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PvCase[]>([])
  const [searching, setSearching] = useState(false)
  const [linking, setLinking] = useState<string | null>(null)

  const linkedIds = new Set(signal.linkedCases.map((c) => c.id))

  const runSearch = async () => {
    setSearching(true)
    try {
      const { cases } = await listPvCases({ search: query.trim() || undefined, limit: 10 })
      setResults(cases)
    } catch (err) {
      setError(getErrorMessage(err, t('pvSignalDetail.errorSearchCases')))
    } finally {
      setSearching(false)
    }
  }

  const link = async (caseId: string) => {
    setLinking(caseId)
    try {
      await linkCasesToSignal(signal.id, [caseId])
      setNotice(t('pvSignalDetail.caseLinkedAsEvidence'))
      onLinked()
    } catch (err) {
      setError(getErrorMessage(err, t('pvSignalDetail.errorLinkCase')))
    } finally {
      setLinking(null)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t('pvSignalDetail.evidenceCases')}</h2>
          <p className="text-xs text-muted-foreground">
            {t('pvSignalDetail.linkedDeduplicated', { linked: signal.linkedCases.length, strength: signal.strengthOfEvidenceCaseCount ?? '—' })}
          </p>
        </div>
        {canManage && (
          <button onClick={() => setShowSearch((s) => !s)} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
            <Link2 className="h-3.5 w-3.5" /> {t('pvSignalDetail.linkACase')}
          </button>
        )}
      </div>

      {showSearch && (
        <div className="mb-3 rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder={t('pvSignalDetail.searchByReferenceNumber')}
              className={inputClass}
            />
            <button onClick={runSearch} disabled={searching} className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-2 text-xs font-medium text-white disabled:opacity-50">
              {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              {t('pvSignalDetail.search')}
            </button>
          </div>
          {results.length > 0 && (
            <ul className="mt-2 divide-y divide-border">
              {results.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="font-mono text-xs text-foreground">
                    {c.referenceNumber} <span className="text-muted-foreground">({c.status})</span>
                  </span>
                  {linkedIds.has(c.id) ? (
                    <span className="text-xs text-muted-foreground">{t('pvSignalDetail.alreadyLinked')}</span>
                  ) : (
                    <button onClick={() => link(c.id)} disabled={linking === c.id} className="text-xs font-medium text-safemeds-teal hover:underline disabled:opacity-50">
                      {linking === c.id ? t('pvSignalDetail.linking') : t('pvSignalDetail.link')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {signal.linkedCases.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('pvSignalDetail.noCasesLinkedYet')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {signal.linkedCases.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2 text-sm">
              <button onClick={() => router.push(`/pv-cases/${c.id}`)} className="font-mono text-xs text-foreground hover:text-safemeds-teal hover:underline">
                {c.referenceNumber}
              </button>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {c.status}
                {c.duplicateOfCaseId && <span className="rounded-full bg-muted px-2 py-0.5">{t('pvSignalDetail.duplicateExcluded')}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ValidationCard({ signal, canManage, onSaved, setNotice, setError }: CardProps & { onSaved: () => void }) {
  const { t } = useTranslation()
  const [previousAwareness, setPreviousAwareness] = useState<boolean | ''>(signal.previousAwareness ?? '')
  const [previousAwarenessNote, setPreviousAwarenessNote] = useState(signal.previousAwarenessNote ?? '')
  const [clinicalRelevanceNote, setClinicalRelevanceNote] = useState(signal.clinicalRelevanceNote ?? '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await recordSignalValidation(signal.id, {
        previousAwareness: previousAwareness === '' ? undefined : previousAwareness,
        previousAwarenessNote: previousAwarenessNote.trim() || undefined,
        clinicalRelevanceNote: clinicalRelevanceNote.trim() || undefined,
      })
      setNotice(t('pvSignalDetail.validationSaved'))
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, t('pvSignalDetail.errorSaveValidation')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-1 text-sm font-semibold text-foreground">{t('pvSignalDetail.validation')}</h2>
      <p className="mb-3 text-xs text-muted-foreground">{t('pvSignalDetail.validationHelp')}</p>
      <div className="space-y-3">
        <div>
          <label className={labelClass}>{t('pvSignalDetail.previouslyKnown')}</label>
          <select
            disabled={!canManage}
            value={previousAwareness === '' ? '' : previousAwareness ? 'yes' : 'no'}
            onChange={(e) => setPreviousAwareness(e.target.value === '' ? '' : e.target.value === 'yes')}
            className={inputClass}
          >
            <option value="">{t('pvSignalDetail.notYetAssessed')}</option>
            <option value="no">{t('pvSignalDetail.previouslyUnknown')}</option>
            <option value="yes">{t('pvSignalDetail.alreadyKnown')}</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>{t('pvSignalDetail.priorAwarenessNote')}</label>
          <textarea disabled={!canManage} value={previousAwarenessNote} onChange={(e) => setPreviousAwarenessNote(e.target.value)} rows={2} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t('pvSignalDetail.clinicalRelevance')}</label>
          <textarea disabled={!canManage} value={clinicalRelevanceNote} onChange={(e) => setClinicalRelevanceNote(e.target.value)} rows={2} className={inputClass} />
        </div>
        {canManage && (
          <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-xs font-medium text-white disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t('pvSignalDetail.saveValidation')}
          </button>
        )}
      </div>
    </div>
  )
}

function PrioritisationCard({ signal, canManage, onSaved, setNotice, setError }: CardProps & { onSaved: () => void }) {
  const { t } = useTranslation()
  const [severityNote, setSeverityNote] = useState(signal.severityNote ?? '')
  const [patientExposureNote, setPatientExposureNote] = useState(signal.patientExposureNote ?? '')
  const [expectedRegulatoryResponseNote, setExpectedRegulatoryResponseNote] = useState(signal.expectedRegulatoryResponseNote ?? '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await recordSignalPrioritisation(signal.id, {
        severityNote: severityNote.trim() || undefined,
        patientExposureNote: patientExposureNote.trim() || undefined,
        expectedRegulatoryResponseNote: expectedRegulatoryResponseNote.trim() || undefined,
      })
      setNotice(t('pvSignalDetail.prioritisationSaved'))
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, t('pvSignalDetail.errorSavePrioritisation')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-1 text-sm font-semibold text-foreground">{t('pvSignalDetail.analysisPrioritisation')}</h2>
      <p className="mb-3 text-xs text-muted-foreground">{t('pvSignalDetail.prioritisationHelp')}</p>
      <div className="space-y-3">
        <div>
          <label className={labelClass}>{t('pvSignalDetail.severity')}</label>
          <textarea disabled={!canManage} value={severityNote} onChange={(e) => setSeverityNote(e.target.value)} rows={2} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t('pvSignalDetail.patientExposure')}</label>
          <textarea disabled={!canManage} value={patientExposureNote} onChange={(e) => setPatientExposureNote(e.target.value)} rows={2} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t('pvSignalDetail.expectedRegulatoryResponse')}</label>
          <textarea disabled={!canManage} value={expectedRegulatoryResponseNote} onChange={(e) => setExpectedRegulatoryResponseNote(e.target.value)} rows={2} className={inputClass} />
        </div>
        {canManage && (
          <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-xs font-medium text-white disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t('pvSignalDetail.savePrioritisation')}
          </button>
        )}
      </div>
    </div>
  )
}

function AssessmentCard({ signal, canManage, onSaved, setNotice, setError }: CardProps & { onSaved: () => void }) {
  const { t } = useTranslation()
  const [assessmentNote, setAssessmentNote] = useState(signal.assessmentNote ?? '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (assessmentNote.trim().length === 0) return
    setSaving(true)
    try {
      await recordSignalAssessment(signal.id, { assessmentNote: assessmentNote.trim() })
      setNotice(t('pvSignalDetail.assessmentSaved'))
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, t('pvSignalDetail.errorSaveAssessment')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-1 text-sm font-semibold text-foreground">{t('pvSignalDetail.assessment')}</h2>
      <p className="mb-3 text-xs text-muted-foreground">{t('pvSignalDetail.assessmentHelp')}</p>
      <textarea disabled={!canManage} value={assessmentNote} onChange={(e) => setAssessmentNote(e.target.value)} rows={3} placeholder={t('pvSignalDetail.assessmentNotePlaceholder')} className={inputClass} />
      {canManage && (
        <button
          onClick={save}
          disabled={saving || assessmentNote.trim().length === 0}
          className="mt-3 flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t('pvSignalDetail.saveAssessment')}
        </button>
      )}
    </div>
  )
}

function RecommendationCard({ signal, canManage, onSaved, setNotice, setError }: CardProps & { onSaved: () => void }) {
  const { t } = useTranslation()
  const [recommendationAction, setRecommendationAction] = useState<SignalRecommendationAction | ''>(signal.recommendationAction ?? '')
  const [recommendationNote, setRecommendationNote] = useState(signal.recommendationNote ?? '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (recommendationAction === '') return
    setSaving(true)
    try {
      await recordSignalRecommendation(signal.id, { recommendationAction, recommendationNote: recommendationNote.trim() || undefined })
      setNotice(t('pvSignalDetail.recommendationSaved'))
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, t('pvSignalDetail.errorSaveRecommendation')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-1 text-sm font-semibold text-foreground">{t('pvSignalDetail.recommendationForAction')}</h2>
      <p className="mb-3 text-xs text-muted-foreground">{t('pvSignalDetail.recommendationHelp')}</p>
      <div className="space-y-3">
        <div>
          <label className={labelClass}>{t('pvSignalDetail.recommendedAction')}</label>
          <select disabled={!canManage} value={recommendationAction} onChange={(e) => setRecommendationAction(e.target.value as SignalRecommendationAction)} className={inputClass}>
            <option value="">{t('pvSignalDetail.selectAnAction')}</option>
            {Object.entries(SIGNAL_RECOMMENDATION_ACTION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t('pvSignalDetail.note')}</label>
          <textarea disabled={!canManage} value={recommendationNote} onChange={(e) => setRecommendationNote(e.target.value)} rows={2} className={inputClass} />
        </div>
        {canManage && (
          <button
            onClick={save}
            disabled={saving || recommendationAction === ''}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t('pvSignalDetail.saveRecommendation')}
          </button>
        )}
      </div>
    </div>
  )
}

