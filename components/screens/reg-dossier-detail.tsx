'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Circle, Info, Link2, Loader2, Plus, ShieldAlert, Unlink } from 'lucide-react'
import { ApiRequestError, getErrorMessage } from '@/lib/api/client'
import { listDocuments, type DocumentWithVersions } from '@/lib/api/documents'
import {
  attachRegDossierDocument,
  detachRegDossierDocument,
  addRegDossierSlot,
  getRegDossier,
  type RegDossierDetail as RegDossierDetailData,
} from '@/lib/api/reg-dossiers'
import { type AvailableTransition } from '@/lib/api/workflow'
import { ENGAGEMENT_TYPE_LABELS } from '@/lib/api/company'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { Modal } from '@/components/ui/modal'
import { DecisionHistoryCard } from '@/components/ui/decision-history-card'
import { DocumentsPanel } from '@/components/documents/documents-panel'
import { RecordTasksPanel } from '@/components/tasks/record-tasks-panel'
import { WorkflowActionsPanel } from '@/components/pv-cases/workflow-actions-panel'
import { RegulatorySubmissionPanel } from '@/components/reg-dossiers/regulatory-submission-panel'
import { RegQueryPanel } from '@/components/reg-dossiers/reg-query-panel'
import { ApproveRegistrationModal } from '@/components/reg-dossiers/approve-registration-modal'

const STATUS_STYLES: Record<string, string> = {
  planning: 'bg-status-info/10 text-status-info',
  compiling: 'bg-status-warning/10 text-status-warning',
  completeness_check: 'bg-status-info/10 text-status-info',
  submitted: 'bg-status-info/10 text-status-info',
  query_received: 'bg-status-warning/10 text-status-warning',
  responding: 'bg-status-warning/10 text-status-warning',
  resubmitted_for_review: 'bg-status-info/10 text-status-info',
  approved: 'bg-status-success/10 text-status-success',
  rejected: 'bg-status-error/10 text-status-error',
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 p-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-info" />
      <p>{children}</p>
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

/**
 * RegCloud (Phase 12) Stages 1–3 — one detail page carrying all three
 * stages' own UI, the same "one record, several stages' worth of
 * sections" shape `PvCaseDetail`/`SignalDetail` already established:
 * Stage 1's classification info, Stage 3's live completeness checklist,
 * Stage 2's document-slot compilation mechanics, the real
 * `WorkflowActionsPanel` for `planning → compiling → completeness_check`,
 * and the Decision History timeline reading real transitions back from
 * the audit trail.
 */
export function RegDossierDetail({ dossierId }: { dossierId: string }) {
  const router = useRouter()
  const { has } = usePermissions()
  const canManageDossier = has('regulatory.manage_dossier')

  const [dossier, setDossier] = useState<RegDossierDetailData | null>(null)
  const [documents, setDocuments] = useState<DocumentWithVersions[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busySlotId, setBusySlotId] = useState<string | null>(null)
  const [showAddSlot, setShowAddSlot] = useState(false)
  const [approving, setApproving] = useState<AvailableTransition | null>(null)

  const loadDocuments = useCallback(() => {
    listDocuments('reg_dossier', dossierId)
      .then(setDocuments)
      .catch(() => setDocuments([]))
  }, [dossierId])

  // Special Corner SC-2's own established pattern — a silent refresh
  // after any action must not unmount the page behind a spinner, which
  // would reset scroll and collapse local UI state.
  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      setError(null)
      setNotFound(false)
      try {
        setDossier(await getRegDossier(dossierId))
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 404) {
          setNotFound(true)
        } else {
          setError(getErrorMessage(err, 'Could not load this dossier.'))
        }
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [dossierId],
  )

  const refresh = useCallback(() => load(true), [load])

  useEffect(() => {
    load()
    loadDocuments()
  }, [load, loadDocuments])

  const attachableDocuments = documents.filter((d) => d.versions.some((v) => v.status === 'stored'))

  const handleAttach = async (slotId: string, documentId: string) => {
    if (!documentId) return
    setBusySlotId(slotId)
    setError(null)
    try {
      await attachRegDossierDocument(dossierId, slotId, documentId)
      await refresh()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not attach this document.'))
    } finally {
      setBusySlotId(null)
    }
  }

  const handleDetach = async (slotId: string) => {
    setBusySlotId(slotId)
    setError(null)
    try {
      await detachRegDossierDocument(dossierId, slotId)
      await refresh()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not detach this document.'))
    } finally {
      setBusySlotId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading dossier…
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="space-y-6 p-6">
        <button onClick={() => router.push('/reg-dossiers')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Regulatory Dossiers
        </button>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">This dossier doesn&apos;t exist, or you don&apos;t have permission to view it.</p>
        </div>
      </div>
    )
  }

  if (error || !dossier) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error ?? 'Something went wrong.'}</div>
      </div>
    )
  }

  // RegCloud (Phase 12) Stage 15 — the two engagement-model gates
  // `RegEngagementModelGuards` enforces server-side, mirrored here so the
  // note-collection UI only shows up when it's actually going to matter.
  const requireNoteStates = ['rejected']
  if (dossier.effectiveEngagementType === 'dossier_review_only') requireNoteStates.push('submitted')
  if (dossier.effectiveEngagementType === 'client_handles_queries') requireNoteStates.push('resubmitted_for_review')

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      <button onClick={() => router.push('/reg-dossiers')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Regulatory Dossiers
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">{dossier.product.brandName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {dossier.authority.name} ({dossier.authority.code}) · Class: <span className="font-mono">{dossier.productClass}</span>
            {dossier.route !== '*' && <> · Route: <span className="font-mono">{dossier.route}</span></>}
          </p>
          {dossier.variation && (
            <p className="mt-1 text-xs text-status-info">
              {dossier.variation.variationType === 'renewal' ? 'Renewal' : 'Variation'} of registration{' '}
              <span className="font-mono">{dossier.variation.productRegistrationNumber}</span>
            </p>
          )}
          {dossier.effectiveEngagementType !== 'full_service' && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-status-warning">
              <Info className="h-3.5 w-3.5" />
              Engagement model: {ENGAGEMENT_TYPE_LABELS[dossier.effectiveEngagementType] ?? dossier.effectiveEngagementType}
              {dossier.engagementType && ' (dossier override)'}
            </p>
          )}
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap ${STATUS_STYLES[dossier.status] ?? 'bg-muted text-muted-foreground'}`}>
          {statusLabel(dossier.status)}
        </span>
      </div>

      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      {/* Stage 6 — `key` forces a clean remount (and re-fetch of available
          transitions) whenever the dossier's own status changes, including
          via the custom approve trigger below, which transitions the
          workflow itself rather than going through this panel's own
          runTransition() — see ApproveRegistrationModal's own doc comment. */}
      <WorkflowActionsPanel
        key={dossier.status}
        workflowInstanceId={dossier.workflowInstanceId}
        onTransitioned={refresh}
        requireNote={requireNoteStates}
        customTriggers={{
          approved: { onClick: (t) => setApproving(t) },
        }}
      />

      <DecisionHistoryCard entries={dossier.transitionHistory} resolveLabel={statusLabel} />

      <Section
        title="Completeness Check"
        subtitle="Every checklist item resolved for this country/authority/product class — the flagship gate blocks Compiling → Completeness Check until every mandatory one has a document attached"
      >
        <InfoNote>
          <strong className="text-foreground">Mandatory</strong> items must have a document attached before this
          dossier can pass the completeness gate. An <strong className="text-foreground">optional</strong> item, or
          one you added yourself as an extra, is shown for visibility but never blocks progress.
        </InfoNote>

        {dossier.completeness.slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No document checklist is configured yet for this country/authority/product class — nothing blocks this dossier.
          </p>
        ) : (
          <ul className="space-y-2">
            {dossier.documentSlots.map((slot) => {
              const status = dossier.completeness.slots.find((s) => s.slotId === slot.id)
              if (!status) return null
              return (
                <li key={slot.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {status.met ? (
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-status-success" />
                    ) : (
                      <Circle className="h-4 w-4 flex-shrink-0 text-muted-foreground/40" />
                    )}
                    <span className={`truncate text-sm ${status.met ? 'text-foreground' : 'text-muted-foreground'}`}>{status.label}</span>
                    {status.isMandatory && (
                      <span className="rounded-full bg-status-error/10 px-2 py-0.5 text-[10px] font-medium text-status-error whitespace-nowrap">Mandatory</span>
                    )}
                    {status.ctdModule && <span className="text-xs text-muted-foreground whitespace-nowrap">{status.ctdModule}</span>}
                  </div>

                  {canManageDossier && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {slot.documentId ? (
                        <button
                          onClick={() => handleDetach(slot.id)}
                          disabled={busySlotId === slot.id}
                          className="flex items-center gap-1 text-xs font-medium text-status-error hover:underline disabled:opacity-50"
                        >
                          {busySlotId === slot.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
                          Unlink
                        </button>
                      ) : (
                        <select
                          value=""
                          disabled={busySlotId === slot.id || attachableDocuments.length === 0}
                          onChange={(e) => handleAttach(slot.id, e.target.value)}
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground disabled:opacity-50"
                        >
                          <option value="">
                            {attachableDocuments.length === 0 ? 'Upload a document below first' : 'Link a document…'}
                          </option>
                          {attachableDocuments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.title}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {canManageDossier && (
          <button onClick={() => setShowAddSlot(true)} className="mt-3 flex items-center gap-1.5 text-xs font-medium text-safemeds-teal hover:underline">
            <Plus className="h-3.5 w-3.5" /> Add another document
          </button>
        )}
      </Section>

      <DocumentsPanel recordType="reg_dossier" recordId={dossier.id} onUploaded={() => { loadDocuments(); refresh() }} />

      <RegulatorySubmissionPanel dossierId={dossier.id} onGenerated={refresh} />

      <RegQueryPanel dossierId={dossier.id} onChanged={refresh} respondWithNoteOnly={dossier.effectiveEngagementType === 'client_handles_queries'} />

      <RecordTasksPanel recordType="reg_registration" recordId={dossier.id} />

      {showAddSlot && (
        <AddSlotModal
          onClose={() => setShowAddSlot(false)}
          onAdded={() => {
            setShowAddSlot(false)
            refresh()
          }}
          dossierId={dossier.id}
        />
      )}

      {approving && dossier.workflowInstanceId && (
        <ApproveRegistrationModal
          workflowInstanceId={dossier.workflowInstanceId}
          toStateName={approving.toStateName}
          isVariation={Boolean(dossier.variation)}
          onClose={() => setApproving(null)}
          onApproved={() => {
            setApproving(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function AddSlotModal({ dossierId, onClose, onAdded }: { dossierId: string; onClose: () => void; onAdded: () => void }) {
  const [labelOverride, setLabelOverride] = useState('')
  const [ctdModule, setCtdModule] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!labelOverride.trim()) return
    setSaving(true)
    setError(null)
    try {
      await addRegDossierSlot(dossierId, { labelOverride: labelOverride.trim(), ctdModule: ctdModule.trim() || undefined })
      onAdded()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not add this document.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Add an ad-hoc document" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          For a document the checklist didn&apos;t anticipate — this is never treated as mandatory by the completeness gate.
        </p>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">
            Label <Link2 className="inline h-3 w-3 text-muted-foreground" />
          </label>
          <input
            value={labelOverride}
            onChange={(e) => setLabelOverride(e.target.value)}
            placeholder="e.g. Supplementary cover letter"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">CTD module (optional)</label>
          <input
            value={ctdModule}
            onChange={(e) => setCtdModule(e.target.value)}
            placeholder="e.g. Module 1"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-xs text-status-error">{error}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!labelOverride.trim() || saving}
            className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Add
          </button>
        </div>
      </div>
    </Modal>
  )
}
