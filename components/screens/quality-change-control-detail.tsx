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
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const STATUS_LABEL_KEYS: Record<string, MessageKey> = {
  proposed: 'qualityChangeControlDetail.statusProposed',
  impact_assessment: 'qualityChangeControlDetail.statusImpactAssessment',
  approved: 'qualityChangeControlDetail.statusApproved',
  implementing: 'qualityChangeControlDetail.statusImplementing',
  verifying: 'qualityChangeControlDetail.statusVerifying',
  closed: 'qualityChangeControlDetail.statusClosed',
}

const IMPACT_DIMENSION_KEYS: { key: keyof ChangeImpactAssessment; labelKey: MessageKey }[] = [
  { key: 'regulatoryImpact', labelKey: 'qualityChangeControlDetail.dimRegulatory' },
  { key: 'validationImpact', labelKey: 'qualityChangeControlDetail.dimValidation' },
  { key: 'productSafetyImpact', labelKey: 'qualityChangeControlDetail.dimProductSafety' },
  { key: 'stabilityImpact', labelKey: 'qualityChangeControlDetail.dimStability' },
  { key: 'otherSpecificationsImpact', labelKey: 'qualityChangeControlDetail.dimOtherSpecifications' },
]

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '—'
}

export function QualityChangeControlDetail({ changeControlId }: { changeControlId: string }) {
  const router = useRouter()
  const { t } = useTranslation()
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
      .catch((err) => setError(getErrorMessage(err, t('qualityChangeControlDetail.errorLoad'))))
      .finally(() => setLoading(false))
  }, [changeControlId, t])

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
          <p className="text-sm text-muted-foreground">{error ?? t('qualityChangeControlDetail.notFound')}</p>
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
      setNotice(t('qualityChangeControlDetail.approvalRecordedNotice'))
      refresh()
    } catch (err) {
      setError(getErrorMessage(err, t('qualityChangeControlDetail.errorRecordApproval')))
    } finally {
      setBusy(false)
    }
  }

  const handleOpenVariation = async () => {
    setBusy(true)
    setError(null)
    try {
      await openLinkedVariation(cc.id)
      setNotice(t('qualityChangeControlDetail.variationOpenedNotice'))
      refresh()
    } catch (err) {
      setError(getErrorMessage(err, t('qualityChangeControlDetail.errorOpenVariation')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <button onClick={() => router.push('/quality-change-controls')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t('qualityChangeControlDetail.backToChangeControl')}
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{cc.changeNumber}</p>
          <h1 className="text-2xl font-display font-bold text-foreground">{cc.title}</h1>
          <p className="mt-1 text-xs text-muted-foreground capitalize">{cc.changeType.replace(/_/g, ' ')} · {cc.scope}</p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">{STATUS_LABEL_KEYS[cc.status] ? t(STATUS_LABEL_KEYS[cc.status]) : cc.status}</span>
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      {cc.changeDescription && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t('qualityChangeControlDetail.changeDescription')}</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{cc.changeDescription}</p>
        </div>
      )}

      <WorkflowActionsPanel key={cc.status} workflowInstanceId={cc.workflowInstanceId} onTransitioned={refresh} />

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('qualityChangeControlDetail.impactAssessment')}</p>
          {canLog && (cc.status === 'proposed' || cc.status === 'impact_assessment') && (
            <button onClick={() => setShowImpactForm(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
              {cc.impactAssessment ? t('qualityChangeControlDetail.updateAssessment') : t('qualityChangeControlDetail.assessImpact')}
            </button>
          )}
        </div>
        {!cc.impactAssessment ? (
          <p className="text-xs text-muted-foreground">{t('qualityChangeControlDetail.notYetAssessed')}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {IMPACT_DIMENSION_KEYS.map(({ key, labelKey }) => {
              const dim = cc.impactAssessment![key]
              return (
                <div key={key} className="rounded-lg border border-border p-2.5">
                  <p className="text-xs font-medium text-foreground">{t(labelKey)}</p>
                  <p className={`text-xs ${dim.impacted ? 'text-status-warning' : 'text-muted-foreground'}`}>
                    {dim.impacted ? t('qualityChangeControlDetail.impacted') : t('qualityChangeControlDetail.notImpacted')}
                  </p>
                  {dim.note && <p className="mt-1 text-xs text-muted-foreground">{dim.note}</p>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('qualityChangeControlDetail.crossFunctionalApprovals')}</p>
        <p className="text-xs text-muted-foreground">{t('qualityChangeControlDetail.required', { roles: requiredRoles.join(', ') })}</p>
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
            {t('qualityChangeControlDetail.recordMyApproval')}
          </button>
        )}
        {canOpenVariation && !approvedRoles.has('REGULATORY_AFFAIRS_OFFICER') && requiredRoles.includes('REGULATORY_AFFAIRS_OFFICER') && (
          <button onClick={handleRecordApproval} disabled={busy} className="rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50 ml-2">
            {t('qualityChangeControlDetail.recordMyApprovalRegulatory')}
          </button>
        )}
      </div>

      {cc.impactAssessment?.regulatoryImpact.impacted && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('qualityChangeControlDetail.regulatoryFiling')}</p>
          {cc.linkedRegVariationId ? (
            <p className="text-sm text-status-success">{t('qualityChangeControlDetail.variationOpened')}</p>
          ) : (
            <>
              <div className="flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 p-2.5 text-xs leading-relaxed text-muted-foreground">
                <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-info" />
                <p>{t('qualityChangeControlDetail.regulatoryImpactNote')}</p>
              </div>
              {canOpenVariation && (
                <button onClick={handleOpenVariation} disabled={busy || !cc.affectedProductRegistrationId} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50">
                  {t('qualityChangeControlDetail.openLinkedVariation')}
                </button>
              )}
              {!cc.affectedProductRegistrationId && <p className="text-xs text-muted-foreground">{t('qualityChangeControlDetail.registrationRequiredFirst')}</p>}
            </>
          )}
        </div>
      )}

      {(cc.status === 'implementing' || cc.status === 'verifying' || cc.implementationRecord || cc.verificationResult) && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('qualityChangeControlDetail.implementationAndVerification')}</p>
            {canLog && (
              <button onClick={() => setShowImplementationForm(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                {t('qualityChangeControlDetail.update')}
              </button>
            )}
          </div>
          {cc.implementationRecord && <p className="text-sm text-foreground"><span className="text-muted-foreground">{t('qualityChangeControlDetail.implementationLabel')}</span> {cc.implementationRecord}</p>}
          {cc.verificationResult && <p className="text-sm text-foreground"><span className="text-muted-foreground">{t('qualityChangeControlDetail.verificationLabel')}</span> {cc.verificationResult}</p>}
          {!cc.verificationResult && <p className="text-xs text-status-warning">{t('qualityChangeControlDetail.verificationRequiredWarning')}</p>}
        </div>
      )}

      {cc.closedAt && <p className="text-xs text-muted-foreground">{t('qualityChangeControlDetail.closed', { date: formatDate(cc.closedAt) })}</p>}

      {showImpactForm && (
        <ImpactAssessmentModal
          initial={cc.impactAssessment}
          onClose={() => setShowImpactForm(false)}
          onSubmit={async (assessment) => {
            await assessChangeImpact(cc.id, assessment)
            setShowImpactForm(false)
            setNotice(t('qualityChangeControlDetail.impactAssessmentRecordedNotice'))
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
            setNotice(t('qualityChangeControlDetail.implementationRecordedNotice'))
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
  const { t } = useTranslation()
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
      setError(getErrorMessage(err, t('qualityChangeControlDetail.errorRecordAssessment')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 space-y-4 my-8">
        <h3 className="font-display font-bold text-base text-foreground">{t('qualityChangeControlDetail.impactAssessmentModalTitle')}</h3>
        {IMPACT_DIMENSION_KEYS.map(({ key, labelKey }) => (
          <div key={key} className="rounded-lg border border-border p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input type="checkbox" checked={assessment[key].impacted} onChange={(e) => setDim(key, { impacted: e.target.checked })} />
              {t(labelKey)}
            </label>
            {assessment[key].impacted && (
              <input
                value={assessment[key].note ?? ''}
                onChange={(e) => setDim(key, { note: e.target.value })}
                placeholder={t('qualityChangeControlDetail.notePlaceholder')}
                className={inputClass}
              />
            )}
          </div>
        ))}
        {error && <p className="text-sm text-status-error">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('common.cancel')}
          </button>
          <button onClick={handleSubmit} disabled={submitting} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('qualityChangeControlDetail.save')}
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
  const { t } = useTranslation()
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
      setError(getErrorMessage(err, t('qualityChangeControlDetail.errorSave')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-display font-bold text-base text-foreground">{t('qualityChangeControlDetail.implementationModalTitle')}</h3>
        <div>
          <label className={labelClass}>{t('qualityChangeControlDetail.implementationRecordField')}</label>
          <textarea value={implementationRecord} onChange={(e) => setImplementationRecord(e.target.value)} rows={3} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t('qualityChangeControlDetail.verificationResultField')}</label>
          <textarea value={verificationResult} onChange={(e) => setVerificationResult(e.target.value)} rows={3} className={inputClass} placeholder={t('qualityChangeControlDetail.verificationPlaceholder')} />
        </div>
        {error && <p className="text-sm text-status-error">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('common.cancel')}
          </button>
          <button onClick={handleSubmit} disabled={submitting} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('qualityChangeControlDetail.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
