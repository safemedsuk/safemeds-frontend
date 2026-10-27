'use client'

import { OpenCapaModal } from '@/components/internal-audits/open-capa-modal'
import { RecordDocumentUpload } from '@/components/quality/record-document-upload'
import { CAPA_STATUS_LABELS, type Capa } from '@/lib/api/internal-audits'
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
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const SEVERITY_STYLES: Record<DeviationSeverity, string> = {
  critical: 'bg-status-error/10 text-status-error',
  major: 'bg-status-warning/10 text-status-warning',
  minor: 'bg-status-info/10 text-status-info',
}

const STATUS_LABEL_KEYS: Record<string, MessageKey> = {
  detected: 'qualityDeviationDetail.statusDetected',
  classifying: 'qualityDeviationDetail.statusClassifying',
  investigating: 'qualityDeviationDetail.statusInvestigating',
  capa_pending: 'qualityDeviationDetail.statusCapaPending',
  closed: 'qualityDeviationDetail.statusClosed',
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
type LinkedCapa = Capa & { owner?: { id: string; fullName: string } | null }

export function QualityDeviationDetail({ deviationId }: { deviationId: string }) {
  const router = useRouter()
  const { t } = useTranslation()
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
      .catch((err) => setError(getErrorMessage(err, t('qualityDeviationDetail.errorLoad'))))
      .finally(() => setLoading(false))
  }, [deviationId, t])

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
          <p className="text-sm text-muted-foreground">{error ?? t('qualityDeviationDetail.notFound')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <button onClick={() => router.push('/quality-deviations')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t('qualityDeviationDetail.backToDeviations')}
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{deviation.deviationNumber}</p>
          <h1 className="text-2xl font-display font-bold text-foreground">{deviation.title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {DEVIATION_SOURCE_TYPE_LABELS[deviation.sourceType as keyof typeof DEVIATION_SOURCE_TYPE_LABELS] ?? deviation.sourceType} · {t('qualityDeviationDetail.detected', { date: formatDateTime(deviation.detectedAt) })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {deviation.severity && (
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${SEVERITY_STYLES[deviation.severity]}`}>{deviation.severity}</span>
          )}
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">{STATUS_LABEL_KEYS[deviation.status] ? t(STATUS_LABEL_KEYS[deviation.status]) : deviation.status}</span>
        </div>
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      {deviation.description && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t('qualityDeviationDetail.description')}</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{deviation.description}</p>
        </div>
      )}

      {deviation.containmentActions && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t('qualityDeviationDetail.containmentActions')}</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{deviation.containmentActions}</p>
        </div>
      )}

      {deviation.investigationDueAt && (
        <div className="flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/5 p-3 text-xs leading-relaxed text-foreground">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-warning" />
          <p>{t('qualityDeviationDetail.investigationDueBy')} <strong>{formatDateTime(deviation.investigationDueAt)}</strong>.</p>
        </div>
      )}

      <WorkflowActionsPanel
        key={deviation.status}
        workflowInstanceId={deviation.workflowInstanceId}
        onTransitioned={refresh}
        customTriggers={{
          classifying: { label: t('qualityDeviationDetail.classifySeverity'), onClick: (tr) => setClassifying(tr) },
        }}
      />

      {canLog && (deviation.status === 'investigating' || deviation.investigation) && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('qualityDeviationDetail.investigationRecord')}</p>
            {deviation.status === 'investigating' && (
              <button onClick={() => setShowInvestigation(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                {deviation.investigation ? t('qualityDeviationDetail.updateInvestigation') : t('qualityDeviationDetail.recordInvestigation')}
              </button>
            )}
          </div>
          {deviation.investigation ? (
            <div className="grid gap-2 text-sm">
              <p><span className="text-muted-foreground">{t('qualityDeviationDetail.rootCauseMethod')}</span> {ROOT_CAUSE_METHOD_LABELS[deviation.investigation.rootCauseMethod as keyof typeof ROOT_CAUSE_METHOD_LABELS] ?? deviation.investigation.rootCauseMethod ?? '—'}</p>
              {deviation.investigation.findings && <p><span className="text-muted-foreground">{t('qualityDeviationDetail.findings')}</span> {deviation.investigation.findings}</p>}
              {deviation.investigation.evidenceReferences && <p><span className="text-muted-foreground">{t('qualityDeviationDetail.evidence')}</span> {deviation.investigation.evidenceReferences}</p>}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t('qualityDeviationDetail.noInvestigationYet')}</p>
          )}
          <div className="flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 p-2.5 text-xs leading-relaxed text-muted-foreground">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-info" />
            <p>{t('qualityDeviationDetail.fourEyesNote')}</p>
          </div>
        </div>
      )}

      {canManageCapa && deviation.status === 'capa_pending' && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('qualityDeviationDetail.capa')}</p>
          <p className="text-xs text-muted-foreground">{t('qualityDeviationDetail.capaRequiredNote')}</p>
          <button onClick={() => setShowOpenCapa(true)} className="rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce">
            {t('qualityDeviationDetail.openCapa')}
          </button>
        </div>
      )}

      {classifying && (
        <ClassifySeverityModal
          workflowInstanceId={deviation.workflowInstanceId!}
          onClose={() => setClassifying(null)}
          onClassified={() => {
            setClassifying(null)
            setNotice(t('qualityDeviationDetail.severityClassifiedNotice'))
            refresh()
          }}
        />
      )}

      {canLog && (deviation.status === 'investigating' || deviation.investigation) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <RecordDocumentUpload
            title={t('qualityDeviationDetail.investigationEvidenceTitle')}
            description={t('qualityDeviationDetail.investigationEvidenceDescription')}
            uploadPath={`/quality/deviations/${deviation.id}/investigation/evidence`}
            listRecordType="deviation_investigation_evidence"
            recordId={deviation.id}
            onUploaded={() => setNotice(t('qualityDeviationDetail.evidenceAttachedNotice'))}
            canUpload={canLog}
          />
          <RecordDocumentUpload
            title={t('qualityDeviationDetail.investigationReportTitle')}
            description={t('qualityDeviationDetail.investigationReportDescription')}
            uploadPath={`/quality/deviations/${deviation.id}/investigation/report`}
            listRecordType="deviation_investigation_report"
            recordId={deviation.id}
            onUploaded={() => setNotice(t('qualityDeviationDetail.reportAttachedNotice'))}
            canUpload={canLog}
          />
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('qualityDeviationDetail.linkedCapas')}</p>
        {deviation.capas.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('qualityDeviationDetail.noCapaLinkedYet')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">{t('qualityDeviationDetail.columnRootCause')}</th>
                  <th className="py-2 pr-3 font-medium">{t('qualityDeviationDetail.columnOwner')}</th>
                  <th className="py-2 pr-3 font-medium">{t('qualityDeviationDetail.columnCorrectiveDue')}</th>
                  <th className="py-2 pr-3 font-medium">{t('qualityDeviationDetail.columnStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {(deviation.capas as LinkedCapa[]).map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-3 text-foreground">{c.rootCause ?? c.title}</td>
                    <td className="py-2 pr-3 text-foreground">{c.owner?.fullName ?? t('qualityDeviationDetail.unassigned')}</td>
                    <td className="py-2 pr-3 text-foreground">{c.correctiveActionDueDate ?? c.dueDate ?? '—'}</td>
                    <td className="py-2 pr-3 text-foreground">{CAPA_STATUS_LABELS[c.status] ?? c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showInvestigation && (
        <RecordInvestigationModal
          deviationId={deviation.id}
          existing={deviation.investigation}
          onClose={() => setShowInvestigation(false)}
          onRecorded={() => {
            setShowInvestigation(false)
            setNotice(t('qualityDeviationDetail.investigationRecordedNotice'))
            refresh()
          }}
        />
      )}

      {showOpenCapa && (
        <OpenCapaModal
          contextNote={t('qualityDeviationDetail.capaContextNote')}
          submit={(input) => openCapaForDeviation(deviation.id, input).then(() => undefined)}
          onClose={() => setShowOpenCapa(false)}
          onOpened={() => {
            setShowOpenCapa(false)
            setNotice(t('qualityDeviationDetail.capaOpenedNotice'))
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
  const { t } = useTranslation()
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
      setError(getErrorMessage(err, t('qualityDeviationDetail.errorClassify')))
      setSubmitting(false)
    }
  }

  const severityLabel = (s: DeviationSeverity): string => {
    if (s === 'critical') return t('qualityDeviationDetail.critical')
    if (s === 'major') return t('qualityDeviationDetail.major')
    return t('qualityDeviationDetail.minor')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-display font-bold text-base text-foreground">{t('qualityDeviationDetail.classifySeverity')}</h3>
        <p className="text-xs text-muted-foreground">{t('qualityDeviationDetail.classifySubtitle')}</p>
        <div className="space-y-2">
          {(['critical', 'major', 'minor'] as DeviationSeverity[]).map((s) => (
            <label key={s} className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm text-foreground hover:bg-muted cursor-pointer">
              <input type="radio" name="severity" checked={severity === s} onChange={() => setSeverity(s)} />
              <span className="capitalize font-medium">{severityLabel(s)}</span>
            </label>
          ))}
        </div>
        {error && <p className="text-sm text-status-error">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('qualityDeviationDetail.classify')}
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
  const { t } = useTranslation()
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
      setError(getErrorMessage(err, t('qualityDeviationDetail.errorRecordInvestigation')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4 my-8">
        <h3 className="font-display font-bold text-base text-foreground">{t('qualityDeviationDetail.investigationRecord')}</h3>

        <div>
          <label className={labelClass}>{t('qualityDeviationDetail.rootCauseMethodField')}</label>
          <select value={rootCauseMethod} onChange={(e) => setRootCauseMethod(e.target.value)} className={inputClass}>
            <option value="">{t('qualityDeviationDetail.selectMethod')}</option>
            {ROOT_CAUSE_METHODS.map((m) => (
              <option key={m} value={m}>{ROOT_CAUSE_METHOD_LABELS[m]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>{t('qualityDeviationDetail.findingsField')}</label>
          <textarea value={findings} onChange={(e) => setFindings(e.target.value)} rows={4} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>{t('qualityDeviationDetail.evidenceReferences')}</label>
          <textarea value={evidenceReferences} onChange={(e) => setEvidenceReferences(e.target.value)} rows={2} className={inputClass} placeholder={t('qualityDeviationDetail.evidenceReferencesPlaceholder')} />
        </div>

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('qualityDeviationDetail.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
