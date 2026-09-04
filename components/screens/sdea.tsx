'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, FileSignature, Loader2, Upload } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { uploadDocument } from '@/lib/api/documents'
import { Distributor, listDistributors } from '@/lib/api/reconciliation'
import { activateSdea, attachSdeaDocument, createSdea, getSdeaStatusForDistributor, listSdeas, Sdea, SDEA_STATUS_LABELS, SdeaDistributorStatus, SdeaStatus } from '@/lib/api/sdea'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const DISTRIBUTOR_STATUS_STYLES: Record<SdeaDistributorStatus, string> = {
  active: 'bg-status-success/10 text-status-success',
  expiring: 'bg-status-warning/10 text-status-warning',
  expired: 'bg-status-error/10 text-status-error',
  missing: 'bg-muted text-muted-foreground',
}

const DISTRIBUTOR_STATUS_LABELS: Record<SdeaDistributorStatus, string> = {
  active: 'Active',
  expiring: 'Expiring Soon',
  expired: 'Expired',
  missing: 'No SDEA',
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

interface DistributorRow {
  distributor: Distributor
  status: SdeaDistributorStatus
}

const SDEA_HISTORY_COLUMNS: DataTableColumn<Sdea>[] = [
  { key: 'title', label: 'Title' },
  { key: 'version', label: 'Version', render: (v) => <span className="font-mono text-xs">v{v}</span> },
  { key: 'status', label: 'Status', render: (v) => SDEA_STATUS_LABELS[v as SdeaStatus] },
  { key: 'expiryDate', label: 'Expiry', sortable: true, render: (v) => formatDate(v) },
]

/**
 * VigiCloud Stage 16.5 — the SDEA repository, framed around each
 * distributor's own current status (the "reconciliation-at-risk flag"
 * this stage exists to surface) rather than a bare version list.
 */
export function SdeaScreen() {
  const { has } = usePermissions()
  const canManage = has('sdea.manage')

  const [rows, setRows] = useState<DistributorRow[]>([])
  const [history, setHistory] = useState<Sdea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showNew, setShowNew] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyLimit, setHistoryLimit] = useState(10)
  const [historyTotalPages, setHistoryTotalPages] = useState(1)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const distResult = await listDistributors({ limit: 100 })
      const statuses = await Promise.all(distResult.distributors.map((d) => getSdeaStatusForDistributor(d.id)))
      setRows(distResult.distributors.map((d, i) => ({ distributor: d, status: statuses[i].status })))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load SDEA data.'))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadHistory = useCallback(
    async (page = historyPage, limit = historyLimit) => {
      setHistoryLoading(true)
      try {
        const { sdeas, meta } = await listSdeas(page, limit)
        setHistory(sdeas)
        setHistoryTotalPages(meta.totalPages)
        setHistoryTotal(meta.total)
      } catch (err) {
        setError(getErrorMessage(err, 'Could not load SDEA version history.'))
      } finally {
        setHistoryLoading(false)
      }
    },
    [historyPage, historyLimit],
  )

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    loadHistory(historyPage, historyLimit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyPage, historyLimit])

  const handleHistoryRowsPerPageChange = (n: number) => {
    setHistoryLimit(n)
    setHistoryPage(1)
  }

  const atRiskCount = rows.filter((r) => r.status === 'expiring' || r.status === 'expired' || r.status === 'missing').length

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <FileSignature className="h-6 w-6 text-safemeds-teal" />
            <h1 className="text-3xl font-display font-bold text-foreground">SDEA Repository</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Safety Data Exchange Agreements — an expiring or missing SDEA flags that distributor relationship as at-risk for reconciliation.</p>
        </div>
        {canManage && (
          <button onClick={() => setShowNew(true)} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce">
            New / Renew SDEA
          </button>
        )}
      </div>

      {atRiskCount > 0 && (
        <div className="rounded-lg border border-status-warning bg-status-warning/10 p-4 text-sm text-status-warning flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          {atRiskCount} distributor{atRiskCount === 1 ? '' : 's'} at risk — missing, expiring, or expired SDEA.
        </div>
      )}

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <FileSignature className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No distributors listed yet — add one from Reconciliation first.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">Distributor</th>
                <th className="p-3">SDEA Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.distributor.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium text-foreground">{r.distributor.name}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DISTRIBUTOR_STATUS_STYLES[r.status]}`}>{DISTRIBUTOR_STATUS_LABELS[r.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Version History</h2>
        {!historyLoading && history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No SDEA versions yet.</p>
        ) : (
          <DataTableV2<Sdea>
            data={history}
            columns={SDEA_HISTORY_COLUMNS}
            searchable={false}
            exportable={false}
            showDensityToggle={false}
            loading={historyLoading}
            page={historyPage}
            totalPages={historyTotalPages}
            totalCount={historyTotal}
            onPageChange={setHistoryPage}
            rowsPerPage={historyLimit}
            onRowsPerPageChange={handleHistoryRowsPerPageChange}
          />
        )}
      </div>

      {showNew && (
        <NewSdeaModal
          distributors={rows.map((r) => r.distributor)}
          onClose={() => setShowNew(false)}
          onDone={() => {
            setShowNew(false)
            setNotice('SDEA activated.')
            load()
            setHistoryPage(1)
            loadHistory(1, historyLimit)
          }}
        />
      )}
    </div>
  )
}

function NewSdeaModal({ distributors, onClose, onDone }: { distributors: Distributor[]; onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState<'details' | 'upload'>('details')
  const [distributorId, setDistributorId] = useState('')
  const [title, setTitle] = useState('')
  const [counterpartyName, setCounterpartyName] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [draftId, setDraftId] = useState<string | null>(null)
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const detailsValid = distributorId && title.trim().length > 0 && counterpartyName.trim().length > 0

  const handleCreateDraft = async () => {
    if (!detailsValid) return
    setSubmitting(true)
    setError(null)
    try {
      const draft = await createSdea({ distributorId, title: title.trim(), counterpartyName: counterpartyName.trim(), expiryDate: expiryDate || undefined })
      setDraftId(draft.id)
      setStep('upload')
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this SDEA draft.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleFileSelected = async (file: File) => {
    if (!draftId) return
    setUploading(true)
    setError(null)
    try {
      const version = await uploadDocument('sdea', draftId, file, { title: 'Signed SDEA' })
      await attachSdeaDocument(draftId, version.documentId)
      setDocumentId(version.documentId)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not upload this document.'))
    } finally {
      setUploading(false)
    }
  }

  const handleActivate = async () => {
    if (!draftId) return
    setSubmitting(true)
    setError(null)
    try {
      await activateSdea(draftId)
      onDone()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not activate this SDEA.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">New / Renew SDEA</h2>

        {step === 'details' ? (
          <>
            <div>
              <label className={labelClass}>Distributor *</label>
              <select value={distributorId} onChange={(e) => setDistributorId(e.target.value)} className={inputClass}>
                <option value="">Select…</option>
                {distributors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Meridian SDEA" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Counterparty Name *</label>
              <input value={counterpartyName} onChange={(e) => setCounterpartyName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Expiry Date</label>
              <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className={inputClass} />
            </div>

            {error && <p className="text-sm text-status-error">{error}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
                Cancel
              </button>
              <button
                onClick={handleCreateDraft}
                disabled={!detailsValid || submitting}
                className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Next
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Upload the signed agreement, then activate it.</p>
            {documentId ? (
              <p className="text-sm text-status-success">Document attached.</p>
            ) : (
              <label className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground cursor-pointer hover:bg-muted">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload signed SDEA
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileSelected(file)
                  }}
                />
              </label>
            )}

            {error && <p className="text-sm text-status-error">{error}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
                Cancel
              </button>
              <button
                onClick={handleActivate}
                disabled={!documentId || submitting}
                title={!documentId ? 'Upload the signed document first' : undefined}
                className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-40"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Activate
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
