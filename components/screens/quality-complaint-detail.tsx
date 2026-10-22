'use client'

import { OpenCapaModal } from '@/components/internal-audits/open-capa-modal'
import { RecordDocumentUpload } from '@/components/quality/record-document-upload'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  COMPLAINT_CHANNEL_LABELS,
  COMPLAINT_CLASSIFICATION_LABELS,
  COMPLAINT_CLASSIFICATIONS,
  ComplaintDetail,
  classifyComplaint,
  getComplaint,
  openCapaForComplaint,
  resolveComplaint,
} from '@/lib/api/complaints'
import type { AvailableTransition } from '@/lib/api/workflow'
import { WorkflowActionsPanel } from '@/components/pv-cases/workflow-actions-panel'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const STATUS_LABELS: Record<string, string> = {
  intake: 'Intake',
  classifying: 'Classifying',
  investigating: 'Investigating',
  resolved: 'Resolved',
}

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '—'
}

export function QualityComplaintDetail({ complaintId }: { complaintId: string }) {
  const router = useRouter()
  const { has } = usePermissions()
  const canLog = has('quality.log_deviation')
  const canResolve = has('quality.close_capa')
  const canManageCapa = has('quality.manage_capa')

  const [complaint, setComplaint] = useState<ComplaintDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [classifying, setClassifying] = useState<AvailableTransition | null>(null)
  const [showResolve, setShowResolve] = useState(false)
  const [showOpenCapa, setShowOpenCapa] = useState(false)

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    getComplaint(complaintId)
      .then(setComplaint)
      .catch((err) => setError(getErrorMessage(err, 'Could not load this complaint.')))
      .finally(() => setLoading(false))
  }, [complaintId])

  useEffect(() => load(), [load])

  const refresh = () => load(true)

  if (loading) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!complaint) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{error ?? 'Complaint not found.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <button onClick={() => router.push('/quality-complaints')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Complaints
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{complaint.complaintNumber}</p>
          <h1 className="text-2xl font-display font-bold text-foreground">
            Product Quality Complaint
          </h1>
          <p className="mt-1 text-sm text-foreground">
            Source: {COMPLAINT_CHANNEL_LABELS[complaint.channel as keyof typeof COMPLAINT_CHANNEL_LABELS] ?? complaint.channel}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Logged {formatDateTime(complaint.createdAt)}</p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">{STATUS_LABELS[complaint.status] ?? complaint.status}</span>
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Description</p>
        <p className="text-sm text-foreground whitespace-pre-wrap">{complaint.description}</p>
        {(complaint.reporterName || complaint.reporterContact) && (
          <p className="mt-2 text-xs text-muted-foreground">
            Reporter: {complaint.reporterName ?? '—'} {complaint.reporterContact && `(${complaint.reporterContact})`}
          </p>
        )}
      </div>

      {complaint.routedCaseId && (
        <div className="rounded-lg border border-status-error/30 bg-status-error/5 p-3 text-sm text-foreground">
          Routed to Pharmacovigilance as a real case — this complaint describes a possible adverse event and is now tracked there.
        </div>
      )}

      <WorkflowActionsPanel
        key={complaint.status}
        workflowInstanceId={complaint.workflowInstanceId}
        onTransitioned={refresh}
        customTriggers={{
          classifying: { label: 'Classify', onClick: (t) => setClassifying(t) },
        }}
      />

      {complaint.classification && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Classification</p>
          <p className="text-sm text-foreground">
            {complaint.classification ? COMPLAINT_CLASSIFICATION_LABELS[complaint.classification as keyof typeof COMPLAINT_CLASSIFICATION_LABELS] : ''}
            {complaint.severity && ` — ${complaint.severity}`}
          </p>
        </div>
      )}

      {canResolve && complaint.status !== 'resolved' && complaint.status !== 'closed' && (
        <RecordDocumentUpload
          title="Substantiating documents (required to resolve)"
          description="Records that substantiate the complaint or show it was investigated and found unfounded. Resolving the complaint is blocked until at least one is attached."
          uploadPath={`/quality/complaints/${complaint.id}/substantiation`}
          listRecordType="quality_complaint_substantiation"
          recordId={complaint.id}
          onUploaded={() => setNotice('Substantiating document attached.')}
          canUpload={canResolve}
        />
      )}

      {complaint.status === 'investigating' && canResolve && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resolve</p>
          <button onClick={() => setShowResolve(true)} className="rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce">
            Resolve Complaint
          </button>
        </div>
      )}

      {complaint.resolutionNote && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Resolution</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{complaint.resolutionNote}</p>
          <p className="mt-1 text-xs text-muted-foreground">Resolved {formatDateTime(complaint.resolvedAt)}</p>
        </div>
      )}

      {canManageCapa && !complaint.capaId && complaint.classification === 'quality_complaint' && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">CAPA</p>
          <p className="text-xs text-muted-foreground">Not every complaint needs a CAPA — a one-off packaging defect might just need a correction.</p>
          <button onClick={() => setShowOpenCapa(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
            Open CAPA
          </button>
        </div>
      )}

      {classifying && (
        <ClassifyModal
          complaintId={complaint.id}
          onClose={() => setClassifying(null)}
          onClassified={() => {
            setClassifying(null)
            setNotice('Complaint classified.')
            refresh()
          }}
        />
      )}

      {showResolve && (
        <ResolveModal
          onClose={() => setShowResolve(false)}
          onSubmit={async (resolutionNote) => {
            await resolveComplaint(complaint.id, resolutionNote)
            setShowResolve(false)
            setNotice('Complaint resolved.')
            refresh()
          }}
        />
      )}

      {showOpenCapa && (
        <OpenCapaModal
          contextNote="This CAPA is opened against this complaint. Owner, both due dates and the root cause are required, as for every CAPA."
          submit={(input) => openCapaForComplaint(complaint.id, input).then(() => undefined)}
          onClose={() => setShowOpenCapa(false)}
          onOpened={() => {
            setShowOpenCapa(false)
            setNotice('CAPA opened.')
            refresh()
          }}
        />
      )}
    </div>
  )
}

function ClassifyModal({
  complaintId,
  onClose,
  onClassified,
}: {
  complaintId: string
  onClose: () => void
  onClassified: () => void
}) {
  const [classification, setClassification] = useState<string>('quality_complaint')
  const [severity, setSeverity] = useState<string>('minor')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await classifyComplaint(complaintId, {
        classification,
        severity: classification === 'quality_complaint' ? severity : undefined,
      })
      onClassified()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not classify this complaint.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-display font-bold text-base text-foreground">Classify Complaint</h3>
        <div className="space-y-2">
          {COMPLAINT_CLASSIFICATIONS.map((c) => (
            <label key={c} className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm text-foreground hover:bg-muted cursor-pointer">
              <input type="radio" name="classification" checked={classification === c} onChange={() => setClassification(c)} />
              <span className="font-medium">{COMPLAINT_CLASSIFICATION_LABELS[c]}</span>
            </label>
          ))}
        </div>
        {classification === 'possible_ae' && (
          <p className="text-xs text-status-warning">This will route the complaint to Pharmacovigilance as a real case.</p>
        )}
        {classification === 'quality_complaint' && (
          <div>
            <label className={labelClass}>Severity</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={inputClass}>
              <option value="critical">Critical</option>
              <option value="major">Major</option>
              <option value="minor">Minor</option>
            </select>
          </div>
        )}
        {error && <p className="text-sm text-status-error">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Classify
          </button>
        </div>
      </div>
    </div>
  )
}

function ResolveModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (resolutionNote: string) => Promise<void> }) {
  const [resolutionNote, setResolutionNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = resolutionNote.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(resolutionNote.trim())
    } catch (err) {
      setError(getErrorMessage(err, 'Could not resolve this complaint.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-display font-bold text-base text-foreground">Resolve Complaint</h3>
        <div>
          <label className={labelClass}>Resolution Note *</label>
          <textarea value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} rows={4} className={inputClass} />
        </div>
        {error && <p className="text-sm text-status-error">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={!isValid || submitting} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Resolve
          </button>
        </div>
      </div>
    </div>
  )
}

