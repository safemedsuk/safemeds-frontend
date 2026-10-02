'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Info, Loader2, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  ChangeControlDetail,
  ChangeImpactAssessment,
  assessChangeImpact,
  getChangeControl,
  openLinkedVariation,
  recordChangeApproval,
  recordChangeImplementation,
} from '@/lib/api/change-controls'
import { WorkflowActionsPanel } from '@/components/pv-cases/workflow-actions-panel'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const STATUS_LABELS: Record<string, string> = {
  proposed: 'Proposed',
  impact_assessment: 'Impact Assessment',
  approved: 'Approved',
  implementing: 'Implementing',
  verifying: 'Verifying',
  closed: 'Closed',
}

const IMPACT_DIMENSIONS: { key: keyof ChangeImpactAssessment; label: string }[] = [
  { key: 'regulatoryImpact', label: 'Regulatory Impact' },
  { key: 'validationImpact', label: 'Validation Status Impact' },
  { key: 'productSafetyImpact', label: 'Product Safety/Efficacy Impact' },
  { key: 'stabilityImpact', label: 'Stability Impact' },
  { key: 'otherSpecificationsImpact', label: 'Other Approved Specifications Impact' },
]

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '—'
}

export function QualityChangeControlDetail({ changeControlId }: { changeControlId: string }) {
  const router = useRouter()
  const { has } = usePermissions()
  const canLog = has('quality.log_deviation')
  const canApprove = has('quality.close_capa')
  const canOpenVariation = has('regulatory.manage_registrations')

  const [cc, setCc] = useState<ChangeControlDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showImpactForm, setShowImpactForm] = useState(false)
  const [showImplementationForm, setShowImplementationForm] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    getChangeControl(changeControlId)
      .then(setCc)
      .catch((err) => setError(getErrorMessage(err, 'Could not load this change control.')))
      .finally(() => setLoading(false))
  }, [changeControlId])

  useEffect(() => load(), [load])

  const refresh = () => load(true)

  if (loading) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!cc) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{error ?? 'Change control not found.'}</p>
        </div>
      </div>
    )
  }

  const requiredRoles = ['QUALITY_MANAGER', ...(cc.impactAssessment?.regulatoryImpact.impacted ? ['REGULATORY_AFFAIRS_OFFICER'] : [])]
  const approvedRoles = new Set(cc.crossFunctionalApprovals.map((a) => a.role))

  const handleRecordApproval = async () => {
    setBusy(true)
    setError(null)
    try {
      await recordChangeApproval(cc.id)
      setNotice('Approval recorded.')
      refresh()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not record your approval.'))
    } finally {
      setBusy(false)
    }
  }

  const handleOpenVariation = async () => {
    setBusy(true)
    setError(null)
    try {
      await openLinkedVariation(cc.id)
      setNotice('Linked regulatory variation opened.')
      refresh()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not open a linked variation.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <button onClick={() => router.push('/quality-change-controls')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Change Control
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{cc.changeNumber}</p>
          <h1 className="text-2xl font-display font-bold text-foreground">{cc.title}</h1>
          <p className="mt-1 text-xs text-muted-foreground capitalize">{cc.changeType.replace(/_/g, ' ')} · {cc.scope}</p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">{STATUS_LABELS[cc.status] ?? cc.status}</span>
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      {cc.changeDescription && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Change Description</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{cc.changeDescription}</p>
        </div>
      )}

      <WorkflowActionsPanel key={cc.status} workflowInstanceId={cc.workflowInstanceId} onTransitioned={refresh} />

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Impact Assessment</p>
          {canLog && (cc.status === 'proposed' || cc.status === 'impact_assessment') && (
            <button onClick={() => setShowImpactForm(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
              {cc.impactAssessment ? 'Update Assessment' : 'Assess Impact'}
            </button>
          )}
        </div>
        {!cc.impactAssessment ? (
          <p className="text-xs text-muted-foreground">Not yet assessed.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {IMPACT_DIMENSIONS.map(({ key, label }) => {
              const dim = cc.impactAssessment![key]
              return (
                <div key={key} className="rounded-lg border border-border p-2.5">
                  <p className="text-xs font-medium text-foreground">{label}</p>
                  <p className={`text-xs ${dim.impacted ? 'text-status-warning' : 'text-muted-foreground'}`}>
                    {dim.impacted ? 'Impacted' : 'Not impacted'}
                  </p>
                  {dim.note && <p className="mt-1 text-xs text-muted-foreground">{dim.note}</p>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cross-Functional Approvals</p>
        <p className="text-xs text-muted-foreground">Required: {requiredRoles.join(', ')}</p>
        <div className="flex flex-wrap gap-2">
          {requiredRoles.map((role) => (
            <span key={role} className={`rounded-full px-2.5 py-1 text-xs font-medium ${approvedRoles.has(role) ? 'bg-status-success/10 text-status-success' : 'bg-muted text-muted-foreground'}`}>
              {approvedRoles.has(role) ? <CheckCircle2 className="mr-1 inline h-3 w-3" /> : null}
              {role.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
        {canApprove && !approvedRoles.has('QUALITY_MANAGER') && (
          <button onClick={handleRecordApproval} disabled={busy} className="rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50">
            Record My Approval
          </button>
        )}
        {canOpenVariation && !approvedRoles.has('REGULATORY_AFFAIRS_OFFICER') && requiredRoles.includes('REGULATORY_AFFAIRS_OFFICER') && (
          <button onClick={handleRecordApproval} disabled={busy} className="rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50 ml-2">
            Record My Approval (Regulatory)
          </button>
        )}
      </div>

      {cc.impactAssessment?.regulatoryImpact.impacted && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Regulatory Filing</p>
          {cc.linkedRegVariationId ? (
            <p className="text-sm text-status-success">A linked regulatory variation has been opened.</p>
          ) : (
            <>
              <div className="flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 p-2.5 text-xs leading-relaxed text-muted-foreground">
                <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-info" />
                <p>This change was flagged as having a regulatory impact — open the linked RegCloud variation once the affected registration is known.</p>
              </div>
              {canOpenVariation && (
                <button onClick={handleOpenVariation} disabled={busy || !cc.affectedProductRegistrationId} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50">
                  Open Linked Variation
                </button>
              )}
              {!cc.affectedProductRegistrationId && <p className="text-xs text-muted-foreground">The affected product registration must be set first.</p>}
            </>
          )}
        </div>
      )}

      {(cc.status === 'implementing' || cc.status === 'verifying' || cc.implementationRecord || cc.verificationResult) && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Implementation &amp; Verification</p>
            {canLog && (
              <button onClick={() => setShowImplementationForm(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                Update
              </button>
            )}
          </div>
          {cc.implementationRecord && <p className="text-sm text-foreground"><span className="text-muted-foreground">Implementation:</span> {cc.implementationRecord}</p>}
          {cc.verificationResult && <p className="text-sm text-foreground"><span className="text-muted-foreground">Verification:</span> {cc.verificationResult}</p>}
          {!cc.verificationResult && <p className="text-xs text-status-warning">Verification (confirming no adverse effect) is required before this can close.</p>}
        </div>
      )}

      {cc.closedAt && <p className="text-xs text-muted-foreground">Closed {formatDate(cc.closedAt)}</p>}

      {showImpactForm && (
        <ImpactAssessmentModal
          initial={cc.impactAssessment}
          onClose={() => setShowImpactForm(false)}
          onSubmit={async (assessment) => {
            await assessChangeImpact(cc.id, assessment)
            setShowImpactForm(false)
            setNotice('Impact assessment recorded.')
            refresh()
          }}
        />
      )}

      {showImplementationForm && (
        <ImplementationModal
          initialImplementation={cc.implementationRecord}
          initialVerification={cc.verificationResult}
          onClose={() => setShowImplementationForm(false)}
          onSubmit={async (input) => {
            await recordChangeImplementation(cc.id, input)
            setShowImplementationForm(false)
            setNotice('Implementation/verification recorded.')
            refresh()
          }}
        />
      )}
    </div>
  )
}

function ImpactAssessmentModal({
  initial,
  onClose,
  onSubmit,
}: {
  initial: ChangeImpactAssessment | null
  onClose: () => void
  onSubmit: (assessment: ChangeImpactAssessment) => Promise<void>
}) {
  const defaultDim = { impacted: false, note: '' }
  const [assessment, setAssessment] = useState<ChangeImpactAssessment>(
    initial ?? {
      regulatoryImpact: { ...defaultDim },
      validationImpact: { ...defaultDim },
      productSafetyImpact: { ...defaultDim },
      stabilityImpact: { ...defaultDim },
      otherSpecificationsImpact: { ...defaultDim },
    },
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setDim = (key: keyof ChangeImpactAssessment, patch: Partial<{ impacted: boolean; note: string }>) => {
    setAssessment((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(assessment)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not record this assessment.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 space-y-4 my-8">
        <h3 className="font-display font-bold text-base text-foreground">Impact Assessment</h3>
        {IMPACT_DIMENSIONS.map(({ key, label }) => (
          <div key={key} className="rounded-lg border border-border p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input type="checkbox" checked={assessment[key].impacted} onChange={(e) => setDim(key, { impacted: e.target.checked })} />
              {label}
            </label>
            {assessment[key].impacted && (
              <input
                value={assessment[key].note ?? ''}
                onChange={(e) => setDim(key, { note: e.target.value })}
                placeholder="Note (optional)"
                className={inputClass}
              />
            )}
          </div>
        ))}
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

function ImplementationModal({
  initialImplementation,
  initialVerification,
  onClose,
  onSubmit,
}: {
  initialImplementation: string | null
  initialVerification: string | null
  onClose: () => void
  onSubmit: (input: { implementationRecord?: string; verificationResult?: string }) => Promise<void>
}) {
  const [implementationRecord, setImplementationRecord] = useState(initialImplementation ?? '')
  const [verificationResult, setVerificationResult] = useState(initialVerification ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        implementationRecord: implementationRecord.trim() || undefined,
        verificationResult: verificationResult.trim() || undefined,
      })
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-display font-bold text-base text-foreground">Implementation &amp; Verification</h3>
        <div>
          <label className={labelClass}>Implementation Record</label>
          <textarea value={implementationRecord} onChange={(e) => setImplementationRecord(e.target.value)} rows={3} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Verification Result</label>
          <textarea value={verificationResult} onChange={(e) => setVerificationResult(e.target.value)} rows={3} className={inputClass} placeholder="Confirms no adverse effect — required before Closed" />
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
