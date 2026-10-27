'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Info, Loader2, ShieldAlert, Wrench, X } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { RecordDocumentUpload } from '@/components/quality/record-document-upload'
import { listRegulatoryApprovers, reassignRegulatoryApprover, type AssignableUser } from '@/lib/api/capa-allocation'
import {
  approveCapa,
  assignCapaAction,
  Capa,
  CAPA_STATUS_LABELS,
  closeCapa,
  CapaEffectivenessResult,
  CapaStatus,
  getCapa,
  implementCapa,
  listCapas,
  recordCapaEffectivenessCheck,
  regulatoryApproveCapa,
} from '@/lib/api/internal-audits'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const CAPA_STATUS_STYLES: Record<CapaStatus, string> = {
  open: 'bg-muted text-foreground',
  in_progress: 'bg-status-info/10 text-status-info',
  pending_effectiveness_check: 'bg-status-warning/10 text-status-warning',
  closed: 'bg-status-success/10 text-status-success',
}

function sourceLabelKey(capa: Capa): MessageKey {
  if (!capa.sourceRecordType) return 'qualityCapas.sourceStandalone'
  if (capa.sourceRecordType === 'audit_finding') return 'qualityCapas.sourceAuditFinding'
  if (capa.sourceRecordType === 'deviation') return 'qualityCapas.sourceDeviation'
  return 'qualityCapas.sourceStandalone'
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

/**
 * QualCloud (Phase 13) Stage 3 — the single, unified CAPA screen: every
 * CAPA regardless of source (an audit finding, a deviation, or a
 * standalone entry) in one list, filterable by source type and status —
 * `CapaService`'s own polymorphic `sourceRecordType`/`sourceRecordId`
 * generalization (Stage 0) made real here rather than three separate
 * per-module CAPA views.
 */
export function QualityCapasScreen() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canView = has('quality.view_all')
  const canManage = has('quality.manage_capa')
  const canClose = has('quality.close_capa')
  const canRegulatoryApprove = has('regulatory.manage_registrations')

  const [capas, setCapas] = useState<Capa[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [sourceFilter, setSourceFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [openCapaId, setOpenCapaId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listCapas(1, 100)
      .then((res) => setCapas(res.capas))
      .catch((err) => setError(getErrorMessage(err, t('qualityCapas.errorLoad'))))
      .finally(() => setLoading(false))
  }, [t])

  useEffect(load, [load])

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">{t('qualityCapas.title')}</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{t('qualityCapas.noPermission')}</p>
        </div>
      </div>
    )
  }

  const filtered = capas.filter(
    (c) => (!sourceFilter || (c.sourceRecordType ?? 'standalone') === sourceFilter) && (!statusFilter || c.status === statusFilter),
  )

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">{t('qualityCapas.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('qualityCapas.subtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className={`${inputClass} w-auto`}>
          <option value="">{t('qualityCapas.allSources')}</option>
          <option value="audit_finding">{t('qualityCapas.sourceAuditFinding')}</option>
          <option value="deviation">{t('qualityCapas.sourceDeviation')}</option>
          <option value="standalone">{t('qualityCapas.sourceStandalone')}</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputClass} w-auto`}>
          <option value="">{t('qualityCapas.allStatuses')}</option>
          {Object.entries(CAPA_STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Wrench className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{t('qualityCapas.noCapasMatch')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">{t('qualityCapas.columnRootCause')}</th>
                <th className="p-3">{t('qualityCapas.columnOwner')}</th>
                <th className="p-3">{t('qualityCapas.columnSource')}</th>
                <th className="p-3">{t('qualityCapas.columnCorrectiveDue')}</th>
                <th className="p-3">{t('qualityCapas.columnStatus')}</th>
                <th className="p-3">{t('qualityCapas.columnRecurring')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} onClick={() => setOpenCapaId(c.id)} className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50">
                  <td className="p-3 text-foreground font-medium">{c.rootCause ?? c.title}</td>
                  <td className="p-3 text-muted-foreground text-xs">{(c as Capa & { owner?: { fullName: string } | null }).owner?.fullName ?? t('qualityCapas.unassigned')}</td>
                  <td className="p-3 text-muted-foreground text-xs">{t(sourceLabelKey(c))}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(c.correctiveActionDueDate ?? c.dueDate)}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CAPA_STATUS_STYLES[c.status]}`}>{CAPA_STATUS_LABELS[c.status]}</span>
                  </td>
                  <td className="p-3">
                    {c.flaggedRecurring ? <span className="rounded-full bg-status-warning/10 px-2 py-0.5 text-xs font-medium text-status-warning">{t('qualityCapas.recurring')}</span> : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {openCapaId && (
        <CapaDetailModal
          capaId={openCapaId}
          canManage={canManage}
          canClose={canClose}
          canRegulatoryApprove={canRegulatoryApprove}
          onClose={() => setOpenCapaId(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}

function CapaDetailModal({
  capaId,
  canManage,
  canClose,
  canRegulatoryApprove,
  onClose,
  onChanged,
}: {
  capaId: string
  canManage: boolean
  canClose: boolean
  canRegulatoryApprove: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const { t } = useTranslation()
  const [capa, setCapa] = useState<Capa | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [busy, setBusy] = useState(false)
  const [showAssignAction, setShowAssignAction] = useState(false)
  const [showEffectivenessCheck, setShowEffectivenessCheck] = useState(false)
  const [requiresRegulatoryApproval, setRequiresRegulatoryApproval] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    getCapa(capaId)
      .then((c) => {
        setCapa(c)
        setRequiresRegulatoryApproval(c.requiresRegulatoryApproval)
      })
      .catch((err) => setError(getErrorMessage(err, t('qualityCapas.errorLoadCapa'))))
      .finally(() => setLoading(false))
  }, [capaId, t])

  useEffect(load, [load])

  const refresh = () => {
    load()
    onChanged()
  }

  const runAction = async (fn: () => Promise<Capa>, message: string) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      setNotice(message)
      refresh()
    } catch (err) {
      setError(getErrorMessage(err, t('qualityCapas.errorAction')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-6 space-y-5 my-8">
        {loading || !capa ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">{t(sourceLabelKey(capa))}</p>
                <h2 className="font-display font-bold text-lg text-foreground">{capa.rootCause ?? capa.title}</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${CAPA_STATUS_STYLES[capa.status]}`}>{CAPA_STATUS_LABELS[capa.status]}</span>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
            {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

            {capa.flaggedRecurring && (
              <div className="flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/5 p-3 text-xs leading-relaxed text-foreground">
                <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-warning" />
                <p>{capa.recurringFlagReason ?? t('qualityCapas.flaggedRecurringDefault')}</p>
              </div>
            )}

            <div className="grid gap-2 text-sm">
              {capa.correction && <p><span className="text-muted-foreground">{t('qualityCapas.labelCorrection')}</span> {capa.correction}</p>}
              <p><span className="text-muted-foreground">{t('qualityCapas.labelCorrectiveAction')}</span> {capa.correctiveAction}</p>
              {capa.preventiveAction && <p><span className="text-muted-foreground">{t('qualityCapas.labelPreventiveAction')}</span> {capa.preventiveAction}</p>}
              {capa.rootCauseCategory && <p><span className="text-muted-foreground">{t('qualityCapas.labelRootCauseCategory')}</span> {capa.rootCauseCategory}</p>}
              <p><span className="text-muted-foreground">{t('qualityCapas.labelOwner')}</span> {(capa as Capa & { owner?: { fullName: string } | null }).owner?.fullName ?? t('qualityCapas.unassigned')}</p>
              <p><span className="text-muted-foreground">{t('qualityCapas.labelCorrectiveDue')}</span> {formatDate(capa.correctiveActionDueDate ?? capa.dueDate)}</p>
              {capa.preventiveAction && <p><span className="text-muted-foreground">{t('qualityCapas.labelPreventiveDue')}</span> {formatDate(capa.preventiveActionDueDate)}</p>}
              {capa.approvedAt && <p><span className="text-muted-foreground">{t('qualityCapas.labelApproved')}</span> {formatDate(capa.approvedAt)}</p>}
              {capa.implementedAt && <p><span className="text-muted-foreground">{t('qualityCapas.labelImplemented')}</span> {formatDate(capa.implementedAt)}</p>}
              {capa.requiresRegulatoryApproval && (
                <p><span className="text-muted-foreground">{t('qualityCapas.labelRegulatoryApproval')}</span> {capa.regulatoryApprovedAt ? t('qualityCapas.approvedOn', { date: formatDate(capa.regulatoryApprovedAt) }) : t('qualityCapas.pending')}</p>
              )}
              {capa.effectivenessCheckResult && (
                <p><span className="text-muted-foreground">{t('qualityCapas.labelEffectivenessCheck')}</span> <span className="capitalize">{capa.effectivenessCheckResult === 'effective' ? t('qualityCapas.effective') : t('qualityCapas.notEffective')}</span></p>
              )}
              {capa.closedAt && <p><span className="text-muted-foreground">{t('qualityCapas.labelClosed')}</span> {formatDate(capa.closedAt)}</p>}
            </div>

            {canManage && (
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                {capa.status === 'open' && !capa.approvedAt && (
                  <button onClick={() => setShowAssignAction(true)} disabled={busy} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50">
                    {t('qualityCapas.refineAction')}
                  </button>
                )}
                {!capa.approvedAt && (
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input type="checkbox" checked={requiresRegulatoryApproval} onChange={(e) => setRequiresRegulatoryApproval(e.target.checked)} />
                      {t('qualityCapas.requiresRegulatoryApproval')}
                    </label>
                    <button
                      onClick={() => runAction(() => approveCapa(capa.id, requiresRegulatoryApproval), t('qualityCapas.approvedNotice'))}
                      disabled={busy}
                      className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
                    >
                      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      <Check className="h-3.5 w-3.5" /> {t('qualityCapas.approve')}
                    </button>
                  </div>
                )}
                {capa.approvedAt && !capa.implementedAt && (
                  <button
                    onClick={() => runAction(() => implementCapa(capa.id), t('qualityCapas.implementedNotice'))}
                    disabled={busy || (capa.requiresRegulatoryApproval && !capa.regulatoryApprovedAt)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    {t('qualityCapas.markImplemented')}
                  </button>
                )}
                {capa.implementedAt && capa.status !== 'closed' && !capa.effectivenessCheckResult && (
                  <button onClick={() => setShowEffectivenessCheck(true)} disabled={busy} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50">
                    {t('qualityCapas.recordEffectivenessCheck')}
                  </button>
                )}
              </div>
            )}

            {capa.requiresRegulatoryApproval && !capa.regulatoryApprovedAt && (canManage || canRegulatoryApprove) && (
              <RegulatoryApproverPanel
                capa={capa}
                disabled={busy}
                onReassigned={() => {
                  setNotice(t('qualityCapas.approverUpdatedNotice'))
                  refresh()
                }}
              />
            )}

            {capa.status !== 'closed' && canManage && (
              <RecordDocumentUpload
                title={t('qualityCapas.closingEvidenceTitle')}
                description={t('qualityCapas.closingEvidenceDescription')}
                uploadPath={`/capas/${capa.id}/evidence`}
                listRecordType="capa"
                recordId={capa.id}
                onUploaded={() => {
                  setNotice(t('qualityCapas.evidenceAttachedNotice'))
                  refresh()
                }}
                canUpload={canManage}
              />
            )}

            {canRegulatoryApprove && capa.requiresRegulatoryApproval && !capa.regulatoryApprovedAt && (
              <button
                onClick={() => runAction(() => regulatoryApproveCapa(capa.id), t('qualityCapas.regulatoryApprovalRecordedNotice'))}
                disabled={busy}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                {t('qualityCapas.recordRegulatoryApproval')}
              </button>
            )}

            {canClose && capa.effectivenessCheckResult && capa.status !== 'closed' && (
              <button
                onClick={() => runAction(() => closeCapa(capa.id), t('qualityCapas.closedNotice'))}
                disabled={busy}
                className="rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
              >
                {t('qualityCapas.closeCapa')}
              </button>
            )}
          </>
        )}
      </div>

      {showAssignAction && capa && (
        <AssignActionModal
          capa={capa}
          onClose={() => setShowAssignAction(false)}
          onAssigned={() => {
            setShowAssignAction(false)
            setNotice(t('qualityCapas.actionRefinedNotice'))
            refresh()
          }}
        />
      )}

      {showEffectivenessCheck && capa && (
        <EffectivenessCheckModal
          capaId={capa.id}
          onClose={() => setShowEffectivenessCheck(false)}
          onRecorded={() => {
            setShowEffectivenessCheck(false)
            setNotice(t('qualityCapas.effectivenessCheckRecordedNotice'))
            refresh()
          }}
        />
      )}
    </div>
  )
}

/** Pass A2 (item 3d) — the designated regulatory approver, and a reassignment control for the creator, current owner, or a manager. */
function RegulatoryApproverPanel({
  capa,
  disabled,
  onReassigned,
}: {
  capa: Capa
  disabled: boolean
  onReassigned: () => void
}) {
  const { t } = useTranslation()
  const [approvers, setApprovers] = useState<AssignableUser[]>([])
  const [selected, setSelected] = useState(capa.regulatoryApproverUserId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listRegulatoryApprovers().then(setApprovers).catch(() => setApprovers([]))
  }, [])

  const designated = approvers.find((u) => u.id === capa.regulatoryApproverUserId)

  const save = async () => {
    if (!selected || selected === capa.regulatoryApproverUserId) return
    setSaving(true)
    setError(null)
    try {
      await reassignRegulatoryApprover(capa.id, selected)
      onReassigned()
    } catch (err) {
      setError(getErrorMessage(err, t('qualityCapas.errorChangeApprover')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <p className="text-xs text-muted-foreground">
        {t('qualityCapas.regulatoryApprover')} <span className="text-foreground">{designated?.fullName ?? (capa.regulatoryApproverUserId ? t('qualityCapas.assigned') : t('qualityCapas.notAssigned'))}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="rounded-lg border border-input bg-background px-2 py-1 text-xs text-foreground">
          <option value="">{t('qualityCapas.chooseApprover')}</option>
          {approvers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </select>
        <button
          onClick={save}
          disabled={disabled || saving || !selected || selected === capa.regulatoryApproverUserId}
          className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          {capa.regulatoryApproverUserId ? t('qualityCapas.reassignApprover') : t('qualityCapas.assignApprover')}
        </button>
      </div>
      {approvers.length === 0 && (
        <p className="text-xs text-status-error">{t('qualityCapas.noApproverHolder')}</p>
      )}
      {error && <p className="text-xs text-status-error">{error}</p>}
    </div>
  )
}

function AssignActionModal({ capa, onClose, onAssigned }: { capa: Capa; onClose: () => void; onAssigned: () => void }) {
  const { t } = useTranslation()
  const [correction, setCorrection] = useState(capa.correction ?? '')
  const [correctiveAction, setCorrectiveAction] = useState(capa.correctiveAction)
  const [preventiveAction, setPreventiveAction] = useState(capa.preventiveAction ?? '')
  const [rootCauseCategory, setRootCauseCategory] = useState(capa.rootCauseCategory ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await assignCapaAction(capa.id, {
        correction: correction.trim() || undefined,
        correctiveAction: correctiveAction.trim() || undefined,
        preventiveAction: preventiveAction.trim() || undefined,
        rootCauseCategory: rootCauseCategory.trim() || undefined,
      })
      onAssigned()
    } catch (err) {
      setError(getErrorMessage(err, t('qualityCapas.errorRefine')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4 my-8">
        <h3 className="font-display font-bold text-base text-foreground">{t('qualityCapas.refineActionTitle')}</h3>
        <div>
          <label className={labelClass}>{t('qualityCapas.correctionLabel')}</label>
          <textarea value={correction} onChange={(e) => setCorrection(e.target.value)} rows={2} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t('qualityCapas.correctiveActionLabel')}</label>
          <textarea value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} rows={2} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t('qualityCapas.preventiveActionLabel')}</label>
          <textarea value={preventiveAction} onChange={(e) => setPreventiveAction(e.target.value)} rows={2} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t('qualityCapas.rootCauseCategoryLabel')}</label>
          <input value={rootCauseCategory} onChange={(e) => setRootCauseCategory(e.target.value)} className={inputClass} />
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
            {t('qualityCapas.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

function EffectivenessCheckModal({ capaId, onClose, onRecorded }: { capaId: string; onClose: () => void; onRecorded: () => void }) {
  const { t } = useTranslation()
  const [result, setResult] = useState<CapaEffectivenessResult>('effective')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await recordCapaEffectivenessCheck(capaId, result, note.trim() || undefined)
      onRecorded()
    } catch (err) {
      setError(getErrorMessage(err, t('qualityCapas.errorRecordEffectiveness')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-display font-bold text-base text-foreground">{t('qualityCapas.effectivenessCheckTitle')}</h3>
        <div className="space-y-2">
          {(['effective', 'not_effective'] as CapaEffectivenessResult[]).map((r) => (
            <label key={r} className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm text-foreground hover:bg-muted cursor-pointer">
              <input type="radio" name="effectiveness" checked={result === r} onChange={() => setResult(r)} />
              <span className="capitalize font-medium">{r === 'effective' ? t('qualityCapas.effective') : t('qualityCapas.notEffective')}</span>
            </label>
          ))}
        </div>
        <div>
          <label className={labelClass}>{t('qualityCapas.note')}</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputClass} />
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
            {t('qualityCapas.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
