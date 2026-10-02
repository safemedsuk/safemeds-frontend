'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Loader2, Plus, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  closeFalsifiedProductReport,
  confirmFalsifiedProductReport,
  createFalsifiedProductReport,
  dismissFalsifiedProductReport,
  FalsifiedProductReport,
  listFalsifiedProductReports,
} from '@/lib/api/quality'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const SOURCE_LABELS: Record<string, string> = {
  market_surveillance: 'Market Surveillance',
  complaint: 'Complaint',
  distributor: 'Distributor',
  regulator: 'Regulator',
  scan_feature: 'Scan Feature (not yet built)',
}

const STATUS_STYLES: Record<string, string> = {
  reported: 'bg-muted text-foreground',
  confirmed: 'bg-status-warning/10 text-status-warning',
  dismissed: 'bg-status-success/10 text-status-success',
  closed: 'bg-status-error/10 text-status-error',
}

/**
 * QualCloud (Phase 13) Stage 16 — Falsified & Substandard Product
 * Handling. Confirming a report always opens a real linked Deviation,
 * and — where product safety is implicated — a real routed VigiCloud
 * PV case, both shown inline once confirmed. The "scan feature"
 * (QR/serialization scan-to-verify) is explicitly out of scope — the
 * `source` option exists only as a real, forward-reserved value.
 */
export function QualityFalsifiedProductReportsScreen() {
  const { has } = usePermissions()
  const canView = has('quality.view_all')
  const canManage = has('quality.manage_falsified_reports')

  const [reports, setReports] = useState<FalsifiedProductReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showCreate, setShowCreate] = useState(false)
  const [dismissing, setDismissing] = useState<FalsifiedProductReport | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listFalsifiedProductReports({ page: 1, limit: 50 })
      .then((res) => setReports(res.rows))
      .catch((err) => setError(getErrorMessage(err, 'Could not load falsified product reports.')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const doConfirm = async (report: FalsifiedProductReport) => {
    setBusyId(report.id)
    try {
      await confirmFalsifiedProductReport(report.id, { routeToPvCase: Boolean(report.productId) })
      setNotice('Report confirmed — a Deviation has been opened.')
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not confirm this report.'))
    } finally {
      setBusyId(null)
    }
  }

  const doClose = async (report: FalsifiedProductReport) => {
    setBusyId(report.id)
    try {
      await closeFalsifiedProductReport(report.id)
      setNotice('Report closed.')
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not close this report.'))
    } finally {
      setBusyId(null)
    }
  }

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">Falsified &amp; Substandard Product Reports</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to view these reports.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Falsified &amp; Substandard Product Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">Confirming a report opens a real linked Deviation and, where relevant, a PV case.</p>
        </div>
        {canManage && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors">
            <Plus className="h-4 w-4" /> Report
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
        ) : reports.length === 0 ? (
          <div className="p-12 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No reports yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">Source</th>
                <th className="p-3">Evidence</th>
                <th className="p-3">Linked Records</th>
                <th className="p-3">Status</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="p-3 text-foreground">{SOURCE_LABELS[r.source] ?? r.source}</td>
                  <td className="p-3 text-muted-foreground max-w-xs truncate">{r.evidenceDescription}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {r.linkedDeviationId && <span className="mr-2">Deviation</span>}
                    {r.linkedCaseId && <span className="mr-2">PV Case</span>}
                    {!r.linkedDeviationId && !r.linkedCaseId && '—'}
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[r.status] ?? 'bg-muted text-foreground'}`}>{r.status}</span>
                  </td>
                  <td className="p-3 space-x-3">
                    {r.status === 'reported' && canManage && (
                      <>
                        <button disabled={busyId === r.id} onClick={() => doConfirm(r)} className="text-xs font-medium text-safemeds-teal hover:underline disabled:opacity-50">
                          Confirm
                        </button>
                        <button onClick={() => setDismissing(r)} className="text-xs font-medium text-muted-foreground hover:underline">
                          Dismiss
                        </button>
                      </>
                    )}
                    {r.status === 'confirmed' && canManage && (
                      <button disabled={busyId === r.id} onClick={() => doClose(r)} className="text-xs font-medium text-safemeds-teal hover:underline disabled:opacity-50">
                        Close
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateReportModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            setNotice('Report filed.')
            load()
          }}
        />
      )}

      {dismissing && (
        <DismissReportModal
          onClose={() => setDismissing(null)}
          onDismissed={async (reason) => {
            await dismissFalsifiedProductReport(dismissing.id, { reason })
            setDismissing(null)
            setNotice('Report dismissed.')
            load()
          }}
        />
      )}
    </div>
  )
}

function CreateReportModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [source, setSource] = useState('market_surveillance')
  const [evidenceDescription, setEvidenceDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = evidenceDescription.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await createFalsifiedProductReport({ source, evidenceDescription: evidenceDescription.trim() })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not file this report.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 space-y-4 my-8">
        <h2 className="font-display font-bold text-lg text-foreground">Report a Suspected Falsified/Substandard Product</h2>
        <div>
          <label className={labelClass}>Source *</label>
          <select value={source} onChange={(e) => setSource(e.target.value)} className={inputClass}>
            {Object.entries(SOURCE_LABELS).map(([key, label]) => (
              <option key={key} value={key} disabled={key === 'scan_feature'}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Evidence Description *</label>
          <textarea value={evidenceDescription} onChange={(e) => setEvidenceDescription(e.target.value)} rows={4} className={inputClass} placeholder="Describe what was observed" />
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
            Report
          </button>
        </div>
      </div>
    </div>
  )
}

function DismissReportModal({ onClose, onDismissed }: { onClose: () => void; onDismissed: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!reason.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await onDismissed(reason.trim())
    } catch (err) {
      setError(getErrorMessage(err, 'Could not dismiss this report.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-display font-bold text-base text-foreground">Dismiss Report</h3>
        <div>
          <label className={labelClass}>Reason *</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={inputClass} placeholder="e.g. Investigated — product confirmed genuine" />
        </div>
        {error && <p className="text-sm text-status-error">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reason.trim() || submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
