'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Link2, Loader2, Radar, Search } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { PvCase, listPvCases } from '@/lib/api/pv-cases'
import {
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
        setError(getErrorMessage(err, 'Could not load this signal.'))
      } finally {
        if (!silent) setLoading(false)
      }
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
        <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error ?? 'Signal not found.'}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <button onClick={() => router.push('/pv-signals')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Signals
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
              {signal.batchNumber ? ` · Batch ${signal.batchNumber}` : ' · All batches'} · {signal.detectionMethod === 'pattern_flag' ? 'Automatic pattern flag' : 'Manually raised'}
            </span>
            {signal.productId && (
              <span className="flex items-center gap-1 rounded-full bg-status-success/10 px-2 py-0.5 text-xs font-medium text-status-success" title="This product name was matched to a real record in your product catalog">
                <CheckCircle2 className="h-3 w-3" /> Catalog-linked
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

function EvidenceCasesCard({ signal, canManage, onLinked, setNotice, setError }: CardProps & { onLinked: () => void }) {
  const router = useRouter()
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
      setError(getErrorMessage(err, 'Could not search cases.'))
    } finally {
      setSearching(false)
    }
  }

  const link = async (caseId: string) => {
    setLinking(caseId)
    try {
      await linkCasesToSignal(signal.id, [caseId])
      setNotice('Case linked as evidence.')
      onLinked()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not link this case.'))
    } finally {
      setLinking(null)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Evidence Cases</h2>
          <p className="text-xs text-muted-foreground">
            {signal.linkedCases.length} linked · {signal.strengthOfEvidenceCaseCount ?? '—'} de-duplicated (strength of evidence, computed at validation)
          </p>
        </div>
        {canManage && (
          <button onClick={() => setShowSearch((s) => !s)} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
            <Link2 className="h-3.5 w-3.5" /> Link a Case
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
              placeholder="Search by reference number"
              className={inputClass}
            />
            <button onClick={runSearch} disabled={searching} className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-2 text-xs font-medium text-white disabled:opacity-50">
              {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              Search
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
                    <span className="text-xs text-muted-foreground">Already linked</span>
                  ) : (
                    <button onClick={() => link(c.id)} disabled={linking === c.id} className="text-xs font-medium text-safemeds-teal hover:underline disabled:opacity-50">
                      {linking === c.id ? 'Linking…' : 'Link'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {signal.linkedCases.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cases linked yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {signal.linkedCases.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2 text-sm">
              <button onClick={() => router.push(`/pv-cases/${c.id}`)} className="font-mono text-xs text-foreground hover:text-safemeds-teal hover:underline">
                {c.referenceNumber}
              </button>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {c.status}
                {c.duplicateOfCaseId && <span className="rounded-full bg-muted px-2 py-0.5">duplicate — excluded from evidence count</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ValidationCard({ signal, canManage, onSaved, setNotice, setError }: CardProps & { onSaved: () => void }) {
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
      setNotice('Validation details saved.')
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save validation details.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-1 text-sm font-semibold text-foreground">Validation</h2>
      <p className="mb-3 text-xs text-muted-foreground">Is this genuinely new? Strength of evidence is computed automatically from linked, de-duplicated cases.</p>
      <div className="space-y-3">
        <div>
          <label className={labelClass}>Previously known?</label>
          <select
            disabled={!canManage}
            value={previousAwareness === '' ? '' : previousAwareness ? 'yes' : 'no'}
            onChange={(e) => setPreviousAwareness(e.target.value === '' ? '' : e.target.value === 'yes')}
            className={inputClass}
          >
            <option value="">Not yet assessed</option>
            <option value="no">No — previously unknown</option>
            <option value="yes">Yes — already known</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Prior-awareness note</label>
          <textarea disabled={!canManage} value={previousAwarenessNote} onChange={(e) => setPreviousAwarenessNote(e.target.value)} rows={2} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Clinical relevance</label>
          <textarea disabled={!canManage} value={clinicalRelevanceNote} onChange={(e) => setClinicalRelevanceNote(e.target.value)} rows={2} className={inputClass} />
        </div>
        {canManage && (
          <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-xs font-medium text-white disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Validation
          </button>
        )}
      </div>
    </div>
  )
}

function PrioritisationCard({ signal, canManage, onSaved, setNotice, setError }: CardProps & { onSaved: () => void }) {
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
      setNotice('Prioritisation details saved.')
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save prioritisation details.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-1 text-sm font-semibold text-foreground">Analysis &amp; Prioritisation</h2>
      <p className="mb-3 text-xs text-muted-foreground">Severity, patient exposure, and the expected regulatory response — what determines how urgently this needs review.</p>
      <div className="space-y-3">
        <div>
          <label className={labelClass}>Severity</label>
          <textarea disabled={!canManage} value={severityNote} onChange={(e) => setSeverityNote(e.target.value)} rows={2} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Patient exposure</label>
          <textarea disabled={!canManage} value={patientExposureNote} onChange={(e) => setPatientExposureNote(e.target.value)} rows={2} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Expected regulatory response</label>
          <textarea disabled={!canManage} value={expectedRegulatoryResponseNote} onChange={(e) => setExpectedRegulatoryResponseNote(e.target.value)} rows={2} className={inputClass} />
        </div>
        {canManage && (
          <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-xs font-medium text-white disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Prioritisation
          </button>
        )}
      </div>
    </div>
  )
}

function AssessmentCard({ signal, canManage, onSaved, setNotice, setError }: CardProps & { onSaved: () => void }) {
  const [assessmentNote, setAssessmentNote] = useState(signal.assessmentNote ?? '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (assessmentNote.trim().length === 0) return
    setSaving(true)
    try {
      await recordSignalAssessment(signal.id, { assessmentNote: assessmentNote.trim() })
      setNotice('Assessment saved.')
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save the assessment.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-1 text-sm font-semibold text-foreground">Assessment</h2>
      <p className="mb-3 text-xs text-muted-foreground">The QPPV&apos;s medical/scientific judgment on whether this is a genuine safety signal.</p>
      <textarea disabled={!canManage} value={assessmentNote} onChange={(e) => setAssessmentNote(e.target.value)} rows={3} placeholder="Assessment note" className={inputClass} />
      {canManage && (
        <button
          onClick={save}
          disabled={saving || assessmentNote.trim().length === 0}
          className="mt-3 flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save Assessment
        </button>
      )}
    </div>
  )
}

function RecommendationCard({ signal, canManage, onSaved, setNotice, setError }: CardProps & { onSaved: () => void }) {
  const [recommendationAction, setRecommendationAction] = useState<SignalRecommendationAction | ''>(signal.recommendationAction ?? '')
  const [recommendationNote, setRecommendationNote] = useState(signal.recommendationNote ?? '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (recommendationAction === '') return
    setSaving(true)
    try {
      await recordSignalRecommendation(signal.id, { recommendationAction, recommendationNote: recommendationNote.trim() || undefined })
      setNotice('Recommendation saved.')
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save the recommendation.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-1 text-sm font-semibold text-foreground">Recommendation for Action</h2>
      <p className="mb-3 text-xs text-muted-foreground">Only takes effect once formally moved to &quot;Action Recommended&quot; via a signed workflow transition, below.</p>
      <div className="space-y-3">
        <div>
          <label className={labelClass}>Recommended action</label>
          <select disabled={!canManage} value={recommendationAction} onChange={(e) => setRecommendationAction(e.target.value as SignalRecommendationAction)} className={inputClass}>
            <option value="">Select an action</option>
            {Object.entries(SIGNAL_RECOMMENDATION_ACTION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Note</label>
          <textarea disabled={!canManage} value={recommendationNote} onChange={(e) => setRecommendationNote(e.target.value)} rows={2} className={inputClass} />
        </div>
        {canManage && (
          <button
            onClick={save}
            disabled={saving || recommendationAction === ''}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Recommendation
          </button>
        )}
      </div>
    </div>
  )
}

