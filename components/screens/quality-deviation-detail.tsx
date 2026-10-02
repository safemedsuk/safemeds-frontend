'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Info, Loader2, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  DeviationDetail,
  DeviationSeverity,
  getDeviation,
  openCapaForDeviation,
  recordInvestigation,
  ROOT_CAUSE_METHOD_LABELS,
  ROOT_CAUSE_METHODS,
} from '@/lib/api/deviations'
import { DEVIATION_SOURCE_TYPE_LABELS } from '@/lib/api/deviations'
import type { AvailableTransition } from '@/lib/api/workflow'
import { postTransition } from '@/lib/api/workflow'
import { WorkflowActionsPanel } from '@/components/pv-cases/workflow-actions-panel'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const SEVERITY_STYLES: Record<DeviationSeverity, string> = {
  critical: 'bg-status-error/10 text-status-error',
  major: 'bg-status-warning/10 text-status-warning',
  minor: 'bg-status-info/10 text-status-info',
}

const STATUS_LABELS: Record<string, string> = {
  detected: 'Detected',
  classifying: 'Classifying',
  investigating: 'Investigating',
  capa_pending: 'CAPA Pending',
  closed: 'Closed',
}

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '—'
}

/**
 * QualCloud (Phase 13) Stage 2 — a deviation's own detail page: the
 * severity classification step (a custom `WorkflowActionsPanel`
 * trigger, since `classifying` needs a `payload.severity` the panel's
 * own generic click flow doesn't collect), the investigation record
 * (root-cause method/findings, reviewer distinct from investigator per
 * the four-eyes guard), and the "Open CAPA" action once CAPA Pending —
 * every other transition (investigating → capa_pending, the final
 * signature-gated close) runs through the panel exactly as-is.
 */
export function QualityDeviationDetail({ deviationId }: { deviationId: string }) {
  const router = useRouter()
  const { has } = usePermissions()
  const canLog = has('quality.log_deviation')
  const canManageCapa = has('quality.manage_capa')

  const [deviation, setDeviation] = useState<DeviationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [classifying, setClassifying] = useState<AvailableTransition | null>(null)
  const [showInvestigation, setShowInvestigation] = useState(false)
  const [showOpenCapa, setShowOpenCapa] = useState(false)

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    getDeviation(deviationId)
      .then(setDeviation)
      .catch((err) => setError(getErrorMessage(err, 'Could not load this deviation.')))
      .finally(() => setLoading(false))
  }, [deviationId])

  useEffect(() => load(), [load])

  const refresh = () => load(true)

  if (loading) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!deviation) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{error ?? 'Deviation not found.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <button onClick={() => router.push('/quality-deviations')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Deviations
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{deviation.deviationNumber}</p>
          <h1 className="text-2xl font-display font-bold text-foreground">{deviation.title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {DEVIATION_SOURCE_TYPE_LABELS[deviation.sourceType as keyof typeof DEVIATION_SOURCE_TYPE_LABELS] ?? deviation.sourceType} · Detected {formatDateTime(deviation.detectedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {deviation.severity && (
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${SEVERITY_STYLES[deviation.severity]}`}>{deviation.severity}</span>
          )}
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">{STATUS_LABELS[deviation.status] ?? deviation.status}</span>
        </div>
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      {deviation.description && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Description</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{deviation.description}</p>
        </div>
      )}

      {deviation.containmentActions && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Immediate Containment Actions</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{deviation.containmentActions}</p>
        </div>
      )}

      {deviation.investigationDueAt && (
        <div className="flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/5 p-3 text-xs leading-relaxed text-foreground">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-warning" />
          <p>Investigation due by <strong>{formatDateTime(deviation.investigationDueAt)}</strong>.</p>
        </div>
      )}

      <WorkflowActionsPanel
        key={deviation.status}
        workflowInstanceId={deviation.workflowInstanceId}
        onTransitioned={refresh}
        customTriggers={{
          classifying: { label: 'Classify Severity', onClick: (t) => setClassifying(t) },
        }}
      />

      {canLog && (deviation.status === 'investigating' || deviation.investigation) && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Investigation Record</p>
            {deviation.status === 'investigating' && (
              <button onClick={() => setShowInvestigation(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                {deviation.investigation ? 'Update Investigation' : 'Record Investigation'}
              </button>
            )}
          </div>
          {deviation.investigation ? (
            <div className="grid gap-2 text-sm">
              <p><span className="text-muted-foreground">Root-cause method:</span> {ROOT_CAUSE_METHOD_LABELS[deviation.investigation.rootCauseMethod as keyof typeof ROOT_CAUSE_METHOD_LABELS] ?? deviation.investigation.rootCauseMethod ?? '—'}</p>
              {deviation.investigation.findings && <p><span className="text-muted-foreground">Findings:</span> {deviation.investigation.findings}</p>}
              {deviation.investigation.evidenceReferences && <p><span className="text-muted-foreground">Evidence:</span> {deviation.investigation.evidenceReferences}</p>}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No investigation recorded yet.</p>
          )}
          <div className="flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 p-2.5 text-xs leading-relaxed text-muted-foreground">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-info" />
            <p>Four-eyes: whoever moves this to CAPA Pending as reviewer cannot also be the recorded investigator.</p>
          </div>
        </div>
      )}

      {canManageCapa && deviation.status === 'capa_pending' && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">CAPA</p>
          <p className="text-xs text-muted-foreground">A CAPA must be opened against this deviation before it can close.</p>
          <button onClick={() => setShowOpenCapa(true)} className="rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce">
            Open CAPA
          </button>
        </div>
      )}

      {classifying && (
        <ClassifySeverityModal
          workflowInstanceId={deviation.workflowInstanceId!}
          onClose={() => setClassifying(null)}
          onClassified={() => {
            setClassifying(null)
            setNotice('Severity classified.')
            refresh()
          }}
        />
      )}

      {showInvestigation && (
        <RecordInvestigationModal
          deviationId={deviation.id}
          existing={deviation.investigation}
          onClose={() => setShowInvestigation(false)}
          onRecorded={() => {
            setShowInvestigation(false)
            setNotice('Investigation recorded.')
            refresh()
          }}
        />
      )}

      {showOpenCapa && (
        <OpenCapaModal
          deviationId={deviation.id}
          onClose={() => setShowOpenCapa(false)}
          onOpened={() => {
            setShowOpenCapa(false)
            setNotice('CAPA opened against this deviation.')
            refresh()
          }}
        />
      )}
    </div>
  )
}

function ClassifySeverityModal({
  workflowInstanceId,
  onClose,
  onClassified,
}: {
  workflowInstanceId: string
  onClose: () => void
  onClassified: () => void
}) {
  const [severity, setSeverity] = useState<DeviationSeverity>('major')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await postTransition(workflowInstanceId, 'classifying', undefined, undefined, { severity })
      onClassified()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not classify this deviation.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-display font-bold text-base text-foreground">Classify Severity</h3>
        <p className="text-xs text-muted-foreground">Sets the real investigation deadline. Critical fires an immediate notification to Quality Managers.</p>
        <div className="space-y-2">
          {(['critical', 'major', 'minor'] as DeviationSeverity[]).map((s) => (
            <label key={s} className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm text-foreground hover:bg-muted cursor-pointer">
              <input type="radio" name="severity" checked={severity === s} onChange={() => setSeverity(s)} />
              <span className="capitalize font-medium">{s}</span>
            </label>
          ))}
        </div>
        {error && <p className="text-sm text-status-error">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Classify
          </button>
        </div>
      </div>
    </div>
  )
}

function RecordInvestigationModal({
  deviationId,
  existing,
  onClose,
  onRecorded,
}: {
  deviationId: string
  existing: DeviationDetail['investigation']
  onClose: () => void
  onRecorded: () => void
}) {
  const [rootCauseMethod, setRootCauseMethod] = useState(existing?.rootCauseMethod ?? '')
  const [findings, setFindings] = useState(existing?.findings ?? '')
  const [evidenceReferences, setEvidenceReferences] = useState(existing?.evidenceReferences ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await recordInvestigation(deviationId, {
        rootCauseMethod: rootCauseMethod || undefined,
        findings: findings.trim() || undefined,
        evidenceReferences: evidenceReferences.trim() || undefined,
      })
      onRecorded()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not record this investigation.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4 my-8">
        <h3 className="font-display font-bold text-base text-foreground">Investigation Record</h3>

        <div>
          <label className={labelClass}>Root-Cause Method</label>
          <select value={rootCauseMethod} onChange={(e) => setRootCauseMethod(e.target.value)} className={inputClass}>
            <option value="">Select a method</option>
            {ROOT_CAUSE_METHODS.map((m) => (
              <option key={m} value={m}>{ROOT_CAUSE_METHOD_LABELS[m]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Findings</label>
          <textarea value={findings} onChange={(e) => setFindings(e.target.value)} rows={4} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Evidence References</label>
          <textarea value={evidenceReferences} onChange={(e) => setEvidenceReferences(e.target.value)} rows={2} className={inputClass} placeholder="e.g. document IDs, batch records, photos" />
        </div>

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function OpenCapaModal({ deviationId, onClose, onOpened }: { deviationId: string; onClose: () => void; onOpened: () => void }) {
  const [title, setTitle] = useState('')
  const [correctiveAction, setCorrectiveAction] = useState('')
  const [preventiveAction, setPreventiveAction] = useState('')
  const [rootCauseCategory, setRootCauseCategory] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = title.trim().length > 0 && correctiveAction.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await openCapaForDeviation(deviationId, {
        title: title.trim(),
        correctiveAction: correctiveAction.trim(),
        preventiveAction: preventiveAction.trim() || undefined,
        rootCauseCategory: rootCauseCategory.trim() || undefined,
        dueDate: dueDate || undefined,
      })
      onOpened()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not open this CAPA.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4 my-8">
        <h3 className="font-display font-bold text-base text-foreground">Open CAPA for this Deviation</h3>

        <div>
          <label className={labelClass}>Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Corrective Action *</label>
          <textarea value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} rows={3} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Preventive Action</label>
          <textarea value={preventiveAction} onChange={(e) => setPreventiveAction(e.target.value)} rows={2} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Root-Cause Category</label>
            <input value={rootCauseCategory} onChange={(e) => setRootCauseCategory(e.target.value)} placeholder="e.g. operator_error" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
          </div>
        </div>

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Open CAPA
          </button>
        </div>
      </div>
    </div>
  )
}
