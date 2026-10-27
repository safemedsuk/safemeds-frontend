'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import { ClipboardCheck, Loader2, Package, Plus, ShieldAlert, Wrench } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  approveSupplier,
  assessSupplier,
  createCoa,
  createEquipment,
  createSupplier,
  deactivateEquipment,
  deactivateSupplier,
  Equipment,
  EquipmentQualificationStatus,
  listEquipment,
  listSpecifications,
  listSuppliers,
  listMaintenanceRecords,
  listSupplierReviews,
  MaintenanceRecord,
  monitorSupplier,
  SupplierReview,
  uploadEquipmentValidationReport,
  uploadSupplierGmpCertificate,
  uploadSupplierReviewChecklist,
  recordEquipmentQualificationEvent,
  recordMaintenance,
  scheduleSupplierAudit,
  Specification,
  Supplier,
  SupplierApprovalStatus,
  SupplierCriticality,
  updateEquipment,
} from '@/lib/api/quality'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const SUPPLIER_STATUS_STYLES: Record<SupplierApprovalStatus, string> = {
  pending: 'bg-status-warning/10 text-status-warning',
  approved: 'bg-status-success/10 text-status-success',
  suspended: 'bg-status-warning/10 text-status-warning',
  disqualified: 'bg-status-error/10 text-status-error',
}

const QUALIFICATION_STATUS_LABEL_KEYS: Record<EquipmentQualificationStatus, MessageKey> = {
  not_qualified: 'qualityEntities.qualNotQualified',
  dq_complete: 'qualityEntities.qualDqComplete',
  iq_complete: 'qualityEntities.qualIqComplete',
  oq_complete: 'qualityEntities.qualOqComplete',
  pq_complete: 'qualityEntities.qualPqComplete',
  qualified: 'qualityEntities.qualQualified',
  requalification_due: 'qualityEntities.qualRequalificationDue',
  disqualified: 'qualityEntities.qualDisqualified',
}

/**
 * QualCloud (Phase 13) Stage 0.1 — the Quality Entity & Hierarchy Model's
 * own admin surface: the approved-supplier/vendor register and the
 * equipment/instrument register. A dedicated screen (not a Master Data
 * tab) — kept apart from `master-data.tsx` (already 2700+ lines) rather
 * than growing that file further; the real GMP qualification *workflow*
 * (protocols, execution, sign-off) is a later stage's own build, this
 * screen only lets status be set directly.
 */
export function QualityEntitiesScreen() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canViewAll = has('quality.view_all')
  const canManageSuppliers = has('quality.manage_suppliers')
  const canManageEquipment = has('quality.manage_equipment')

  const [tab, setTab] = useState<'suppliers' | 'equipment'>('suppliers')

  if (!canViewAll) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">{t('qualityEntities.title')}</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{t('qualityEntities.noPermission')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">{t('qualityEntities.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('qualityEntities.subtitle')}</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setTab('suppliers')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'suppliers' ? 'border-safemeds-teal text-safemeds-teal' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Package className="h-4 w-4" /> {t('qualityEntities.tabSuppliers')}
        </button>
        <button
          onClick={() => setTab('equipment')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'equipment' ? 'border-safemeds-teal text-safemeds-teal' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Wrench className="h-4 w-4" /> {t('qualityEntities.tabEquipment')}
        </button>
      </div>

      {tab === 'suppliers' ? <SuppliersTab canManage={canManageSuppliers} /> : <EquipmentTab canManage={canManageEquipment} />}
    </div>
  )
}

function SuppliersTab({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showCreate, setShowCreate] = useState(false)
  const [qualifying, setQualifying] = useState<Supplier | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listSuppliers({ page: 1, limit: 50 })
      .then((res) => setSuppliers(res.rows))
      .catch((err) => setError(getErrorMessage(err, t('qualityEntities.errorLoadSuppliers'))))
      .finally(() => setLoading(false))
  }, [t])

  useEffect(load, [load])

  // The sign-off decision (`approved | suspended | disqualified`) is a
  // real lifecycle action as of Stage 11 — `SupplierQualificationService
  // .approve()`, which also computes a live re-qualification due date —
  // never a plain field PATCH anymore (see `UpdateSupplierDto`'s own
  // doc comment on the backend).
  const handleStatusChange = (supplier: Supplier, approvalStatus: SupplierApprovalStatus) => {
    if (approvalStatus === 'pending') return
    approveSupplier(supplier.id, { approvalStatus: approvalStatus as 'approved' | 'suspended' | 'disqualified' })
      .then(() => {
        setNotice(t('qualityEntities.markedStatusNotice', { name: supplier.name, status: approvalStatus }))
        load()
      })
      .catch((err) => setError(getErrorMessage(err, t('qualityEntities.errorUpdateSupplierStatus'))))
  }

  const handleDeactivate = (supplier: Supplier) => {
    deactivateSupplier(supplier.id)
      .then(() => {
        setNotice(t('qualityEntities.deactivatedNotice', { name: supplier.name }))
        load()
      })
      .catch((err) => setError(getErrorMessage(err, t('qualityEntities.errorDeactivateSupplier'))))
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors"
          >
            <Plus className="h-4 w-4" /> {t('qualityEntities.addSupplier')}
          </button>
        )}
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : suppliers.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{t('qualityEntities.noSuppliersYet')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">{t('qualityEntities.columnName')}</th>
                <th className="p-3">{t('qualityEntities.columnType')}</th>
                <th className="p-3">{t('qualityEntities.columnCriticality')}</th>
                <th className="p-3">{t('qualityEntities.columnStatus')}</th>
                <th className="p-3">{t('qualityEntities.columnActive')}</th>
                {canManage && <th className="p-3">{t('qualityEntities.columnActions')}</th>}
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="p-3 text-foreground font-medium">{s.name}</td>
                  <td className="p-3 text-muted-foreground">{s.supplierType.replace(/_/g, ' ')}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.criticality === 'critical' ? 'bg-status-error/10 text-status-error' : 'bg-muted text-muted-foreground'}`}>
                      {s.criticality === 'critical' ? t('qualityEntities.critical') : t('qualityEntities.nonCritical')}
                    </span>
                  </td>
                  <td className="p-3">
                    {canManage ? (
                      <select
                        value={s.approvalStatus}
                        onChange={(e) => handleStatusChange(s, e.target.value as SupplierApprovalStatus)}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium border-0 ${SUPPLIER_STATUS_STYLES[s.approvalStatus]}`}
                      >
                        <option value="pending">{t('qualityEntities.statusPending')}</option>
                        <option value="approved">{t('qualityEntities.statusApproved')}</option>
                        <option value="suspended">{t('qualityEntities.statusSuspended')}</option>
                        <option value="disqualified">{t('qualityEntities.statusDisqualified')}</option>
                      </select>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SUPPLIER_STATUS_STYLES[s.approvalStatus]}`}>{s.approvalStatus}</span>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">{s.isActive ? t('qualityEntities.yes') : t('qualityEntities.no')}</td>
                  {canManage && (
                    <td className="p-3 space-x-3">
                      <button onClick={() => setQualifying(s)} className="text-xs text-safemeds-teal hover:underline">
                        {t('qualityEntities.qualify')}
                      </button>
                      {s.isActive && (
                        <button onClick={() => handleDeactivate(s)} className="text-xs text-status-error hover:underline">
                          {t('qualityEntities.deactivate')}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateSupplierModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            setNotice(t('qualityEntities.supplierAddedNotice'))
            load()
          }}
        />
      )}

      {qualifying && (
        <SupplierQualifyModal
          supplier={qualifying}
          onClose={() => setQualifying(null)}
          onChanged={(message) => {
            setQualifying(null)
            setNotice(message)
            load()
          }}
        />
      )}
    </div>
  )
}

/**
 * QualCloud (Phase 13) Stage 11 — the real qualification lifecycle:
 * a quick weighted assessment, scheduling a supplier-scope audit (reuses
 * the existing Internal Audits mechanism), the approve/suspend/
 * disqualify sign-off (computing a live re-qualification due date), and
 * logging an ongoing performance flag. Kept as one compact modal rather
 * than four separate screens — a bounded scope decision matching this
 * project's own established "a progress indicator, not a full rebuild"
 * precedent when a feature's full depth isn't the point of this pass.
 */
function SupplierQualifyModal({
  supplier,
  onClose,
  onChanged,
}: {
  supplier: Supplier
  onClose: () => void
  onChanged: (message: string) => void
}) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'assess' | 'approve' | 'audit' | 'monitor' | 'coa'>('assess')
  const [criteria, setCriteria] = useState('Quality system maturity')
  const [score, setScore] = useState(8)
  const [note, setNote] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [flag, setFlag] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Pass B (D1) GMP certificate: approval is refused until one is on file.
  const [gmpAttached, setGmpAttached] = useState(Boolean(supplier.gmpCertificateDocumentId))
  // ── Pass B (D2/D3) biennial review: checklist, notes and history.
  const [checklistDocumentId, setChecklistDocumentId] = useState<string | null>(null)
  const [checklistName, setChecklistName] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [reviews, setReviews] = useState<SupplierReview[]>([])

  useEffect(() => {
    if (tab !== 'monitor') return
    listSupplierReviews(supplier.id).then(setReviews).catch(() => setReviews([]))
  }, [tab, supplier.id])

  // ── Incoming-goods CoA intake ──────────────────────────────────────
  const [materialSpecs, setMaterialSpecs] = useState<Specification[]>([])
  const [materialSpecId, setMaterialSpecId] = useState('')
  const [batchOrLotNumber, setBatchOrLotNumber] = useState('')
  const [resultValues, setResultValues] = useState<Record<string, string>>({})

  useEffect(() => {
    if (tab !== 'coa') return
    listSpecifications({ supplierId: supplier.id, page: 1, limit: 50 })
      .then((res) => {
        const materialOnly = res.rows.filter((s) => s.specificationType === 'raw_material' || s.specificationType === 'api')
        setMaterialSpecs(materialOnly)
        if (materialOnly.length > 0) setMaterialSpecId(materialOnly[0].id)
      })
      .catch(() => setMaterialSpecs([]))
  }, [tab, supplier.id])

  const selectedSpec = materialSpecs.find((s) => s.id === materialSpecId) ?? null

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setSubmitting(true)
    setError(null)
    try {
      await fn()
      onChanged(message)
    } catch (err) {
      setError(getErrorMessage(err, t('qualityEntities.errorAction')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 space-y-4">
        <div>
          <h2 className="font-display font-bold text-lg text-foreground">{t('qualityEntities.qualifyTitle', { name: supplier.name })}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {t('qualityEntities.currentlyStatus', { criticality: supplier.criticality === 'critical' ? t('qualityEntities.critical') : t('qualityEntities.nonCritical'), status: supplier.approvalStatus })}
          </p>
        </div>

        <div className="flex gap-1 border-b border-border text-sm flex-wrap">
          {(['assess', 'audit', 'approve', 'monitor', 'coa'] as const).map((tb) => (
            <button
              key={tb}
              onClick={() => setTab(tb)}
              className={`px-3 py-1.5 border-b-2 -mb-px capitalize ${tab === tb ? 'border-safemeds-teal text-safemeds-teal font-medium' : 'border-transparent text-muted-foreground'}`}
            >
              {tb === 'audit' ? t('qualityEntities.tabScheduleAudit') : tb === 'coa' ? t('qualityEntities.tabIncomingCoa') : t(`qualityEntities.tab${tb.charAt(0).toUpperCase()}${tb.slice(1)}` as MessageKey)}
            </button>
          ))}
        </div>

        {tab === 'assess' && (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>{t('qualityEntities.criterion')}</label>
              <input value={criteria} onChange={(e) => setCriteria(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('qualityEntities.scoreField')}</label>
              <input type="number" min={0} max={10} value={score} onChange={(e) => setScore(Number(e.target.value))} className={inputClass} />
            </div>
            <button
              disabled={submitting}
              onClick={() =>
                run(
                  () =>
                    assessSupplier(supplier.id, {
                      title: 'Supplier Qualification Assessment',
                      criteria: [{ question: criteria, weight: 1, score }],
                    }),
                  t('qualityEntities.assessmentRecordedNotice'),
                )
              }
              className="w-full rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
            >
              {t('qualityEntities.recordAssessment')}
            </button>
          </div>
        )}

        {tab === 'audit' && (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>{t('qualityEntities.scheduledDate')}</label>
              <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className={inputClass} />
            </div>
            <button
              disabled={submitting || !scheduledDate}
              onClick={() => run(() => scheduleSupplierAudit(supplier.id, { scheduledDate }), t('qualityEntities.auditScheduledNotice'))}
              className="w-full rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
            >
              {t('qualityEntities.scheduleAudit')}
            </button>
          </div>
        )}

        {tab === 'approve' && (
          <div className="space-y-3">
            <div className="rounded-lg border border-[var(--border)] p-3">
              <p className="text-xs font-medium text-[var(--text)]">{t('qualityEntities.gmpCertificate')}</p>
              <p className="mb-2 text-[11px] text-[var(--text-muted)]">
                {t('qualityEntities.gmpCertificateNote')}
              </p>
              {gmpAttached ? (
                <p className="text-xs text-emerald-700">{t('qualityEntities.certificateOnFile')}</p>
              ) : (
                <p className="text-xs text-amber-700">{t('qualityEntities.noCertificateOnFile')}</p>
              )}
              <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs">
                {t('qualityEntities.uploadGmpCertificate')}
                <input
                  type="file"
                  className="hidden"
                  disabled={submitting}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) run(async () => { await uploadSupplierGmpCertificate(supplier.id, file); setGmpAttached(true) }, t('qualityEntities.gmpCertificateUploadedNotice'))
                  }}
                />
              </label>
            </div>
            <div>
              <label className={labelClass}>{t('qualityEntities.noteOptional')}</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
            </div>
            <div className="flex gap-2">
              <button
                disabled={submitting || !gmpAttached}
                onClick={() => run(() => approveSupplier(supplier.id, { approvalStatus: 'approved', note }), t('qualityEntities.supplierApprovedNotice'))}
                className="flex-1 rounded-lg bg-status-success px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {t('qualityEntities.approve')}
              </button>
              <button
                disabled={submitting}
                onClick={() => run(() => approveSupplier(supplier.id, { approvalStatus: 'suspended', note }), t('qualityEntities.supplierSuspendedNotice'))}
                className="flex-1 rounded-lg bg-status-warning px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {t('qualityEntities.suspend')}
              </button>
              <button
                disabled={submitting}
                onClick={() => run(() => approveSupplier(supplier.id, { approvalStatus: 'disqualified', note }), t('qualityEntities.supplierDisqualifiedNotice'))}
                className="flex-1 rounded-lg bg-status-error px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {t('qualityEntities.disqualify')}
              </button>
            </div>
          </div>
        )}

        {tab === 'monitor' && (
          <div className="space-y-3">
            <p className="text-xs text-[var(--text-muted)]">
              {t('qualityEntities.monitorIntro')}
            </p>
            <div className="rounded-lg border border-[var(--border)] p-3">
              <p className="text-xs font-medium text-[var(--text)]">{t('qualityEntities.reviewChecklist')}</p>
              <p className="mb-2 text-[11px] text-[var(--text-muted)]">
                {checklistName ? t('qualityEntities.attachedFile', { name: checklistName }) : t('qualityEntities.noChecklistAttached')}
              </p>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs">
                {checklistName ? t('qualityEntities.replaceChecklist') : t('qualityEntities.uploadChecklist')}
                <input
                  type="file"
                  className="hidden"
                  disabled={submitting}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    run(async () => {
                      const uploaded = await uploadSupplierReviewChecklist(supplier.id, file)
                      setChecklistDocumentId(uploaded.documentId)
                      setChecklistName(file.name)
                    }, t('qualityEntities.checklistUploadedNotice'))
                  }}
                />
              </label>
            </div>
            <div>
              <label className={labelClass}>{t('qualityEntities.performanceFlag')}</label>
              <input value={flag} onChange={(e) => setFlag(e.target.value)} placeholder={t('qualityEntities.performanceFlagPlaceholder')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('qualityEntities.reviewNotesOptional')}</label>
              <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={2} className={inputClass} />
            </div>
            <button
              disabled={submitting || !flag.trim() || !checklistDocumentId}
              onClick={() =>
                run(async () => {
                  await monitorSupplier(supplier.id, {
                    flag: flag.trim(),
                    checklistDocumentId: checklistDocumentId!,
                    notes: reviewNotes.trim() || undefined,
                  })
                  setFlag('')
                  setReviewNotes('')
                  setChecklistDocumentId(null)
                  setChecklistName(null)
                  setReviews(await listSupplierReviews(supplier.id))
                }, t('qualityEntities.reviewRecordedNotice'))
              }
              className="w-full rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
            >
              {t('qualityEntities.recordReview')}
            </button>
            {reviews.length > 0 && (
              <div className="rounded-lg border border-[var(--border)] p-3">
                <p className="mb-2 text-xs font-medium text-[var(--text)]">{t('qualityEntities.reviewHistory')}</p>
                <ul className="space-y-2 text-xs">
                  {reviews.map((r) => (
                    <li key={r.id}>
                      <span className="font-medium">{new Date(r.reviewedAt).toLocaleDateString()}</span> ·{' '}
                      {r.performanceFlags.join('; ') || t('qualityEntities.noFlags')} · {t('qualityEntities.nextReview', { date: new Date(r.nextReviewDueAt).toLocaleDateString() })}
                      {r.checklistDocument && <span className="text-[var(--text-muted)]"> · {t('qualityEntities.checklistColon', { title: r.checklistDocument.title })}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {tab === 'coa' && (
          <div className="space-y-3">
            {materialSpecs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('qualityEntities.noMaterialSpecsNote')}
              </p>
            ) : (
              <>
                <div>
                  <label className={labelClass}>{t('qualityEntities.materialSpecification')}</label>
                  <select
                    value={materialSpecId}
                    onChange={(e) => {
                      setMaterialSpecId(e.target.value)
                      setResultValues({})
                    }}
                    className={inputClass}
                  >
                    {materialSpecs.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({s.specificationNumber})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>{t('qualityEntities.batchOrLotNumber')}</label>
                  <input value={batchOrLotNumber} onChange={(e) => setBatchOrLotNumber(e.target.value)} className={inputClass} />
                </div>
                {selectedSpec?.parameters.map((p) => (
                  <div key={p.id}>
                    <label className={labelClass}>
                      {p.parameterName}
                      {p.lowerLimit || p.upperLimit ? ` (${p.lowerLimit ?? '—'} – ${p.upperLimit ?? '—'})` : ''}
                    </label>
                    <input
                      value={resultValues[p.id] ?? ''}
                      onChange={(e) => setResultValues((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                ))}
                <button
                  disabled={
                    submitting ||
                    !batchOrLotNumber.trim() ||
                    !selectedSpec ||
                    selectedSpec.parameters.some((p) => !resultValues[p.id]?.trim())
                  }
                  onClick={() =>
                    run(
                      () =>
                        createCoa({
                          supplierId: supplier.id,
                          materialSpecificationId: materialSpecId,
                          batchOrLotNumber: batchOrLotNumber.trim(),
                          results: (selectedSpec?.parameters ?? []).map((p) => ({
                            parameterId: p.id,
                            parameterName: p.parameterName,
                            resultValue: resultValues[p.id],
                          })),
                        }),
                      t('qualityEntities.coaRecordedNotice'),
                    )
                  }
                  className="w-full rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
                >
                  {t('qualityEntities.recordCoa')}
                </button>
              </>
            )}
          </div>
        )}

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('qualityEntities.close')}
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateSupplierModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [supplierType, setSupplierType] = useState('api_supplier')
  const [criticality, setCriticality] = useState<SupplierCriticality>('non_critical')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = name.trim().length > 0 && supplierType.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await createSupplier({ name: name.trim(), supplierType, criticality })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, t('qualityEntities.errorAddSupplier')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">{t('qualityEntities.addSupplierModalTitle')}</h2>

        <div>
          <label className={labelClass}>{t('qualityEntities.nameField')}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('qualityEntities.supplierNamePlaceholder')} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>{t('qualityEntities.supplierTypeField')}</label>
          <select value={supplierType} onChange={(e) => setSupplierType(e.target.value)} className={inputClass}>
            <option value="api_supplier">{t('qualityEntities.typeApiSupplier')}</option>
            <option value="excipient_supplier">{t('qualityEntities.typeExcipientSupplier')}</option>
            <option value="packaging_supplier">{t('qualityEntities.typePackagingSupplier')}</option>
            <option value="contract_manufacturer">{t('qualityEntities.typeContractManufacturer')}</option>
            <option value="contract_lab">{t('qualityEntities.typeContractLab')}</option>
            <option value="contract_service">{t('qualityEntities.typeContractService')}</option>
            <option value="other">{t('qualityEntities.typeOther')}</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>{t('qualityEntities.criticalityField')}</label>
          <select value={criticality} onChange={(e) => setCriticality(e.target.value as SupplierCriticality)} className={inputClass}>
            <option value="non_critical">{t('qualityEntities.criticalityNonCritical')}</option>
            <option value="critical">{t('qualityEntities.criticalityCritical')}</option>
          </select>
        </div>

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('qualityEntities.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('qualityEntities.addSupplier')}
          </button>
        </div>
      </div>
    </div>
  )
}

const DUE_BADGE_KEYS: Record<string, { labelKey: MessageKey; className: string }> = {
  overdue: { labelKey: 'qualityEntities.dueOverdue', className: 'bg-status-error/15 text-status-error' },
  due_soon: { labelKey: 'qualityEntities.dueDueSoon', className: 'bg-status-warning/15 text-status-warning' },
  current: { labelKey: 'qualityEntities.dueCurrent', className: 'bg-status-success/15 text-status-success' },
  not_scheduled: { labelKey: 'qualityEntities.dueNotScheduled', className: 'bg-muted text-muted-foreground' },
}

function DueBadge({ status }: { status?: string }) {
  const { t } = useTranslation()
  const meta = DUE_BADGE_KEYS[status ?? 'not_scheduled'] ?? DUE_BADGE_KEYS.not_scheduled
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>{t(meta.labelKey)}</span>
}

function fmtDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

function MaintenanceLog({ logs }: { logs: MaintenanceRecord[] | undefined }) {
  const { t } = useTranslation()
  if (!logs) return <p className="text-xs text-muted-foreground">{t('qualityEntities.loading')}</p>
  if (logs.length === 0) return <p className="text-xs text-muted-foreground">{t('qualityEntities.noMaintenanceYet')}</p>
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-muted-foreground">
          <th className="pb-2 font-medium">{t('qualityEntities.columnDate')}</th>
          <th className="pb-2 font-medium">{t('qualityEntities.columnDescription')}</th>
          <th className="pb-2 font-medium">{t('qualityEntities.columnNextDue')}</th>
        </tr>
      </thead>
      <tbody>
        {logs.map((entry) => (
          <tr key={entry.id} className="border-t border-border">
            <td className="py-1.5">{fmtDate(entry.maintenanceDate)}</td>
            <td className="py-1.5">{entry.description}</td>
            <td className="py-1.5">{fmtDate(entry.nextDueAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function EquipmentTab({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation()
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showCreate, setShowCreate] = useState(false)
  const [qualifying, setQualifying] = useState<Equipment | null>(null)
  const [maintenanceFor, setMaintenanceFor] = useState<Equipment | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [logs, setLogs] = useState<Record<string, MaintenanceRecord[]>>({})

  /** Pass B (C2): the full maintenance log is fetched on expand, never stored on the row. */
  const toggleLog = (equipmentId: string) => {
    if (expandedId === equipmentId) return setExpandedId(null)
    setExpandedId(equipmentId)
    listMaintenanceRecords(equipmentId)
      .then((rows) => setLogs((prev) => ({ ...prev, [equipmentId]: rows })))
      .catch((err) => setError(getErrorMessage(err, t('qualityEntities.errorLoadMaintenanceLog'))))
  }

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listEquipment({ page: 1, limit: 50 })
      .then((res) => setEquipment(res.rows))
      .catch((err) => setError(getErrorMessage(err, t('qualityEntities.errorLoadEquipment'))))
      .finally(() => setLoading(false))
  }, [t])

  useEffect(load, [load])

  const handleStatusChange = (item: Equipment, qualificationStatus: EquipmentQualificationStatus) => {
    updateEquipment(item.id, { qualificationStatus })
      .then(() => {
        setNotice(t('qualityEntities.equipmentMarkedNotice', { name: item.name, status: t(QUALIFICATION_STATUS_LABEL_KEYS[qualificationStatus]) }))
        load()
      })
      .catch((err) => setError(getErrorMessage(err, t('qualityEntities.errorUpdateEquipmentStatus'))))
  }

  const handleDeactivate = (item: Equipment) => {
    deactivateEquipment(item.id)
      .then(() => {
        setNotice(t('qualityEntities.equipmentDeactivatedNotice', { name: item.name }))
        load()
      })
      .catch((err) => setError(getErrorMessage(err, t('qualityEntities.errorDeactivateEquipment'))))
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors"
          >
            <Plus className="h-4 w-4" /> {t('qualityEntities.addEquipment')}
          </button>
        )}
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : equipment.length === 0 ? (
          <div className="p-12 text-center">
            <Wrench className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{t('qualityEntities.noEquipmentYet')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">{t('qualityEntities.columnName')}</th>
                <th className="p-3">{t('qualityEntities.columnType')}</th>
                <th className="p-3">{t('qualityEntities.columnAssetTag')}</th>
                <th className="p-3">{t('qualityEntities.columnQualificationStatus')}</th>
                <th className="p-3">{t('qualityEntities.columnCalibration')}</th>
                <th className="p-3">{t('qualityEntities.columnMaintenance')}</th>
                <th className="p-3">{t('qualityEntities.columnActive')}</th>
                {canManage && <th className="p-3">{t('qualityEntities.columnActions')}</th>}
              </tr>
            </thead>
            <tbody>
              {equipment.map((e) => (
                <Fragment key={e.id}>
                <tr className="border-b border-border last:border-0">
                  <td className="p-3 text-foreground font-medium">{e.name}</td>
                  <td className="p-3 text-muted-foreground">{e.equipmentType.replace(/_/g, ' ')}</td>
                  <td className="p-3 text-muted-foreground">{e.assetTag ?? '—'}</td>
                  <td className="p-3">
                    {canManage ? (
                      <select
                        value={e.qualificationStatus}
                        onChange={(ev) => handleStatusChange(e, ev.target.value as EquipmentQualificationStatus)}
                        className="rounded-full px-2 py-0.5 text-xs font-medium border-0 bg-muted text-foreground"
                      >
                        {(Object.keys(QUALIFICATION_STATUS_LABEL_KEYS) as EquipmentQualificationStatus[]).map((value) => (
                          <option key={value} value={value}>
                            {t(QUALIFICATION_STATUS_LABEL_KEYS[value])}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-foreground">{t(QUALIFICATION_STATUS_LABEL_KEYS[e.qualificationStatus])}</span>
                    )}
                  </td>
                  <td className="p-3">
                    <DueBadge status={e.calibrationStatus} />
                    <div className="mt-1 text-xs text-muted-foreground">
                      {t('qualityEntities.lastNextCalibration', { last: fmtDate(e.lastCalibratedAt), next: fmtDate(e.calibrationDueAt) })}
                    </div>
                  </td>
                  <td className="p-3">
                    <DueBadge status={e.maintenanceStatus} />
                    <div className="mt-1 text-xs text-muted-foreground">
                      {e.latestMaintenance
                        ? t('qualityEntities.maintenanceLine', { date: fmtDate(e.latestMaintenance.maintenanceDate), description: e.latestMaintenance.description })
                        : t('qualityEntities.noMaintenanceLogged')}
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">{e.isActive ? t('qualityEntities.yes') : t('qualityEntities.no')}</td>
                  {canManage && (
                    <td className="p-3 space-x-3">
                      <button onClick={() => setQualifying(e)} className="text-xs text-safemeds-teal hover:underline inline-flex items-center gap-1">
                        <ClipboardCheck className="h-3.5 w-3.5" /> {t('qualityEntities.qualify')}
                      </button>
                      <button
                        onClick={() => setMaintenanceFor(e)}
                        className="text-xs text-safemeds-teal hover:underline"
                      >
                        {t('qualityEntities.logMaintenance')}
                      </button>
                      <button onClick={() => toggleLog(e.id)} className="text-xs text-muted-foreground hover:underline">
                        {expandedId === e.id ? t('qualityEntities.hideLog') : t('qualityEntities.maintenanceLog')}
                      </button>
                      {e.isActive && (
                        <button onClick={() => handleDeactivate(e)} className="text-xs text-status-error hover:underline">
                          {t('qualityEntities.deactivate')}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
                {expandedId === e.id && (
                  <tr className="border-b border-border bg-muted/40">
                    <td colSpan={canManage ? 8 : 7} className="p-3">
                      <MaintenanceLog logs={logs[e.id]} />
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateEquipmentModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            setNotice(t('qualityEntities.equipmentAddedNotice'))
            load()
          }}
        />
      )}

      {qualifying && (
        <EquipmentQualifyModal
          equipment={qualifying}
          onClose={() => setQualifying(null)}
          onChanged={(message) => {
            const id = qualifying.id
            setQualifying(null)
            setNotice(message)
            load()
            listMaintenanceRecords(id).then((rows) => setLogs((prev) => ({ ...prev, [id]: rows }))).catch(() => undefined)
          }}
        />
      )}

      {maintenanceFor && (
        <EquipmentQualifyModal
          equipment={maintenanceFor}
          initialTab="maintenance"
          onClose={() => setMaintenanceFor(null)}
          onChanged={(message) => {
            const id = maintenanceFor.id
            setMaintenanceFor(null)
            setNotice(message)
            load()
            listMaintenanceRecords(id).then((rows) => setLogs((prev) => ({ ...prev, [id]: rows }))).catch(() => undefined)
          }}
        />
      )}
    </div>
  )
}

/**
 * QualCloud (Phase 13) Stage 14 — real DQ/IQ/OQ/PQ qualification events
 * (each its own dated, attributed record, not a bare status flip) and
 * calibration/maintenance logging, alongside the pre-existing manual
 * qualificationStatus dropdown (kept as-is — a direct override capability
 * gated by the same `quality.manage_equipment` permission, not a
 * security bypass).
 */
function EquipmentQualifyModal({
  equipment,
  initialTab = 'qualification',
  onClose,
  onChanged,
}: {
  equipment: Equipment
  initialTab?: 'qualification' | 'maintenance'
  onClose: () => void
  onChanged: (message: string) => void
}) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'qualification' | 'maintenance'>(initialTab)
  // Pass B (C3): a passing step cites a validation report uploaded against this equipment first.
  const [reportDocumentId, setReportDocumentId] = useState<string | null>(null)
  const [reportName, setReportName] = useState<string | null>(null)
  const [stage, setStage] = useState<'dq' | 'iq' | 'oq' | 'pq'>('dq')
  const [result, setResult] = useState<'pass' | 'fail'>('pass')
  const [notes, setNotes] = useState('')
  const [maintenanceDate, setMaintenanceDate] = useState('')
  const [description, setDescription] = useState('')
  const [nextDueAt, setNextDueAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setSubmitting(true)
    setError(null)
    try {
      await fn()
      onChanged(message)
    } catch (err) {
      setError(getErrorMessage(err, t('qualityEntities.errorAction')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 space-y-4">
        <div>
          <h2 className="font-display font-bold text-lg text-foreground">{t('qualityEntities.qualifyEquipmentTitle', { name: equipment.name })}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {t('qualityEntities.currentStatus', { status: t(QUALIFICATION_STATUS_LABEL_KEYS[equipment.qualificationStatus]) })}
          </p>
        </div>

        <div className="flex gap-1 border-b border-border text-sm">
          {(['qualification', 'maintenance'] as const).map((tb) => (
            <button
              key={tb}
              onClick={() => setTab(tb)}
              className={`px-3 py-1.5 border-b-2 -mb-px capitalize ${tab === tb ? 'border-safemeds-teal text-safemeds-teal font-medium' : 'border-transparent text-muted-foreground'}`}
            >
              {tb === 'qualification' ? t('qualityEntities.tabQualificationEvent') : t('qualityEntities.tabLogMaintenance')}
            </button>
          ))}
        </div>

        {tab === 'qualification' && (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>{t('qualityEntities.stage')}</label>
              <select value={stage} onChange={(e) => setStage(e.target.value as typeof stage)} className={inputClass}>
                <option value="dq">{t('qualityEntities.stageDq')}</option>
                <option value="iq">{t('qualityEntities.stageIq')}</option>
                <option value="oq">{t('qualityEntities.stageOq')}</option>
                <option value="pq">{t('qualityEntities.stagePq')}</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('qualityEntities.resultField')}</label>
              <select value={result} onChange={(e) => setResult(e.target.value as typeof result)} className={inputClass}>
                <option value="pass">{t('qualityEntities.resultPass')}</option>
                <option value="fail">{t('qualityEntities.resultFail')}</option>
              </select>
            </div>
            {result === 'pass' && (
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs font-medium text-foreground">{t('qualityEntities.validationReport')}</p>
                <p className="mb-2 text-[11px] text-muted-foreground">
                  {t('qualityEntities.validationReportNote', { stage: stage.toUpperCase() })}
                </p>
                <p className="text-xs text-muted-foreground">{reportName ? t('qualityEntities.attachedFile', { name: reportName }) : t('qualityEntities.noReportAttached')}</p>
                <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs">
                  {reportName ? t('qualityEntities.replaceReport') : t('qualityEntities.uploadValidationReport')}
                  <input
                    type="file"
                    className="hidden"
                    disabled={submitting}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      run(async () => {
                        const uploaded = await uploadEquipmentValidationReport(equipment.id, file)
                        setReportDocumentId(uploaded.documentId)
                        setReportName(file.name)
                      }, t('qualityEntities.validationReportUploadedNotice'))
                    }}
                  />
                </label>
              </div>
            )}
            <div>
              <label className={labelClass}>{t('qualityEntities.notesField')}</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
            </div>
            <button
              disabled={submitting || (result === 'pass' && !reportDocumentId)}
              onClick={() =>
                run(
                  () =>
                    recordEquipmentQualificationEvent(equipment.id, {
                      stage,
                      result,
                      notes: notes.trim() || undefined,
                      ...(result === 'pass' && reportDocumentId ? { reportDocumentId } : {}),
                    }),
                  t('qualityEntities.eventRecordedNotice', { stage: stage.toUpperCase() }),
                )
              }
              className="w-full rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
            >
              {t('qualityEntities.recordEvent')}
            </button>
          </div>
        )}

        {tab === 'maintenance' && (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>{t('qualityEntities.maintenanceDate')}</label>
              <input type="date" value={maintenanceDate} onChange={(e) => setMaintenanceDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('qualityEntities.descriptionField')}</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('qualityEntities.descriptionPlaceholder')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('qualityEntities.nextDueDate')}</label>
              <input type="date" value={nextDueAt} onChange={(e) => setNextDueAt(e.target.value)} className={inputClass} />
            </div>
            <button
              disabled={submitting || !maintenanceDate || !description.trim()}
              onClick={() =>
                run(
                  () =>
                    recordMaintenance(equipment.id, {
                      maintenanceDate,
                      description: description.trim(),
                      nextDueAt: nextDueAt || undefined,
                    }),
                  t('qualityEntities.maintenanceLoggedNotice'),
                )
              }
              className="w-full rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
            >
              {t('qualityEntities.logMaintenance')}
            </button>
          </div>
        )}

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('qualityEntities.close')}
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateEquipmentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [equipmentType, setEquipmentType] = useState('')
  const [assetTag, setAssetTag] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = name.trim().length > 0 && equipmentType.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await createEquipment({ name: name.trim(), equipmentType: equipmentType.trim(), assetTag: assetTag.trim() || undefined })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, t('qualityEntities.errorAddEquipment')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">{t('qualityEntities.addEquipmentModalTitle')}</h2>

        <div>
          <label className={labelClass}>{t('qualityEntities.nameField')}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('qualityEntities.equipmentNamePlaceholder')} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>{t('qualityEntities.equipmentTypeField')}</label>
          <input value={equipmentType} onChange={(e) => setEquipmentType(e.target.value)} placeholder={t('qualityEntities.equipmentTypePlaceholder')} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>{t('qualityEntities.assetTagField')}</label>
          <input value={assetTag} onChange={(e) => setAssetTag(e.target.value)} placeholder={t('qualityEntities.assetTagPlaceholder')} className={inputClass} />
        </div>

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('qualityEntities.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('qualityEntities.addEquipment')}
          </button>
        </div>
      </div>
    </div>
  )
}
