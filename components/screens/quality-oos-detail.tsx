'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  OOS_BATCH_IMPACT_LABELS,
  OOS_BATCH_IMPACTS,
  OosDetail,
  openCapaForOos,
  recordOosPhase1,
  recordOosPhase2,
  recordOosRetest,
  getOos,
} from '@/lib/api/oos'
import { WorkflowActionsPanel } from '@/components/pv-cases/workflow-actions-panel'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const STATUS_LABELS: Record<string, string> = {
  phase_1_lab_investigation: 'Phase 1 — Lab Investigation',
  phase_2_manufacturing_investigation: 'Phase 2 — Manufacturing Investigation',
  closed: 'Closed',
}

export function QualityOosDetail({ oosId }: { oosId: string }) {
  const router = useRouter()
  const { has } = usePermissions()
  const canLog = has('quality.log_deviation')
  const canManageCapa = has('quality.manage_capa')

  const [oos, setOos] = useState<OosDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showPhase1, setShowPhase1] = useState(false)
  const [showRetest, setShowRetest] = useState(false)
  const [showPhase2, setShowPhase2] = useState(false)
  const [showOpenCapa, setShowOpenCapa] = useState(false)

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    getOos(oosId)
      .then(setOos)
      .catch((err) => setError(getErrorMessage(err, 'Could not load this OOS investigation.')))
      .finally(() => setLoading(false))
  }, [oosId])

  useEffect(() => load(), [load])

  const refresh = () => load(true)

  if (loading) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!oos) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{error ?? 'OOS investigation not found.'}</p>
        </div>
      </div>
    )
  }

  const inPhase2 = oos.investigationPhase === 'phase_2_manufacturing_investigation' || oos.investigationPhase === 'closed'

  return (
    <div className="space-y-6 p-6">
      <button onClick={() => router.push('/quality-oos')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to OOS/OOT Investigations
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{oos.oosNumber}</p>
          <h1 className="text-2xl font-display font-bold text-foreground">Test Result: {oos.testResult}</h1>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">{STATUS_LABELS[oos.status] ?? oos.status}</span>
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <WorkflowActionsPanel key={oos.status} workflowInstanceId={oos.workflowInstanceId} onTransitioned={refresh} />

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phase 1 — Lab Investigation</p>
          {canLog && oos.status !== 'closed' && (
            <button onClick={() => setShowPhase1(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
              {oos.phase1Findings ? 'Update' : 'Record Findings'}
            </button>
          )}
        </div>
        {oos.phase1AssignableCauseFound == null ? (
          <p className="text-xs text-muted-foreground">Not yet recorded.</p>
        ) : (
          <>
            <p className={`text-sm ${oos.phase1AssignableCauseFound ? 'text-status-success' : 'text-status-warning'}`}>
              {oos.phase1AssignableCauseFound ? 'Assignable lab cause found' : 'No assignable lab cause found'}
            </p>
            {oos.phase1Findings && <p className="text-sm text-foreground mt-1">{oos.phase1Findings}</p>}
          </>
        )}
      </div>

      {oos.phase1AssignableCauseFound === false && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Retest Decision</p>
            {canLog && !oos.retestRationale && (
              <button onClick={() => setShowRetest(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                Record Decision
              </button>
            )}
          </div>
          {oos.retestRationale ? (
            <>
              <p className="text-sm text-foreground">{oos.retestAuthorized ? 'Retest authorized' : 'Retest declined'}</p>
              <p className="text-xs text-muted-foreground mt-1">{oos.retestRationale}</p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No retest decision recorded yet — a written rationale is always required, whether authorizing or declining.</p>
          )}
        </div>
      )}

      {inPhase2 && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phase 2 — Manufacturing Investigation</p>
            {canLog && oos.status !== 'closed' && (
              <button onClick={() => setShowPhase2(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                {oos.phase2Findings ? 'Update' : 'Record Findings'}
              </button>
            )}
          </div>
          {oos.phase2Findings ? (
            <>
              <p className="text-sm text-foreground">{oos.phase2Findings}</p>
              {oos.batchImpact && <p className="text-xs text-muted-foreground mt-1">Batch Impact: {OOS_BATCH_IMPACT_LABELS[oos.batchImpact as keyof typeof OOS_BATCH_IMPACT_LABELS] ?? oos.batchImpact}</p>}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Not yet recorded.</p>
          )}
        </div>
      )}

      {canManageCapa && !oos.capaId && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">CAPA</p>
          <button onClick={() => setShowOpenCapa(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
            Open CAPA
          </button>
        </div>
      )}

      {showPhase1 && (
        <Phase1Modal
          initialFindings={oos.phase1Findings}
          initialCauseFound={oos.phase1AssignableCauseFound}
          onClose={() => setShowPhase1(false)}
          onSubmit={async (input) => {
            await recordOosPhase1(oos.id, input)
            setShowPhase1(false)
            setNotice('Phase 1 findings recorded.')
            refresh()
          }}
        />
      )}

      {showRetest && (
        <RetestModal
          onClose={() => setShowRetest(false)}
          onSubmit={async (input) => {
            await recordOosRetest(oos.id, input)
            setShowRetest(false)
            setNotice('Retest decision recorded.')
            refresh()
          }}
        />
      )}

      {showPhase2 && (
        <Phase2Modal
          initialFindings={oos.phase2Findings}
          onClose={() => setShowPhase2(false)}
          onSubmit={async (input) => {
            await recordOosPhase2(oos.id, input)
            setShowPhase2(false)
            setNotice('Phase 2 findings recorded.')
            refresh()
          }}
        />
      )}

      {showOpenCapa && (
        <OpenCapaModal
          onClose={() => setShowOpenCapa(false)}
          onSubmit={async (input) => {
            await openCapaForOos(oos.id, input)
            setShowOpenCapa(false)
            setNotice('CAPA opened.')
            refresh()
          }}
        />
      )}
    </div>
  )
}

function Phase1Modal({
  initialFindings,
  initialCauseFound,
  onClose,
  onSubmit,
}: {
  initialFindings: string | null
  initialCauseFound: boolean | null
  onClose: () => void
  onSubmit: (input: { assignableCauseFound: boolean; findings?: string }) => Promise<void>
}) {
  const [assignableCauseFound, setAssignableCauseFound] = useState(initialCauseFound ?? false)
  const [findings, setFindings] = useState(initialFindings ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({ assignableCauseFound, findings: findings.trim() || undefined })
    } catch (err) {
      setError(getErrorMessage(err, 'Could not record Phase 1 findings.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-display font-bold text-base text-foreground">Phase 1 — Lab Investigation</h3>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={assignableCauseFound} onChange={(e) => setAssignableCauseFound(e.target.checked)} />
          A documented assignable lab cause was found
        </label>
        <div>
          <label className={labelClass}>Findings</label>
          <textarea value={findings} onChange={(e) => setFindings(e.target.value)} rows={3} className={inputClass} />
        </div>
        {error && <p className="text-sm text-status-error">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function RetestModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (input: { authorized: boolean; rationale: string }) => Promise<void> }) {
  const [authorized, setAuthorized] = useState(true)
  const [rationale, setRationale] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = rationale.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({ authorized, rationale: rationale.trim() })
    } catch (err) {
      setError(getErrorMessage(err, 'Could not record this retest decision.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-display font-bold text-base text-foreground">Retest Decision</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm text-foreground hover:bg-muted cursor-pointer">
            <input type="radio" checked={authorized} onChange={() => setAuthorized(true)} />
            Authorize retest
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm text-foreground hover:bg-muted cursor-pointer">
            <input type="radio" checked={!authorized} onChange={() => setAuthorized(false)} />
            Decline retest
          </label>
        </div>
        <div>
          <label className={labelClass}>Rationale * (always required)</label>
          <textarea value={rationale} onChange={(e) => setRationale(e.target.value)} rows={3} className={inputClass} />
        </div>
        {error && <p className="text-sm text-status-error">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={!isValid || submitting} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function Phase2Modal({
  initialFindings,
  onClose,
  onSubmit,
}: {
  initialFindings: string | null
  onClose: () => void
  onSubmit: (input: { findings?: string; batchImpact?: string }) => Promise<void>
}) {
  const [findings, setFindings] = useState(initialFindings ?? '')
  const [batchImpact, setBatchImpact] = useState<string>('no_impact')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({ findings: findings.trim() || undefined, batchImpact })
    } catch (err) {
      setError(getErrorMessage(err, 'Could not record Phase 2 findings.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-display font-bold text-base text-foreground">Phase 2 — Manufacturing Investigation</h3>
        <div>
          <label className={labelClass}>Findings</label>
          <textarea value={findings} onChange={(e) => setFindings(e.target.value)} rows={3} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Batch Impact</label>
          <select value={batchImpact} onChange={(e) => setBatchImpact(e.target.value)} className={inputClass}>
            {OOS_BATCH_IMPACTS.map((b) => (
              <option key={b} value={b}>{OOS_BATCH_IMPACT_LABELS[b]}</option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-status-error">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function OpenCapaModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (input: { title: string; correctiveAction: string; preventiveAction?: string; rootCauseCategory?: string }) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [correctiveAction, setCorrectiveAction] = useState('')
  const [preventiveAction, setPreventiveAction] = useState('')
  const [rootCauseCategory, setRootCauseCategory] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = title.trim().length > 0 && correctiveAction.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        title: title.trim(),
        correctiveAction: correctiveAction.trim(),
        preventiveAction: preventiveAction.trim() || undefined,
        rootCauseCategory: rootCauseCategory.trim() || undefined,
      })
    } catch (err) {
      setError(getErrorMessage(err, 'Could not open this CAPA.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4 my-8">
        <h3 className="font-display font-bold text-base text-foreground">Open CAPA</h3>
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
        <div>
          <label className={labelClass}>Root-Cause Category</label>
          <input value={rootCauseCategory} onChange={(e) => setRootCauseCategory(e.target.value)} className={inputClass} />
        </div>
        {error && <p className="text-sm text-status-error">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={!isValid || submitting} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Open CAPA
          </button>
        </div>
      </div>
    </div>
  )
}
