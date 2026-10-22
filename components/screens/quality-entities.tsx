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

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const SUPPLIER_STATUS_STYLES: Record<SupplierApprovalStatus, string> = {
  pending: 'bg-status-warning/10 text-status-warning',
  approved: 'bg-status-success/10 text-status-success',
  suspended: 'bg-status-warning/10 text-status-warning',
  disqualified: 'bg-status-error/10 text-status-error',
}

const QUALIFICATION_STATUS_LABELS: Record<EquipmentQualificationStatus, string> = {
  not_qualified: 'Not Qualified',
  dq_complete: 'DQ Complete',
  iq_complete: 'IQ Complete',
  oq_complete: 'OQ Complete',
  pq_complete: 'PQ Complete',
  qualified: 'Qualified',
  requalification_due: 'Requalification Due',
  disqualified: 'Disqualified',
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
  const { has } = usePermissions()
  const canViewAll = has('quality.view_all')
  const canManageSuppliers = has('quality.manage_suppliers')
  const canManageEquipment = has('quality.manage_equipment')

  const [tab, setTab] = useState<'suppliers' | 'equipment'>('suppliers')

  if (!canViewAll) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">Quality Entities</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to view quality entities. Contact your System Administrator.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Quality Entities</h1>
        <p className="mt-1 text-sm text-muted-foreground">The approved-supplier register and the equipment/instrument register.</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setTab('suppliers')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'suppliers' ? 'border-safemeds-teal text-safemeds-teal' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Package className="h-4 w-4" /> Suppliers
        </button>
        <button
          onClick={() => setTab('equipment')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'equipment' ? 'border-safemeds-teal text-safemeds-teal' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Wrench className="h-4 w-4" /> Equipment
        </button>
      </div>

      {tab === 'suppliers' ? <SuppliersTab canManage={canManageSuppliers} /> : <EquipmentTab canManage={canManageEquipment} />}
    </div>
  )
}

function SuppliersTab({ canManage }: { canManage: boolean }) {
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
      .catch((err) => setError(getErrorMessage(err, 'Could not load suppliers.')))
      .finally(() => setLoading(false))
  }, [])

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
        setNotice(`${supplier.name} marked ${approvalStatus}.`)
        load()
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not update supplier status.')))
  }

  const handleDeactivate = (supplier: Supplier) => {
    deactivateSupplier(supplier.id)
      .then(() => {
        setNotice(`${supplier.name} deactivated.`)
        load()
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not deactivate supplier.')))
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Supplier
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
            <p className="text-sm text-muted-foreground">No suppliers recorded yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">Name</th>
                <th className="p-3">Type</th>
                <th className="p-3">Criticality</th>
                <th className="p-3">Status</th>
                <th className="p-3">Active</th>
                {canManage && <th className="p-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="p-3 text-foreground font-medium">{s.name}</td>
                  <td className="p-3 text-muted-foreground">{s.supplierType.replace(/_/g, ' ')}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.criticality === 'critical' ? 'bg-status-error/10 text-status-error' : 'bg-muted text-muted-foreground'}`}>
                      {s.criticality === 'critical' ? 'Critical' : 'Non-critical'}
                    </span>
                  </td>
                  <td className="p-3">
                    {canManage ? (
                      <select
                        value={s.approvalStatus}
                        onChange={(e) => handleStatusChange(s, e.target.value as SupplierApprovalStatus)}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium border-0 ${SUPPLIER_STATUS_STYLES[s.approvalStatus]}`}
                      >
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="suspended">Suspended</option>
                        <option value="disqualified">Disqualified</option>
                      </select>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SUPPLIER_STATUS_STYLES[s.approvalStatus]}`}>{s.approvalStatus}</span>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">{s.isActive ? 'Yes' : 'No'}</td>
                  {canManage && (
                    <td className="p-3 space-x-3">
                      <button onClick={() => setQualifying(s)} className="text-xs text-safemeds-teal hover:underline">
                        Qualify
                      </button>
                      {s.isActive && (
                        <button onClick={() => handleDeactivate(s)} className="text-xs text-status-error hover:underline">
                          Deactivate
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
            setNotice('Supplier added.')
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
      setError(getErrorMessage(err, 'Could not complete this action.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 space-y-4">
        <div>
          <h2 className="font-display font-bold text-lg text-foreground">Qualify — {supplier.name}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {supplier.criticality === 'critical' ? 'Critical' : 'Non-critical'} · Currently {supplier.approvalStatus}
          </p>
        </div>

        <div className="flex gap-1 border-b border-border text-sm flex-wrap">
          {(['assess', 'audit', 'approve', 'monitor', 'coa'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 border-b-2 -mb-px capitalize ${tab === t ? 'border-safemeds-teal text-safemeds-teal font-medium' : 'border-transparent text-muted-foreground'}`}
            >
              {t === 'audit' ? 'Schedule Audit' : t === 'coa' ? 'Incoming CoA' : t}
            </button>
          ))}
        </div>

        {tab === 'assess' && (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Criterion</label>
              <input value={criteria} onChange={(e) => setCriteria(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Score (0–10)</label>
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
                  'Assessment recorded.',
                )
              }
              className="w-full rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
            >
              Record Assessment
            </button>
          </div>
        )}

        {tab === 'audit' && (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Scheduled Date</label>
              <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className={inputClass} />
            </div>
            <button
              disabled={submitting || !scheduledDate}
              onClick={() => run(() => scheduleSupplierAudit(supplier.id, { scheduledDate }), 'Qualification audit scheduled.')}
              className="w-full rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
            >
              Schedule Audit
            </button>
          </div>
        )}

        {tab === 'approve' && (
          <div className="space-y-3">
            <div className="rounded-lg border border-[var(--border)] p-3">
              <p className="text-xs font-medium text-[var(--text)]">GMP certificate</p>
              <p className="mb-2 text-[11px] text-[var(--text-muted)]">
                The supplier&apos;s GMP certificate must be on file before the supplier can be approved. Suspending or
                disqualifying does not need one.
              </p>
              {gmpAttached ? (
                <p className="text-xs text-emerald-700">Certificate on file.</p>
              ) : (
                <p className="text-xs text-amber-700">No certificate on file yet. Approval is blocked until one is uploaded.</p>
              )}
              <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs">
                Upload GMP certificate
                <input
                  type="file"
                  className="hidden"
                  disabled={submitting}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) run(async () => { await uploadSupplierGmpCertificate(supplier.id, file); setGmpAttached(true) }, 'GMP certificate uploaded.')
                  }}
                />
              </label>
            </div>
            <div>
              <label className={labelClass}>Note (optional)</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
            </div>
            <div className="flex gap-2">
              <button
                disabled={submitting || !gmpAttached}
                onClick={() => run(() => approveSupplier(supplier.id, { approvalStatus: 'approved', note }), 'Supplier approved.')}
                className="flex-1 rounded-lg bg-status-success px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                disabled={submitting}
                onClick={() => run(() => approveSupplier(supplier.id, { approvalStatus: 'suspended', note }), 'Supplier suspended.')}
                className="flex-1 rounded-lg bg-status-warning px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Suspend
              </button>
              <button
                disabled={submitting}
                onClick={() => run(() => approveSupplier(supplier.id, { approvalStatus: 'disqualified', note }), 'Supplier disqualified.')}
                className="flex-1 rounded-lg bg-status-error px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Disqualify
              </button>
            </div>
          </div>
        )}

        {tab === 'monitor' && (
          <div className="space-y-3">
            <p className="text-xs text-[var(--text-muted)]">
              A performance review is due every two years. Upload the review checklist, add the performance flag, then
              record the review. The next review is due two years after this one.
            </p>
            <div className="rounded-lg border border-[var(--border)] p-3">
              <p className="text-xs font-medium text-[var(--text)]">Review checklist</p>
              <p className="mb-2 text-[11px] text-[var(--text-muted)]">
                {checklistName ? `Attached: ${checklistName}` : 'No checklist attached to this review yet.'}
              </p>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs">
                {checklistName ? 'Replace checklist' : 'Upload checklist'}
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
                    }, 'Review checklist uploaded.')
                  }}
                />
              </label>
            </div>
            <div>
              <label className={labelClass}>Performance Flag</label>
              <input value={flag} onChange={(e) => setFlag(e.target.value)} placeholder="e.g. Late delivery on PO-1042" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Review notes (optional)</label>
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
                }, 'Performance review recorded.')
              }
              className="w-full rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
            >
              Record review
            </button>
            {reviews.length > 0 && (
              <div className="rounded-lg border border-[var(--border)] p-3">
                <p className="mb-2 text-xs font-medium text-[var(--text)]">Review history</p>
                <ul className="space-y-2 text-xs">
                  {reviews.map((r) => (
                    <li key={r.id}>
                      <span className="font-medium">{new Date(r.reviewedAt).toLocaleDateString()}</span> ·{' '}
                      {r.performanceFlags.join('; ') || 'No flags'} · next review{' '}
                      {new Date(r.nextReviewDueAt).toLocaleDateString()}
                      {r.checklistDocument && <span className="text-[var(--text-muted)]"> · checklist: {r.checklistDocument.title}</span>}
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
                No raw-material/API specifications are linked to this supplier yet — add one on the
                Controlled Documents / Specifications screen first.
              </p>
            ) : (
              <>
                <div>
                  <label className={labelClass}>Material Specification</label>
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
                  <label className={labelClass}>Batch / Lot Number</label>
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
                      'Certificate of Analysis recorded.',
                    )
                  }
                  className="w-full rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
                >
                  Record CoA
                </button>
              </>
            )}
          </div>
        )}

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateSupplierModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
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
      setError(getErrorMessage(err, 'Could not add this supplier.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">Add Supplier</h2>

        <div>
          <label className={labelClass}>Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme API Supplies Ltd" className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Supplier Type *</label>
          <select value={supplierType} onChange={(e) => setSupplierType(e.target.value)} className={inputClass}>
            <option value="api_supplier">API Supplier</option>
            <option value="excipient_supplier">Excipient Supplier</option>
            <option value="packaging_supplier">Packaging Supplier</option>
            <option value="contract_manufacturer">Contract Manufacturer</option>
            <option value="contract_lab">Contract Lab</option>
            <option value="contract_service">Contract Service</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Criticality</label>
          <select value={criticality} onChange={(e) => setCriticality(e.target.value as SupplierCriticality)} className={inputClass}>
            <option value="non_critical">Non-critical</option>
            <option value="critical">Critical (e.g. API or primary packaging)</option>
          </select>
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
            Add Supplier
          </button>
        </div>
      </div>
    </div>
  )
}

const DUE_BADGE: Record<string, { label: string; className: string }> = {
  overdue: { label: 'Overdue', className: 'bg-status-error/15 text-status-error' },
  due_soon: { label: 'Due soon', className: 'bg-status-warning/15 text-status-warning' },
  current: { label: 'Current', className: 'bg-status-success/15 text-status-success' },
  not_scheduled: { label: 'Not scheduled', className: 'bg-muted text-muted-foreground' },
}

function DueBadge({ status }: { status?: string }) {
  const meta = DUE_BADGE[status ?? 'not_scheduled'] ?? DUE_BADGE.not_scheduled
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>{meta.label}</span>
}

function fmtDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

function MaintenanceLog({ logs }: { logs: MaintenanceRecord[] | undefined }) {
  if (!logs) return <p className="text-xs text-muted-foreground">Loading…</p>
  if (logs.length === 0) return <p className="text-xs text-muted-foreground">No maintenance entries yet.</p>
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-muted-foreground">
          <th className="pb-2 font-medium">Date</th>
          <th className="pb-2 font-medium">Description</th>
          <th className="pb-2 font-medium">Next due</th>
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
      .catch((err) => setError(getErrorMessage(err, 'Could not load the maintenance log.')))
  }

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listEquipment({ page: 1, limit: 50 })
      .then((res) => setEquipment(res.rows))
      .catch((err) => setError(getErrorMessage(err, 'Could not load equipment.')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const handleStatusChange = (item: Equipment, qualificationStatus: EquipmentQualificationStatus) => {
    updateEquipment(item.id, { qualificationStatus })
      .then(() => {
        setNotice(`${item.name} marked ${QUALIFICATION_STATUS_LABELS[qualificationStatus]}.`)
        load()
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not update equipment status.')))
  }

  const handleDeactivate = (item: Equipment) => {
    deactivateEquipment(item.id)
      .then(() => {
        setNotice(`${item.name} deactivated.`)
        load()
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not deactivate equipment.')))
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Equipment
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
            <p className="text-sm text-muted-foreground">No equipment recorded yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">Name</th>
                <th className="p-3">Type</th>
                <th className="p-3">Asset Tag</th>
                <th className="p-3">Qualification Status</th>
                <th className="p-3">Calibration</th>
                <th className="p-3">Maintenance</th>
                <th className="p-3">Active</th>
                {canManage && <th className="p-3">Actions</th>}
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
                        {Object.entries(QUALIFICATION_STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-foreground">{QUALIFICATION_STATUS_LABELS[e.qualificationStatus]}</span>
                    )}
                  </td>
                  <td className="p-3">
                    <DueBadge status={e.calibrationStatus} />
                    <div className="mt-1 text-xs text-muted-foreground">
                      Last {fmtDate(e.lastCalibratedAt)} · next {fmtDate(e.calibrationDueAt)}
                    </div>
                  </td>
                  <td className="p-3">
                    <DueBadge status={e.maintenanceStatus} />
                    <div className="mt-1 text-xs text-muted-foreground">
                      {e.latestMaintenance
                        ? `${fmtDate(e.latestMaintenance.maintenanceDate)}: ${e.latestMaintenance.description}`
                        : 'No maintenance logged'}
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">{e.isActive ? 'Yes' : 'No'}</td>
                  {canManage && (
                    <td className="p-3 space-x-3">
                      <button onClick={() => setQualifying(e)} className="text-xs text-safemeds-teal hover:underline inline-flex items-center gap-1">
                        <ClipboardCheck className="h-3.5 w-3.5" /> Qualify
                      </button>
                      <button
                        onClick={() => setMaintenanceFor(e)}
                        className="text-xs text-safemeds-teal hover:underline"
                      >
                        Log maintenance
                      </button>
                      <button onClick={() => toggleLog(e.id)} className="text-xs text-muted-foreground hover:underline">
                        {expandedId === e.id ? 'Hide log' : 'Maintenance log'}
                      </button>
                      {e.isActive && (
                        <button onClick={() => handleDeactivate(e)} className="text-xs text-status-error hover:underline">
                          Deactivate
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
            setNotice('Equipment added.')
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
      setError(getErrorMessage(err, 'Could not complete this action.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 space-y-4">
        <div>
          <h2 className="font-display font-bold text-lg text-foreground">Qualify — {equipment.name}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Current status: {QUALIFICATION_STATUS_LABELS[equipment.qualificationStatus]}
          </p>
        </div>

        <div className="flex gap-1 border-b border-border text-sm">
          {(['qualification', 'maintenance'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 border-b-2 -mb-px capitalize ${tab === t ? 'border-safemeds-teal text-safemeds-teal font-medium' : 'border-transparent text-muted-foreground'}`}
            >
              {t === 'qualification' ? 'DQ / IQ / OQ / PQ Event' : 'Log Maintenance'}
            </button>
          ))}
        </div>

        {tab === 'qualification' && (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Stage</label>
              <select value={stage} onChange={(e) => setStage(e.target.value as typeof stage)} className={inputClass}>
                <option value="dq">DQ — Design Qualification</option>
                <option value="iq">IQ — Installation Qualification</option>
                <option value="oq">OQ — Operational Qualification</option>
                <option value="pq">PQ — Performance Qualification</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Result</label>
              <select value={result} onChange={(e) => setResult(e.target.value as typeof result)} className={inputClass}>
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
              </select>
            </div>
            {result === 'pass' && (
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs font-medium text-foreground">Validation report</p>
                <p className="mb-2 text-[11px] text-muted-foreground">
                  A passed {stage.toUpperCase()} needs its validation report. Upload it first, then record the event.
                </p>
                <p className="text-xs text-muted-foreground">{reportName ? `Attached: ${reportName}` : 'No report attached yet.'}</p>
                <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs">
                  {reportName ? 'Replace report' : 'Upload validation report'}
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
                      }, 'Validation report uploaded.')
                    }}
                  />
                </label>
              </div>
            )}
            <div>
              <label className={labelClass}>Notes</label>
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
                  `${stage.toUpperCase()} event recorded.`,
                )
              }
              className="w-full rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
            >
              Record Event
            </button>
          </div>
        )}

        {tab === 'maintenance' && (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Maintenance Date</label>
              <input type="date" value={maintenanceDate} onChange={(e) => setMaintenanceDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Routine preventive maintenance" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Next Due Date</label>
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
                  'Maintenance logged.',
                )
              }
              className="w-full rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
            >
              Log Maintenance
            </button>
          </div>
        )}

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateEquipmentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
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
      setError(getErrorMessage(err, 'Could not add this equipment.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">Add Equipment</h2>

        <div>
          <label className={labelClass}>Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HPLC-1" className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Equipment Type *</label>
          <input value={equipmentType} onChange={(e) => setEquipmentType(e.target.value)} placeholder="e.g. analytical_instrument" className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Asset Tag</label>
          <input value={assetTag} onChange={(e) => setAssetTag(e.target.value)} placeholder="e.g. EQ-0042" className={inputClass} />
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
            Add Equipment
          </button>
        </div>
      </div>
    </div>
  )
}
