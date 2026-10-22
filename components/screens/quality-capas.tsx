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

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const CAPA_STATUS_STYLES: Record<CapaStatus, string> = {
  open: 'bg-muted text-foreground',
  in_progress: 'bg-status-info/10 text-status-info',
  pending_effectiveness_check: 'bg-status-warning/10 text-status-warning',
  closed: 'bg-status-success/10 text-status-success',
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  audit_finding: 'Audit Finding',
  deviation: 'Deviation',
}

function sourceLabel(capa: Capa): string {
  if (!capa.sourceRecordType) return 'Standalone'
  return SOURCE_TYPE_LABELS[capa.sourceRecordType] ?? capa.sourceRecordType.replace(/_/g, ' ')
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
      .catch((err) => setError(getErrorMessage(err, 'Could not load CAPAs.')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">CAPAs</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to view CAPAs. Contact your System Administrator.</p>
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
        <h1 className="text-3xl font-display font-bold text-foreground">CAPAs</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every Corrective/Preventive Action across every module — audit findings, deviations, and standalone entries — in one place.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className={`${inputClass} w-auto`}>
          <option value="">All sources</option>
          <option value="audit_finding">Audit Finding</option>
          <option value="deviation">Deviation</option>
          <option value="standalone">Standalone</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputClass} w-auto`}>
          <option value="">All statuses</option>
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
            <p className="text-sm text-muted-foreground">No CAPAs match this filter.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">Root cause</th>
                <th className="p-3">Owner</th>
                <th className="p-3">Source</th>
                <th className="p-3">Corrective due</th>
                <th className="p-3">Status</th>
                <th className="p-3">Recurring</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} onClick={() => setOpenCapaId(c.id)} className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50">
                  <td className="p-3 text-foreground font-medium">{c.rootCause ?? c.title}</td>
                  <td className="p-3 text-muted-foreground text-xs">{(c as Capa & { owner?: { fullName: string } | null }).owner?.fullName ?? 'Unassigned'}</td>
                  <td className="p-3 text-muted-foreground text-xs">{sourceLabel(c)}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(c.correctiveActionDueDate ?? c.dueDate)}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CAPA_STATUS_STYLES[c.status]}`}>{CAPA_STATUS_LABELS[c.status]}</span>
                  </td>
                  <td className="p-3">
                    {c.flaggedRecurring ? <span className="rounded-full bg-status-warning/10 px-2 py-0.5 text-xs font-medium text-status-warning">Recurring</span> : <span className="text-xs text-muted-foreground">—</span>}
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
      .catch((err) => setError(getErrorMessage(err, 'Could not load this CAPA.')))
      .finally(() => setLoading(false))
  }, [capaId])

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
      setError(getErrorMessage(err, 'Could not complete this action.'))
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
                <p className="text-xs text-muted-foreground">{sourceLabel(capa)}</p>
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
                <p>{capa.recurringFlagReason ?? 'Flagged as a possible recurring issue.'}</p>
              </div>
            )}

            <div className="grid gap-2 text-sm">
              {capa.correction && <p><span className="text-muted-foreground">Correction:</span> {capa.correction}</p>}
              <p><span className="text-muted-foreground">Corrective Action:</span> {capa.correctiveAction}</p>
              {capa.preventiveAction && <p><span className="text-muted-foreground">Preventive Action:</span> {capa.preventiveAction}</p>}
              {capa.rootCauseCategory && <p><span className="text-muted-foreground">Root-Cause Category:</span> {capa.rootCauseCategory}</p>}
              <p><span className="text-muted-foreground">Owner:</span> {(capa as Capa & { owner?: { fullName: string } | null }).owner?.fullName ?? 'Unassigned'}</p>
              <p><span className="text-muted-foreground">Corrective action due:</span> {formatDate(capa.correctiveActionDueDate ?? capa.dueDate)}</p>
              {capa.preventiveAction && <p><span className="text-muted-foreground">Preventive action due:</span> {formatDate(capa.preventiveActionDueDate)}</p>}
              {capa.approvedAt && <p><span className="text-muted-foreground">Approved:</span> {formatDate(capa.approvedAt)}</p>}
              {capa.implementedAt && <p><span className="text-muted-foreground">Implemented:</span> {formatDate(capa.implementedAt)}</p>}
              {capa.requiresRegulatoryApproval && (
                <p><span className="text-muted-foreground">Regulatory Approval:</span> {capa.regulatoryApprovedAt ? `Approved ${formatDate(capa.regulatoryApprovedAt)}` : 'Pending'}</p>
              )}
              {capa.effectivenessCheckResult && (
                <p><span className="text-muted-foreground">Effectiveness Check:</span> <span className="capitalize">{capa.effectivenessCheckResult.replace(/_/g, ' ')}</span></p>
              )}
              {capa.closedAt && <p><span className="text-muted-foreground">Closed:</span> {formatDate(capa.closedAt)}</p>}
            </div>

            {canManage && (
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                {capa.status === 'open' && !capa.approvedAt && (
                  <button onClick={() => setShowAssignAction(true)} disabled={busy} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50">
                    Refine Action
                  </button>
                )}
                {!capa.approvedAt && (
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input type="checkbox" checked={requiresRegulatoryApproval} onChange={(e) => setRequiresRegulatoryApproval(e.target.checked)} />
                      Requires regulatory approval
                    </label>
                    <button
                      onClick={() => runAction(() => approveCapa(capa.id, requiresRegulatoryApproval), 'CAPA approved.')}
                      disabled={busy}
                      className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
                    >
                      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      <Check className="h-3.5 w-3.5" /> Approve
                    </button>
                  </div>
                )}
                {capa.approvedAt && !capa.implementedAt && (
                  <button
                    onClick={() => runAction(() => implementCapa(capa.id), 'CAPA marked implemented.')}
                    disabled={busy || (capa.requiresRegulatoryApproval && !capa.regulatoryApprovedAt)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    Mark Implemented
                  </button>
                )}
                {capa.implementedAt && capa.status !== 'closed' && !capa.effectivenessCheckResult && (
                  <button onClick={() => setShowEffectivenessCheck(true)} disabled={busy} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50">
                    Record Effectiveness Check
                  </button>
                )}
              </div>
            )}

            {capa.requiresRegulatoryApproval && !capa.regulatoryApprovedAt && (canManage || canRegulatoryApprove) && (
              <RegulatoryApproverPanel
                capa={capa}
                disabled={busy}
                onReassigned={() => {
                  setNotice('Regulatory approver updated.')
                  refresh()
                }}
              />
            )}

            {capa.status !== 'closed' && canManage && (
              <RecordDocumentUpload
                title="Closing evidence (required to close)"
                description="Evidence that the corrective action was done: a photo, a signed form, a record. The CAPA cannot be closed until at least one document is attached."
                uploadPath={`/capas/${capa.id}/evidence`}
                listRecordType="capa"
                recordId={capa.id}
                onUploaded={() => {
                  setNotice('Evidence attached.')
                  refresh()
                }}
                canUpload={canManage}
              />
            )}

            {canRegulatoryApprove && capa.requiresRegulatoryApproval && !capa.regulatoryApprovedAt && (
              <button
                onClick={() => runAction(() => regulatoryApproveCapa(capa.id), 'Regulatory approval recorded.')}
                disabled={busy}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                Record Regulatory Approval
              </button>
            )}

            {canClose && capa.effectivenessCheckResult && capa.status !== 'closed' && (
              <button
                onClick={() => runAction(() => closeCapa(capa.id), 'CAPA closed.')}
                disabled={busy}
                className="rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
              >
                Close CAPA
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
            setNotice('Action refined.')
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
            setNotice('Effectiveness check recorded.')
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
      setError(getErrorMessage(err, 'Could not change the regulatory approver.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <p className="text-xs text-muted-foreground">
        Regulatory approver: <span className="text-foreground">{designated?.fullName ?? (capa.regulatoryApproverUserId ? 'Assigned' : 'Not assigned')}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="rounded-lg border border-input bg-background px-2 py-1 text-xs text-foreground">
          <option value="">Choose a regulatory approver…</option>
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
          {capa.regulatoryApproverUserId ? 'Reassign approver' : 'Assign approver'}
        </button>
      </div>
      {approvers.length === 0 && (
        <p className="text-xs text-status-error">No user holds the regulatory-approval permission yet.</p>
      )}
      {error && <p className="text-xs text-status-error">{error}</p>}
    </div>
  )
}

function AssignActionModal({ capa, onClose, onAssigned }: { capa: Capa; onClose: () => void; onAssigned: () => void }) {
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
      setError(getErrorMessage(err, 'Could not refine this action.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4 my-8">
        <h3 className="font-display font-bold text-base text-foreground">Refine Action</h3>
        <div>
          <label className={labelClass}>Correction (immediate fix)</label>
          <textarea value={correction} onChange={(e) => setCorrection(e.target.value)} rows={2} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Corrective Action</label>
          <textarea value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} rows={2} className={inputClass} />
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

function EffectivenessCheckModal({ capaId, onClose, onRecorded }: { capaId: string; onClose: () => void; onRecorded: () => void }) {
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
      setError(getErrorMessage(err, 'Could not record this effectiveness check.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-display font-bold text-base text-foreground">Effectiveness Check</h3>
        <div className="space-y-2">
          {(['effective', 'not_effective'] as CapaEffectivenessResult[]).map((r) => (
            <label key={r} className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm text-foreground hover:bg-muted cursor-pointer">
              <input type="radio" name="effectiveness" checked={result === r} onChange={() => setResult(r)} />
              <span className="capitalize font-medium">{r.replace(/_/g, ' ')}</span>
            </label>
          ))}
        </div>
        <div>
          <label className={labelClass}>Note</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputClass} />
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
