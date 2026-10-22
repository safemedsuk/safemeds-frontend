'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, Download, FileText, Info, Loader2, Plus, ShieldAlert, Sliders, UserPlus, X } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  acknowledgeDocument,
  assignReaders,
  listAssignableReaders,
  type AssignableReader,
  createRiskAssessment,
  downloadRiskRegister,
  createSop,
  createSpecification,
  DocumentAcknowledgment,
  getSeverityDefinitions,
  getSop,
  listAcknowledgmentsForDocument,
  listRetentionPolicies,
  listRiskAssessments,
  listSops,
  listSpecifications,
  RETENTION_RECORD_TYPES,
  reviseSop,
  RetentionPolicy,
  RiskAssessment,
  RiskLevel,
  SeverityDefinition,
  Sop,
  SopDetail,
  Specification,
  SpecificationParameterInput,
  upsertRetentionPolicy,
} from '@/lib/api/quality'
import { WorkflowActionsPanel } from '@/components/pv-cases/workflow-actions-panel'
import { CreateSpecificationModal, SpecificationParameterTable } from '@/components/quality/specification-parts'
import { ProductDetailModal } from '@/components/quality/product-detail-modal'
import { listBatches, listProducts, Product } from '@/lib/api/master-data'
import { listRecalls } from '@/lib/api/recalls'
import { listDeviations } from '@/lib/api/deviations'
import { listOos } from '@/lib/api/oos'
import { listComplaints } from '@/lib/api/complaints'
import { listChangeControls } from '@/lib/api/change-controls'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useAuthStore } from '@/lib/store/auth-store'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const RISK_LEVEL_STYLES: Record<RiskLevel, string> = {
  low: 'bg-status-success/10 text-status-success',
  medium: 'bg-status-warning/10 text-status-warning',
  high: 'bg-status-error/10 text-status-error',
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

type Tab = 'documents' | 'specifications' | 'risk-register' | 'retention'

/**
 * QualCloud (Phase 13) Stage 0.1/0.2/0.3 — the controlled-document
 * register's own top-level nav item (document control is Tier 1's own
 * flagship, not a footnote — per `todo-qualcloud.md`), alongside
 * Specifications, the ICH Q9 live Risk Register, and ALCOA+ retention
 * settings. Bare CRUD only for documents/specifications — the real
 * Draft→Review&Approve→Effective→Read&Understand→Revise/Retire
 * lifecycle is Stage 1's own build.
 */
export function QualityControlledDocumentsScreen() {
  const { has } = usePermissions()
  const canViewAll = has('quality.view_all')
  const [tab, setTab] = useState<Tab>('documents')

  if (!canViewAll) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">Controlled Documents</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to view controlled documents. Contact your System Administrator.</p>
        </div>
      </div>
    )
  }

  const tabs: { key: Tab; label: string; icon: typeof FileText }[] = [
    { key: 'documents', label: 'Controlled Documents', icon: FileText },
    { key: 'specifications', label: 'Specifications', icon: Sliders },
    { key: 'risk-register', label: 'Risk Register', icon: AlertTriangle },
    { key: 'retention', label: 'Retention Policies', icon: Info },
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Controlled Documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">SOPs, specifications, the ICH Q9 risk register, and ALCOA+ retention settings.</p>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === key ? 'border-safemeds-teal text-safemeds-teal' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'documents' && <DocumentsTab canManage={has('quality.manage_documents')} />}
      {tab === 'specifications' && <SpecificationsTab canManage={has('quality.manage_documents')} />}
      {tab === 'risk-register' && <RiskRegisterTab canManage={has('quality.manage_capa')} />}
      {tab === 'retention' && <RetentionTab canManage={has('quality.manage_documents')} />}
    </div>
  )
}

function DocumentsTab({ canManage }: { canManage: boolean }) {
  const [sops, setSops] = useState<Sop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showCreate, setShowCreate] = useState(false)
  const [openSopId, setOpenSopId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listSops({ page: 1, limit: 50 })
      .then((res) => setSops(res.rows))
      .catch((err) => setError(getErrorMessage(err, 'Could not load controlled documents.')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 p-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-info" />
        <p>
          A controlled document created here always starts as <strong className="text-foreground">Draft</strong>. The full
          approval/effective/read-and-understand/revise-or-retire lifecycle is a later build stage — for now this is the
          real, version-controlled register itself, not yet the workflow around it.
        </p>
      </div>

      <div className="flex justify-end">
        {canManage && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors">
            <Plus className="h-4 w-4" /> New Document
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
        ) : sops.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No controlled documents yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">Document #</th>
                <th className="p-3">Title</th>
                <th className="p-3">Type</th>
                <th className="p-3">Version</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {sops.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setOpenSopId(s.id)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                >
                  <td className="p-3 text-foreground font-mono text-xs">{s.documentNumber}</td>
                  <td className="p-3 text-foreground font-medium">{s.title}</td>
                  <td className="p-3 text-muted-foreground">{s.documentType.replace(/_/g, ' ')}</td>
                  <td className="p-3 text-muted-foreground">v{s.currentVersion}</td>
                  <td className="p-3">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground capitalize">{s.status.replace(/_/g, ' ')}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateSopModal
          onClose={() => setShowCreate(false)}
          onCreated={(documentNumber) => {
            setShowCreate(false)
            setNotice(`Controlled document ${documentNumber} created as a draft.`)
            load()
          }}
        />
      )}

      {openSopId && (
        <SopDetailModal
          sopId={openSopId}
          canManage={canManage}
          onClose={() => setOpenSopId(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}

const READER_ASSIGNABLE_STATES = ['draft', 'in_review', 'approved', 'effective']

const SOP_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-foreground',
  in_review: 'bg-status-info/10 text-status-info',
  approved: 'bg-status-info/10 text-status-info',
  effective: 'bg-status-success/10 text-status-success',
  superseded: 'bg-muted text-muted-foreground',
  retired: 'bg-status-error/10 text-status-error',
}

/**
 * QualCloud (Phase 13) Stage 1 — the controlled document's own detail
 * view: real workflow transitions (reusing `WorkflowActionsPanel`
 * exactly as-is, matching `RegDossierDetail`'s established `key={status}`
 * remount-on-change convention), the read-and-understand acknowledgment
 * tracker, and the "Revise" action (only reachable once effective, per
 * `SopService.reviseNewVersion()`'s own guard).
 */
function SopDetailModal({
  sopId,
  canManage,
  onClose,
  onChanged,
}: {
  sopId: string
  canManage: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const currentUser = useAuthStore((state) => state.currentUser)
  const [sop, setSop] = useState<SopDetail | null>(null)
  const [acknowledgments, setAcknowledgments] = useState<DocumentAcknowledgment[]>([])
  const [readers, setReaders] = useState<AssignableReader[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showAssign, setShowAssign] = useState(false)
  const [busy, setBusy] = useState(false)

  // Pass A root cause of the "loads forever" report: this used to fetch the
  // document, its readers and `GET /users` (gated `users.view`, which a
  // QUALITY_ASSOCIATE does not hold) in ONE Promise.all, so the users call
  // 403'd, the whole load failed, and `sop` stayed null — and the render
  // showed a spinner whenever `!sop`, so the error was never shown. The
  // document itself now loads on its own, the reader list is a separate,
  // non-fatal call, and a failed load renders its real error.
  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    getSop(sopId)
      .then((sopRes) => setSop(sopRes))
      .catch((err) => {
        setSop(null)
        setError(getErrorMessage(err, 'Could not load this document.'))
      })
      .finally(() => setLoading(false))
    listAcknowledgmentsForDocument(sopId)
      .then((ackRes) => setAcknowledgments(ackRes))
      .catch((err) => setError((prev) => prev ?? getErrorMessage(err, 'Could not load the reader list.')))
    listAssignableReaders()
      .then((list) => setReaders(list))
      .catch(() => setReaders([]))
  }, [sopId])

  useEffect(() => load(), [load])

  const refresh = () => {
    load(true)
    onChanged()
  }

  const userLabel = (userId: string) => readers.find((u) => u.id === userId)?.fullName ?? 'Assigned reader'

  const myAssignment = sop && currentUser ? acknowledgments.find((a) => a.userId === currentUser.id && a.versionAcknowledged === sop.currentVersion) : undefined

  const handleRevise = async () => {
    setBusy(true)
    setError(null)
    try {
      const revised = await reviseSop(sopId)
      setNotice(`Opened draft v${revised.currentVersion} of this document.`)
      onChanged()
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not revise this document.'))
    } finally {
      setBusy(false)
    }
  }

  const handleAcknowledge = async () => {
    setBusy(true)
    setError(null)
    try {
      await acknowledgeDocument(sopId)
      setNotice('Acknowledged — thank you for confirming you have read and understood this document.')
      load(true)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not record your acknowledgment.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-6 space-y-5 my-8">
        {!loading && !sop && error ? (
          <div className="space-y-4 p-6">
            <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>
            <div className="flex justify-end gap-2">
              <button onClick={() => load()} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">Try again</button>
              <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">Close</button>
            </div>
          </div>
        ) : loading || !sop ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{sop.documentNumber} · v{sop.currentVersion}</p>
                <h2 className="font-display font-bold text-lg text-foreground">{sop.title}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground capitalize">{sop.documentType.replace(/_/g, ' ')}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${SOP_STATUS_STYLES[sop.status] ?? 'bg-muted text-foreground'}`}>
                  {sop.status.replace(/_/g, ' ')}
                </span>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
            {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

            {sop.effectiveDate && (
              <p className="text-xs text-muted-foreground">Effective since {formatDate(sop.effectiveDate)}</p>
            )}
            {sop.supersedesDocumentId && (
              <p className="text-xs text-muted-foreground">Supersedes a prior version of this document.</p>
            )}

            <WorkflowActionsPanel
              key={sop.status}
              workflowInstanceId={sop.workflowInstanceId}
              onTransitioned={refresh}
              requireNote={['retired']}
              noteHelp={{
                title: () => 'Reason for retiring this document',
                body: 'Retiring removes the document from use. Record why (e.g. superseded by another procedure, no longer applicable). The reason is kept in the audit trail.',
                placeholder: 'e.g. Superseded by SOP-QA-014, process no longer in use',
              }}
            />

            {canManage && sop.status === 'effective' && (
              <button
                onClick={handleRevise}
                disabled={busy}
                className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Revise (open a new draft version)
              </button>
            )}

            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Read &amp; Understand Tracking</p>
                {canManage && READER_ASSIGNABLE_STATES.includes(sop.status) && (
                  <button
                    onClick={() => setShowAssign(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Assign Readers
                  </button>
                )}
              </div>

              {myAssignment && !myAssignment.acknowledgedAt && (
                <div className="flex items-center justify-between rounded-lg border border-status-warning/30 bg-status-warning/5 p-2.5">
                  <p className="text-xs text-foreground">
                    You&apos;ve been assigned to read this document (v{myAssignment.versionAcknowledged}).
                    {sop.status !== 'effective' && (
                      <span className="block text-muted-foreground">
                        This version is still {sop.status.replace(/_/g, ' ')} — you can acknowledge it once it becomes effective.
                      </span>
                    )}
                  </p>
                  {sop.status === 'effective' ? (
                    <button
                      onClick={handleAcknowledge}
                      disabled={busy}
                      className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" /> Acknowledge
                    </button>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Not yet effective</span>
                  )}
                </div>
              )}

              {acknowledgments.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No readers assigned yet.
                  {canManage && READER_ASSIGNABLE_STATES.includes(sop.status) && ' Use "Assign Readers" above to choose who must read this document.'}
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-1 pr-3">Reader</th>
                      <th className="py-1 pr-3">Version</th>
                      <th className="py-1">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acknowledgments.map((a) => (
                      <tr key={a.id} className="text-foreground">
                        <td className="py-1 pr-3">{userLabel(a.userId)}</td>
                        <td className="py-1 pr-3">v{a.versionAcknowledged}</td>
                        <td className="py-1">
                          {a.acknowledgedAt ? (
                            <span className="text-status-success">Acknowledged {formatDate(a.acknowledgedAt)}</span>
                          ) : a.overdue ? (
                            <span className="text-status-error">Overdue</span>
                          ) : (
                            <span className="text-muted-foreground">Pending</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>

      {showAssign && sop && (
        <AssignReadersModal
          sopId={sop.id}
          alreadyAssignedUserIds={acknowledgments.map((a) => a.userId)}
          users={readers}
          onClose={() => setShowAssign(false)}
          onAssigned={() => {
            setShowAssign(false)
            setNotice('Readers assigned.')
            load(true)
          }}
        />
      )}
    </div>
  )
}

function AssignReadersModal({
  sopId,
  alreadyAssignedUserIds,
  users,
  onClose,
  onAssigned,
}: {
  sopId: string
  alreadyAssignedUserIds: string[]
  users: AssignableReader[]
  onClose: () => void
  onAssigned: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const handleSubmit = async () => {
    if (selected.size === 0) return
    setSubmitting(true)
    setError(null)
    try {
      await assignReaders(sopId, Array.from(selected))
      onAssigned()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not assign these readers.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-display font-bold text-base text-foreground">Assign Readers</h3>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {users.map((u) => {
            const already = alreadyAssignedUserIds.includes(u.id)
            return (
              <label key={u.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${already ? 'text-muted-foreground' : 'text-foreground hover:bg-muted'}`}>
                <input type="checkbox" checked={selected.has(u.id) || already} disabled={already} onChange={() => toggle(u.id)} />
                {u.fullName}
                {already && <span className="text-xs">(already assigned)</span>}
              </label>
            )
          })}
        </div>
        {error && <p className="text-sm text-status-error">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={selected.size === 0 || submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Assign
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateSopModal({ onClose, onCreated }: { onClose: () => void; onCreated: (documentNumber: string) => void }) {
  const [title, setTitle] = useState('')
  const [documentType, setDocumentType] = useState('sop')
  const [manualNumber, setManualNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = title.trim().length > 0
  const manualTrimmed = manualNumber.trim()
  const manualNumericOnly = manualTrimmed.length > 0 && /^\d+$/.test(manualTrimmed)

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      const created = await createSop({
        title: title.trim(),
        documentType,
        ...(manualTrimmed ? { documentNumber: manualTrimmed } : {}),
      })
      onCreated(created.documentNumber)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this document.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">New Controlled Document</h2>

        <p className="text-xs text-muted-foreground">
          SafeMeds assigns the document number from your company&apos;s numbering scheme (set under Company Profile → Document numbering).
          The number is shown once the document is created.
        </p>

        <div>
          <label className={labelClass}>Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Deviation Handling Procedure" className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Document Type *</label>
          <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className={inputClass}>
            <option value="sop">SOP</option>
            <option value="policy">Policy</option>
            <option value="specification_reference">Specification Reference</option>
            <option value="master_batch_record">Master Batch Record</option>
            <option value="work_instruction">Work Instruction</option>
            <option value="form">Form</option>
            <option value="protocol">Protocol</option>
            <option value="report">Report</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Document number (optional)</label>
          <input
            value={manualNumber}
            onChange={(e) => setManualNumber(e.target.value)}
            placeholder="Leave blank to generate, e.g. WHO-SOP-0001"
            className={inputClass}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Type your own only if your company manages numbers by hand. It cannot be digits only (such as 0001), because
            system-generated numbers would otherwise also begin at 0001. It must be unique, ignoring case.
          </p>
          {manualNumericOnly && <p className="mt-1 text-[11px] text-status-error">A document number cannot be digits only. Add a company or type identifier.</p>}
        </div>

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting || manualNumericOnly}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Draft
          </button>
        </div>
      </div>
    </div>
  )
}

function SpecificationsTab({ canManage }: { canManage: boolean }) {
  const [specs, setSpecs] = useState<Specification[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showCreate, setShowCreate] = useState(false)
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null)
  const [pickedProductId, setPickedProductId] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([listSpecifications({ page: 1, limit: 100 }), listProducts({ page: 1, limit: 100 })])
      .then(([specRes, productRes]) => {
        setSpecs(specRes.rows)
        setProducts(productRes.rows)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load specifications.')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const productName = (id: string | null) => {
    if (!id) return null
    const p = products.find((x) => x.id === id)
    return p ? p.brandName : 'Unknown product'
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-2">
          <div className="min-w-[260px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">View a product</label>
            <select
              value={pickedProductId}
              onChange={(e) => setPickedProductId(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">Choose a product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brandName} — {p.genericName} {p.strength}
                </option>
              ))}
            </select>
          </div>
          <button
            disabled={!pickedProductId}
            onClick={() => setViewingProduct(products.find((p) => p.id === pickedProductId) ?? null)}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            Open product
          </button>
        </div>
        {canManage && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors">
            <Plus className="h-4 w-4" /> New Specification
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
        ) : specs.length === 0 ? (
          <div className="p-12 text-center">
            <Sliders className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No specifications yet.</p>
          </div>
        ) : (
          specs.map((spec) => (
            <div key={spec.id} className="border-b border-border last:border-0 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs text-muted-foreground">{spec.specificationNumber}</span>
                  <p className="font-medium text-foreground">{spec.title}</p>
                  {spec.productId && (
                    <button
                      onClick={() => setViewingProduct(products.find((p) => p.id === spec.productId) ?? null)}
                      className="mt-1 text-xs text-safemeds-teal hover:underline"
                    >
                      Product: {productName(spec.productId)}
                    </button>
                  )}
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground capitalize">{spec.specificationType.replace(/_/g, ' ')}</span>
              </div>
              {spec.parameters.length > 0 && (
                <table className="mt-3 w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-1 pr-3">Parameter</th>
                      <th className="py-1 pr-3">Test Method</th>
                      <th className="py-1 pr-3">Lower</th>
                      <th className="py-1 pr-3">Upper</th>
                      <th className="py-1">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spec.parameters.map((p) => (
                      <tr key={p.id} className="text-foreground">
                        <td className="py-1 pr-3">{p.parameterName}</td>
                        <td className="py-1 pr-3 text-muted-foreground">{p.testMethod ?? '—'}</td>
                        <td className="py-1 pr-3">{p.lowerLimit ?? '—'}</td>
                        <td className="py-1 pr-3">{p.upperLimit ?? '—'}</td>
                        <td className="py-1">{p.unit ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))
        )}
      </div>

      {showCreate && (
        <CreateSpecificationModal
          products={products}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            setNotice('Specification created as a draft.')
            load()
          }}
        />
      )}

      {viewingProduct && (
        <ProductDetailModal
          product={viewingProduct}
          products={products}
          canManage={canManage}
          onClose={() => {
            setViewingProduct(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function RiskRegisterTab({ canManage }: { canManage: boolean }) {
  const [exporting, setExporting] = useState<'xlsx' | 'csv' | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const exportRegister = async (format: 'xlsx' | 'csv') => {
    setExporting(format)
    setExportError(null)
    try {
      await downloadRiskRegister(format)
    } catch (err) {
      setExportError(getErrorMessage(err, 'The risk register could not be exported.'))
    } finally {
      setExporting(null)
    }
  }
  const [risks, setRisks] = useState<RiskAssessment[]>([])
  const [definitions, setDefinitions] = useState<SeverityDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([listRiskAssessments({ page: 1, limit: 50 }), getSeverityDefinitions()])
      .then(([riskRes, defs]) => {
        setRisks(riskRes.rows)
        setDefinitions(defs)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load the risk register.')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 p-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-info" />
        <p>
          ICH Q9&apos;s risk-management toolkit — score every risk on Severity × Probability (× Detectability, if you
          want a fuller FMEA-style RPN). Later stages (deviation intake, change control) will create rows here
          automatically; this is also open for a standalone risk assessment.
        </p>
      </div>

      {definitions.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-3">
          {definitions.map((d) => (
            <div key={d.key} className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground">{d.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{d.description}</p>
            </div>
          ))}
        </div>
      )}

      {exportError && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{exportError}</div>}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => exportRegister('xlsx')}
          disabled={exporting !== null}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          {exporting === 'xlsx' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export Excel
        </button>
        <button
          onClick={() => exportRegister('csv')}
          disabled={exporting !== null}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          {exporting === 'csv' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export CSV
        </button>
        {canManage && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors">
            <Plus className="h-4 w-4" /> New Risk Assessment
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
        ) : risks.length === 0 ? (
          <div className="p-12 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No risk assessments recorded yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">Title</th>
                <th className="p-3">Source</th>
                <th className="p-3">S × P × D</th>
                <th className="p-3">Score</th>
                <th className="p-3">Level</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="p-3 text-foreground font-medium">{r.title}</td>
                  <td className="p-3 text-muted-foreground text-xs">{r.sourceRecordType ? r.sourceRecordType.replace(/_/g, ' ') : 'Standalone'}</td>
                  <td className="p-3 text-muted-foreground">
                    {r.severity} × {r.probability}
                    {r.detectability != null ? ` × ${r.detectability}` : ''}
                  </td>
                  <td className="p-3 text-foreground font-mono">{r.score}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${RISK_LEVEL_STYLES[r.riskLevel]}`}>{r.riskLevel}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateRiskAssessmentModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            setNotice('Risk assessment recorded.')
            load()
          }}
        />
      )}
    </div>
  )
}

/**
 * Real-usage item (7 Oct 2026) — the record types a risk assessment can be
 * linked to, each with a short search-and-pick list so a user never types
 * a record id. Must match `risk-register-export.util.ts`'s own known types.
 */
const RISK_SOURCE_TYPES: { value: string; label: string }[] = [
  { value: '', label: 'Standalone (not linked to a record)' },
  { value: 'recall', label: 'Recall' },
  { value: 'deviation', label: 'Deviation' },
  { value: 'oos', label: 'OOS/OOT Investigation' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'change_control', label: 'Change Control' },
  { value: 'batch', label: 'Batch' },
  { value: 'product', label: 'Product' },
]

function CreateRiskAssessmentModal({
  defaultSourceRecordType,
  defaultSourceRecordId,
  defaultTitle,
  onClose,
  onCreated,
}: {
  defaultSourceRecordType?: string
  defaultSourceRecordId?: string
  defaultTitle?: string
  onClose: () => void
  onCreated: () => void
}) {
  const [title, setTitle] = useState(defaultTitle ?? '')
  const [sourceRecordType, setSourceRecordType] = useState(defaultSourceRecordType ?? '')
  const [sourceRecordId, setSourceRecordId] = useState(defaultSourceRecordId ?? '')
  const [severity, setSeverity] = useState(3)
  const [probability, setProbability] = useState(3)
  const [useDetectability, setUseDetectability] = useState(false)
  const [detectability, setDetectability] = useState(3)
  const [mitigationActions, setMitigationActions] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = title.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await createRiskAssessment({
        title: title.trim(),
        sourceRecordType: sourceRecordType || undefined,
        sourceRecordId: sourceRecordType ? sourceRecordId || undefined : undefined,
        severity,
        probability,
        detectability: useDetectability ? detectability : undefined,
        mitigationActions: mitigationActions.trim() || undefined,
      })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not record this risk assessment.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">New Risk Assessment</h2>

        <div>
          <label className={labelClass}>Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Temperature excursion during transport" className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Link to a record</label>
          <select
            value={sourceRecordType}
            onChange={(e) => {
              setSourceRecordType(e.target.value)
              setSourceRecordId('')
            }}
            className={inputClass}
            disabled={Boolean(defaultSourceRecordType)}
          >
            {RISK_SOURCE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {sourceRecordType && !defaultSourceRecordId && (
            <SourceRecordPicker sourceRecordType={sourceRecordType} value={sourceRecordId} onChange={setSourceRecordId} />
          )}
          {defaultSourceRecordId && <p className="mt-1 text-xs text-muted-foreground">Linked automatically from where you opened this form.</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Severity (1–5) *</label>
            <input type="number" min={1} max={5} value={severity} onChange={(e) => setSeverity(Number(e.target.value))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Probability (1–5) *</label>
            <input type="number" min={1} max={5} value={probability} onChange={(e) => setProbability(Number(e.target.value))} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={useDetectability} onChange={(e) => setUseDetectability(e.target.checked)} />
            Include Detectability (full 3-factor FMEA RPN)
          </label>
          {useDetectability && (
            <input type="number" min={1} max={5} value={detectability} onChange={(e) => setDetectability(Number(e.target.value))} className={`${inputClass} mt-2`} />
          )}
        </div>

        <div>
          <label className={labelClass}>Mitigation Actions</label>
          <textarea value={mitigationActions} onChange={(e) => setMitigationActions(e.target.value)} rows={2} className={inputClass} />
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
            Record
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * A short search-and-pick list for one of `RISK_SOURCE_TYPES` — the user
 * always picks a real record from a dropdown of up to 50, never types an id.
 */
function SourceRecordPicker({
  sourceRecordType,
  value,
  onChange,
}: {
  sourceRecordType: string
  value: string
  onChange: (id: string) => void
}) {
  const [options, setOptions] = useState<{ id: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    async function load() {
      switch (sourceRecordType) {
        case 'recall': {
          const page = await listRecalls({ limit: 50 })
          return page.rows.map((r) => ({ id: r.id, label: `${r.ref ?? r.id.slice(0, 8)} — ${r.product.brandName}` }))
        }
        case 'deviation': {
          const page = await listDeviations({ limit: 50 })
          return page.rows.map((d) => ({ id: d.id, label: `${d.deviationNumber} — ${d.title}` }))
        }
        case 'oos': {
          const page = await listOos({ limit: 50 })
          return page.rows.map((o) => ({ id: o.id, label: o.oosNumber }))
        }
        case 'complaint': {
          const page = await listComplaints({ limit: 50 })
          return page.rows.map((c) => ({ id: c.id, label: c.complaintNumber }))
        }
        case 'change_control': {
          const page = await listChangeControls({ limit: 50 })
          return page.rows.map((c) => ({ id: c.id, label: `${c.changeNumber} — ${c.title}` }))
        }
        case 'batch': {
          const page = await listBatches({ limit: 50 })
          return page.rows.map((b) => ({ id: b.id, label: b.batchNumber }))
        }
        case 'product': {
          const page = await listProducts({ limit: 50 })
          return page.rows.map((p) => ({ id: p.id, label: `${p.brandName} ${p.strength}` }))
        }
        default:
          return []
      }
    }
    load()
      .then((opts) => {
        if (!cancelled) setOptions(opts)
      })
      .catch((err) => !cancelled && setLoadError(getErrorMessage(err, 'Could not load records to link.')))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [sourceRecordType])

  if (loading) return <p className="mt-1 text-xs text-muted-foreground">Loading records…</p>
  if (loadError) return <p className="mt-1 text-xs text-status-error">{loadError}</p>
  if (options.length === 0) return <p className="mt-1 text-xs text-muted-foreground">No records of this type found.</p>

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} mt-2`}>
      <option value="">Choose a record…</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.label}</option>
      ))}
    </select>
  )
}

function RetentionTab({ canManage }: { canManage: boolean }) {
  const [policies, setPolicies] = useState<RetentionPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [savingType, setSavingType] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listRetentionPolicies({ page: 1, limit: 50 })
      .then((res) => setPolicies(res.rows))
      .catch((err) => setError(getErrorMessage(err, 'Could not load retention policies.')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const findYears = (recordType: string): number | undefined => policies.find((p) => p.recordType === recordType)?.retentionYears

  const handleSave = (recordType: string, retentionYears: number) => {
    setSavingType(recordType)
    upsertRetentionPolicy(recordType, retentionYears)
      .then(() => {
        setNotice(`Retention for "${recordType}" set to ${retentionYears} years.`)
        load()
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not save this retention policy.')))
      .finally(() => setSavingType(null))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 p-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-info" />
        <p>
          ALCOA+&apos;s &quot;Enduring / Available&quot; requirement, made concrete. Nothing is ever deleted regardless of
          this setting — retention means &quot;must remain retrievable,&quot; not &quot;may be destroyed.&quot; A blank row
          uses the coded WHO-GMP-aligned default shown below until a company sets its own.
        </p>
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">Record Type</th>
                <th className="p-3">Retention (years)</th>
                {canManage && <th className="p-3">Save</th>}
              </tr>
            </thead>
            <tbody>
              {RETENTION_RECORD_TYPES.map(({ key, label, defaultYears }) => {
                return (
                  <RetentionRow
                    key={key}
                    recordTypeKey={key}
                    label={label}
                    initialYears={findYears(key) ?? defaultYears}
                    isOverride={findYears(key) !== undefined}
                    canManage={canManage}
                    saving={savingType === key}
                    onSave={handleSave}
                  />
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function RetentionRow({
  recordTypeKey,
  label,
  initialYears,
  isOverride,
  canManage,
  saving,
  onSave,
}: {
  recordTypeKey: string
  label: string
  initialYears: number
  isOverride: boolean
  canManage: boolean
  saving: boolean
  onSave: (recordType: string, years: number) => void
}) {
  const [years, setYears] = useState(initialYears)

  return (
    <tr className="border-b border-border last:border-0">
      <td className="p-3 text-foreground">
        {label}
        {!isOverride && <span className="ml-2 text-xs text-muted-foreground">(default)</span>}
      </td>
      <td className="p-3">
        <input
          type="number"
          min={1}
          max={100}
          value={years}
          disabled={!canManage}
          onChange={(e) => setYears(Number(e.target.value))}
          className="w-20 rounded-lg border border-input bg-background px-2 py-1 text-sm text-foreground disabled:opacity-60"
        />
      </td>
      {canManage && (
        <td className="p-3">
          <button
            onClick={() => onSave(recordTypeKey, years)}
            disabled={saving}
            className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </td>
      )}
    </tr>
  )
}
