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
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

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
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canViewAll = has('quality.view_all')
  const [tab, setTab] = useState<Tab>('documents')

  if (!canViewAll) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">{t('controlledDocs.title')}</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{t('controlledDocs.noPermission')}</p>
        </div>
      </div>
    )
  }

  const tabs: { key: Tab; label: string; icon: typeof FileText }[] = [
    { key: 'documents', label: t('controlledDocs.tabDocuments'), icon: FileText },
    { key: 'specifications', label: t('controlledDocs.tabSpecifications'), icon: Sliders },
    { key: 'risk-register', label: t('controlledDocs.tabRiskRegister'), icon: AlertTriangle },
    { key: 'retention', label: t('controlledDocs.tabRetention'), icon: Info },
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">{t('controlledDocs.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('controlledDocs.subtitle')}</p>
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
  const { t } = useTranslation()
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
      .catch((err) => setError(getErrorMessage(err, t('controlledDocs.errorLoadDocs'))))
      .finally(() => setLoading(false))
  }, [t])

  useEffect(load, [load])

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 p-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-info" />
        <p>
          {t('controlledDocs.draftLifecycleInfoPrefix')} <strong className="text-foreground">{t('controlledDocs.draftLifecycleInfoBold')}</strong>{t('controlledDocs.draftLifecycleInfoSuffix')}
        </p>
      </div>

      <div className="flex justify-end">
        {canManage && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors">
            <Plus className="h-4 w-4" /> {t('controlledDocs.newDocument')}
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
            <p className="text-sm text-muted-foreground">{t('controlledDocs.noDocsYet')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">{t('controlledDocs.columnDocNumber')}</th>
                <th className="p-3">{t('controlledDocs.columnTitle')}</th>
                <th className="p-3">{t('controlledDocs.columnType')}</th>
                <th className="p-3">{t('controlledDocs.columnVersion')}</th>
                <th className="p-3">{t('controlledDocs.columnStatus')}</th>
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
            setNotice(t('controlledDocs.createdAsDraftNotice', { number: documentNumber }))
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
  const { t } = useTranslation()
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
        setError(getErrorMessage(err, t('controlledDocs.errorLoadDocument')))
      })
      .finally(() => setLoading(false))
    listAcknowledgmentsForDocument(sopId)
      .then((ackRes) => setAcknowledgments(ackRes))
      .catch((err) => setError((prev) => prev ?? getErrorMessage(err, t('controlledDocs.errorLoadReaderList'))))
    listAssignableReaders()
      .then((list) => setReaders(list))
      .catch(() => setReaders([]))
  }, [sopId, t])

  useEffect(() => load(), [load])

  const refresh = () => {
    load(true)
    onChanged()
  }

  const userLabel = (userId: string) => readers.find((u) => u.id === userId)?.fullName ?? t('controlledDocs.assignedReaderFallback')

  const myAssignment = sop && currentUser ? acknowledgments.find((a) => a.userId === currentUser.id && a.versionAcknowledged === sop.currentVersion) : undefined

  const handleRevise = async () => {
    setBusy(true)
    setError(null)
    try {
      const revised = await reviseSop(sopId)
      setNotice(t('controlledDocs.openedDraftNotice', { version: String(revised.currentVersion) }))
      onChanged()
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, t('controlledDocs.errorRevise')))
    } finally {
      setBusy(false)
    }
  }

  const handleAcknowledge = async () => {
    setBusy(true)
    setError(null)
    try {
      await acknowledgeDocument(sopId)
      setNotice(t('controlledDocs.acknowledgedNotice'))
      load(true)
    } catch (err) {
      setError(getErrorMessage(err, t('controlledDocs.errorAcknowledge')))
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
              <button onClick={() => load()} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">{t('controlledDocs.tryAgain')}</button>
              <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">{t('controlledDocs.close')}</button>
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
              <p className="text-xs text-muted-foreground">{t('controlledDocs.effectiveSince', { date: formatDate(sop.effectiveDate) })}</p>
            )}
            {sop.supersedesDocumentId && (
              <p className="text-xs text-muted-foreground">{t('controlledDocs.supersedesNote')}</p>
            )}

            <WorkflowActionsPanel
              key={sop.status}
              workflowInstanceId={sop.workflowInstanceId}
              onTransitioned={refresh}
              requireNote={['retired']}
              noteHelp={{
                title: () => t('controlledDocs.retireReasonTitle'),
                body: t('controlledDocs.retireReasonBody'),
                placeholder: t('controlledDocs.retireReasonPlaceholder'),
              }}
            />

            {canManage && sop.status === 'effective' && (
              <button
                onClick={handleRevise}
                disabled={busy}
                className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('controlledDocs.revise')}
              </button>
            )}

            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('controlledDocs.readAndUnderstandTracking')}</p>
                {canManage && READER_ASSIGNABLE_STATES.includes(sop.status) && (
                  <button
                    onClick={() => setShowAssign(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> {t('controlledDocs.assignReaders')}
                  </button>
                )}
              </div>

              {myAssignment && !myAssignment.acknowledgedAt && (
                <div className="flex items-center justify-between rounded-lg border border-status-warning/30 bg-status-warning/5 p-2.5">
                  <p className="text-xs text-foreground">
                    {t('controlledDocs.assignedToRead', { version: String(myAssignment.versionAcknowledged) })}
                    {sop.status !== 'effective' && (
                      <span className="block text-muted-foreground">
                        {t('controlledDocs.stillStatusNote', { status: sop.status.replace(/_/g, ' ') })}
                      </span>
                    )}
                  </p>
                  {sop.status === 'effective' ? (
                    <button
                      onClick={handleAcknowledge}
                      disabled={busy}
                      className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" /> {t('controlledDocs.acknowledge')}
                    </button>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t('controlledDocs.notYetEffective')}</span>
                  )}
                </div>
              )}

              {acknowledgments.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t('controlledDocs.noReadersAssigned')}
                  {canManage && READER_ASSIGNABLE_STATES.includes(sop.status) && t('controlledDocs.useAssignReadersHint')}
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-1 pr-3">{t('controlledDocs.columnReader')}</th>
                      <th className="py-1 pr-3">{t('controlledDocs.columnVersionShort')}</th>
                      <th className="py-1">{t('controlledDocs.columnStatusShort')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acknowledgments.map((a) => (
                      <tr key={a.id} className="text-foreground">
                        <td className="py-1 pr-3">{userLabel(a.userId)}</td>
                        <td className="py-1 pr-3">v{a.versionAcknowledged}</td>
                        <td className="py-1">
                          {a.acknowledgedAt ? (
                            <span className="text-status-success">{t('controlledDocs.acknowledgedOn', { date: formatDate(a.acknowledgedAt) })}</span>
                          ) : a.overdue ? (
                            <span className="text-status-error">{t('controlledDocs.overdue')}</span>
                          ) : (
                            <span className="text-muted-foreground">{t('controlledDocs.pending')}</span>
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
            setNotice(t('controlledDocs.readersAssignedNotice'))
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
  const { t } = useTranslation()
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
      setError(getErrorMessage(err, t('controlledDocs.errorAssignReaders')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-display font-bold text-base text-foreground">{t('controlledDocs.assignReadersModalTitle')}</h3>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {users.map((u) => {
            const already = alreadyAssignedUserIds.includes(u.id)
            return (
              <label key={u.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${already ? 'text-muted-foreground' : 'text-foreground hover:bg-muted'}`}>
                <input type="checkbox" checked={selected.has(u.id) || already} disabled={already} onChange={() => toggle(u.id)} />
                {u.fullName}
                {already && <span className="text-xs">{t('controlledDocs.alreadyAssigned')}</span>}
              </label>
            )
          })}
        </div>
        {error && <p className="text-sm text-status-error">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('controlledDocs.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={selected.size === 0 || submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('controlledDocs.assign')}
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateSopModal({ onClose, onCreated }: { onClose: () => void; onCreated: (documentNumber: string) => void }) {
  const { t } = useTranslation()
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
      setError(getErrorMessage(err, t('controlledDocs.errorCreateDocument')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">{t('controlledDocs.newDocumentModalTitle')}</h2>

        <p className="text-xs text-muted-foreground">
          {t('controlledDocs.numberingNote')}
        </p>

        <div>
          <label className={labelClass}>{t('controlledDocs.titleField')}</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('controlledDocs.titlePlaceholder')} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>{t('controlledDocs.documentTypeField')}</label>
          <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className={inputClass}>
            <option value="sop">{t('controlledDocs.typeSop')}</option>
            <option value="policy">{t('controlledDocs.typePolicy')}</option>
            <option value="specification_reference">{t('controlledDocs.typeSpecReference')}</option>
            <option value="master_batch_record">{t('controlledDocs.typeMasterBatchRecord')}</option>
            <option value="work_instruction">{t('controlledDocs.typeWorkInstruction')}</option>
            <option value="form">{t('controlledDocs.typeForm')}</option>
            <option value="protocol">{t('controlledDocs.typeProtocol')}</option>
            <option value="report">{t('controlledDocs.typeReport')}</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>{t('controlledDocs.documentNumberOptional')}</label>
          <input
            value={manualNumber}
            onChange={(e) => setManualNumber(e.target.value)}
            placeholder={t('controlledDocs.documentNumberPlaceholder')}
            className={inputClass}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t('controlledDocs.documentNumberHelp')}
          </p>
          {manualNumericOnly && <p className="mt-1 text-[11px] text-status-error">{t('controlledDocs.documentNumberNumericError')}</p>}
        </div>

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('controlledDocs.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting || manualNumericOnly}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('controlledDocs.createDraft')}
          </button>
        </div>
      </div>
    </div>
  )
}

function SpecificationsTab({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation()
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
      .catch((err) => setError(getErrorMessage(err, t('controlledDocs.errorLoadSpecs'))))
      .finally(() => setLoading(false))
  }, [t])

  useEffect(load, [load])

  const productName = (id: string | null) => {
    if (!id) return null
    const p = products.find((x) => x.id === id)
    return p ? p.brandName : t('controlledDocs.unknownProduct')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-2">
          <div className="min-w-[260px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t('controlledDocs.viewAProduct')}</label>
            <select
              value={pickedProductId}
              onChange={(e) => setPickedProductId(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">{t('controlledDocs.chooseAProduct')}</option>
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
            {t('controlledDocs.openProduct')}
          </button>
        </div>
        {canManage && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors">
            <Plus className="h-4 w-4" /> {t('controlledDocs.newSpecification')}
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
            <p className="text-sm text-muted-foreground">{t('controlledDocs.noSpecsYet')}</p>
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
                      {t('controlledDocs.productColonValue', { name: productName(spec.productId) ?? '' })}
                    </button>
                  )}
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground capitalize">{spec.specificationType.replace(/_/g, ' ')}</span>
              </div>
              {spec.parameters.length > 0 && (
                <table className="mt-3 w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-1 pr-3">{t('controlledDocs.columnParameter')}</th>
                      <th className="py-1 pr-3">{t('controlledDocs.columnTestMethod')}</th>
                      <th className="py-1 pr-3">{t('controlledDocs.columnLower')}</th>
                      <th className="py-1 pr-3">{t('controlledDocs.columnUpper')}</th>
                      <th className="py-1">{t('controlledDocs.columnUnit')}</th>
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
            setNotice(t('controlledDocs.specificationCreatedNotice'))
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
  const { t } = useTranslation()
  const [exporting, setExporting] = useState<'xlsx' | 'csv' | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const exportRegister = async (format: 'xlsx' | 'csv') => {
    setExporting(format)
    setExportError(null)
    try {
      await downloadRiskRegister(format)
    } catch (err) {
      setExportError(getErrorMessage(err, t('controlledDocs.errorExportRiskRegister')))
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
      .catch((err) => setError(getErrorMessage(err, t('controlledDocs.errorLoadRiskRegister'))))
      .finally(() => setLoading(false))
  }, [t])

  useEffect(load, [load])

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 p-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-info" />
        <p>
          {t('controlledDocs.riskRegisterIntro')}
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
          {exporting === 'xlsx' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {t('controlledDocs.exportExcel')}
        </button>
        <button
          onClick={() => exportRegister('csv')}
          disabled={exporting !== null}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          {exporting === 'csv' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {t('controlledDocs.exportCsv')}
        </button>
        {canManage && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors">
            <Plus className="h-4 w-4" /> {t('controlledDocs.newRiskAssessment')}
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
            <p className="text-sm text-muted-foreground">{t('controlledDocs.noRiskAssessmentsYet')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">{t('controlledDocs.columnRiskTitle')}</th>
                <th className="p-3">{t('controlledDocs.columnSource')}</th>
                <th className="p-3">{t('controlledDocs.columnSPD')}</th>
                <th className="p-3">{t('controlledDocs.columnScore')}</th>
                <th className="p-3">{t('controlledDocs.columnLevel')}</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="p-3 text-foreground font-medium">{r.title}</td>
                  <td className="p-3 text-muted-foreground text-xs">{r.sourceRecordType ? r.sourceRecordType.replace(/_/g, ' ') : t('controlledDocs.standalone')}</td>
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
            setNotice(t('controlledDocs.riskAssessmentRecordedNotice'))
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
const RISK_SOURCE_TYPE_KEYS: { value: string; labelKey: MessageKey }[] = [
  { value: '', labelKey: 'controlledDocs.riskSourceStandalone' },
  { value: 'recall', labelKey: 'controlledDocs.riskSourceRecall' },
  { value: 'deviation', labelKey: 'controlledDocs.riskSourceDeviation' },
  { value: 'oos', labelKey: 'controlledDocs.riskSourceOos' },
  { value: 'complaint', labelKey: 'controlledDocs.riskSourceComplaint' },
  { value: 'change_control', labelKey: 'controlledDocs.riskSourceChangeControl' },
  { value: 'batch', labelKey: 'controlledDocs.riskSourceBatch' },
  { value: 'product', labelKey: 'controlledDocs.riskSourceProduct' },
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
  const { t } = useTranslation()
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
      setError(getErrorMessage(err, t('controlledDocs.errorRecordRisk')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">{t('controlledDocs.newRiskAssessmentModalTitle')}</h2>

        <div>
          <label className={labelClass}>{t('controlledDocs.titleField')}</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('controlledDocs.riskTitlePlaceholder')} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>{t('controlledDocs.linkToARecord')}</label>
          <select
            value={sourceRecordType}
            onChange={(e) => {
              setSourceRecordType(e.target.value)
              setSourceRecordId('')
            }}
            className={inputClass}
            disabled={Boolean(defaultSourceRecordType)}
          >
            {RISK_SOURCE_TYPE_KEYS.map((ty) => (
              <option key={ty.value} value={ty.value}>{t(ty.labelKey)}</option>
            ))}
          </select>
          {sourceRecordType && !defaultSourceRecordId && (
            <SourceRecordPicker sourceRecordType={sourceRecordType} value={sourceRecordId} onChange={setSourceRecordId} />
          )}
          {defaultSourceRecordId && <p className="mt-1 text-xs text-muted-foreground">{t('controlledDocs.linkedAutomaticallyNote')}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t('controlledDocs.severityField')}</label>
            <input type="number" min={1} max={5} value={severity} onChange={(e) => setSeverity(Number(e.target.value))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t('controlledDocs.probabilityField')}</label>
            <input type="number" min={1} max={5} value={probability} onChange={(e) => setProbability(Number(e.target.value))} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={useDetectability} onChange={(e) => setUseDetectability(e.target.checked)} />
            {t('controlledDocs.includeDetectability')}
          </label>
          {useDetectability && (
            <input type="number" min={1} max={5} value={detectability} onChange={(e) => setDetectability(Number(e.target.value))} className={`${inputClass} mt-2`} />
          )}
        </div>

        <div>
          <label className={labelClass}>{t('controlledDocs.mitigationActions')}</label>
          <textarea value={mitigationActions} onChange={(e) => setMitigationActions(e.target.value)} rows={2} className={inputClass} />
        </div>

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('controlledDocs.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('controlledDocs.record')}
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
  const { t } = useTranslation()
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
      .catch((err) => !cancelled && setLoadError(getErrorMessage(err, t('controlledDocs.errorLoadRecordsToLink'))))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [sourceRecordType, t])

  if (loading) return <p className="mt-1 text-xs text-muted-foreground">{t('controlledDocs.loadingRecords')}</p>
  if (loadError) return <p className="mt-1 text-xs text-status-error">{loadError}</p>
  if (options.length === 0) return <p className="mt-1 text-xs text-muted-foreground">{t('controlledDocs.noRecordsOfType')}</p>

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} mt-2`}>
      <option value="">{t('controlledDocs.chooseARecord')}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.label}</option>
      ))}
    </select>
  )
}

function RetentionTab({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation()
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
      .catch((err) => setError(getErrorMessage(err, t('controlledDocs.errorLoadRetention'))))
      .finally(() => setLoading(false))
  }, [t])

  useEffect(load, [load])

  const findYears = (recordType: string): number | undefined => policies.find((p) => p.recordType === recordType)?.retentionYears

  const handleSave = (recordType: string, retentionYears: number) => {
    setSavingType(recordType)
    upsertRetentionPolicy(recordType, retentionYears)
      .then(() => {
        setNotice(t('controlledDocs.retentionSetNotice', { type: recordType, years: String(retentionYears) }))
        load()
      })
      .catch((err) => setError(getErrorMessage(err, t('controlledDocs.errorSaveRetention'))))
      .finally(() => setSavingType(null))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 p-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-info" />
        <p>
          {t('controlledDocs.retentionIntro')}
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
                <th className="p-3">{t('controlledDocs.columnRecordType')}</th>
                <th className="p-3">{t('controlledDocs.columnRetentionYears')}</th>
                {canManage && <th className="p-3">{t('controlledDocs.columnSave')}</th>}
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
  const { t } = useTranslation()
  const [years, setYears] = useState(initialYears)

  return (
    <tr className="border-b border-border last:border-0">
      <td className="p-3 text-foreground">
        {label}
        {!isOverride && <span className="ml-2 text-xs text-muted-foreground">{t('controlledDocs.default')}</span>}
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
            {saving ? t('controlledDocs.saving') : t('controlledDocs.save')}
          </button>
        </td>
      )}
    </tr>
  )
}
