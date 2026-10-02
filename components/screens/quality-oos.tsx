'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FlaskConical, Info, Loader2, Plus, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { Oos, createOos, listOos } from '@/lib/api/oos'
import { listBatches } from '@/lib/api/master-data'
import { listSpecifications, Specification } from '@/lib/api/quality'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const STATUS_LABELS: Record<string, string> = {
  phase_1_lab_investigation: 'Phase 1 — Lab Investigation',
  phase_2_manufacturing_investigation: 'Phase 2 — Manufacturing Investigation',
  closed: 'Closed',
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

/**
 * QualCloud (Phase 13) Stage 6 — Out-of-Specification (OOS)/Out-of-Trend
 * (OOT) Investigation: the real two-phase FDA/Barr Labs model. Cannot
 * close from Phase 1 without a documented assignable lab cause —
 * enforced server-side, surfaced here plainly.
 */
export function QualityOosScreen() {
  const router = useRouter()
  const { has } = usePermissions()
  const canViewAll = has('quality.view_all')
  const canLog = has('quality.log_deviation')

  const [records, setRecords] = useState<Oos[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showCreate, setShowCreate] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listOos({ page: 1, limit: 50, status: statusFilter || undefined })
      .then((res) => setRecords(res.rows))
      .catch((err) => setError(getErrorMessage(err, 'Could not load OOS investigations.')))
      .finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(load, [load])

  if (!canViewAll) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">OOS/OOT Investigations</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to view OOS investigations. Contact your System Administrator.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">OOS/OOT Investigations</h1>
          <p className="mt-1 text-sm text-muted-foreground">The real two-phase FDA framework: lab investigation, then manufacturing investigation if no assignable cause is found.</p>
        </div>
        {canLog && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors">
            <Plus className="h-4 w-4" /> Log OOS
          </button>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 p-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-info" />
        <p>An OOS cannot close from Phase 1 without a documented assignable lab cause — this is the concrete control against &quot;testing into compliance.&quot;</p>
      </div>

      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputClass} w-auto`}>
        <option value="">All statuses</option>
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <FlaskConical className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No OOS investigations yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">OOS #</th>
                <th className="p-3">Test Result</th>
                <th className="p-3">Logged</th>
                <th className="p-3">Phase</th>
              </tr>
            </thead>
            <tbody>
              {records.map((o) => (
                <tr key={o.id} onClick={() => router.push(`/quality-oos/${o.id}`)} className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50">
                  <td className="p-3 text-foreground font-mono text-xs">{o.oosNumber}</td>
                  <td className="p-3 text-foreground">{o.testResult}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(o.createdAt)}</td>
                  <td className="p-3">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">{STATUS_LABELS[o.status] ?? o.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateOosModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false)
            setNotice('OOS investigation logged.')
            load()
            router.push(`/quality-oos/${id}`)
          }}
        />
      )}
    </div>
  )
}

function CreateOosModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [batchId, setBatchId] = useState('')
  const [specificationId, setSpecificationId] = useState('')
  const [testResult, setTestResult] = useState('')
  const [batches, setBatches] = useState<{ id: string; batchNumber: string }[]>([])
  const [specifications, setSpecifications] = useState<Specification[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listBatches({ limit: 100 })
      .then((res) => setBatches(res.rows.map((b) => ({ id: b.id, batchNumber: b.batchNumber }))))
      .catch(() => setBatches([]))
    listSpecifications({ limit: 100 })
      .then((res) => setSpecifications(res.rows))
      .catch(() => setSpecifications([]))
  }, [])

  const selectedSpec = specifications.find((s) => s.id === specificationId)
  const [parameterId, setParameterId] = useState('')

  const isValid = batchId.length > 0 && specificationId.length > 0 && parameterId.length > 0 && testResult.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      const created = await createOos({ batchId, specificationId, parameterId, testResult: testResult.trim() })
      onCreated(created.id)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not log this OOS investigation.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 space-y-4 my-8">
        <h2 className="font-display font-bold text-lg text-foreground">Log an OOS Result</h2>

        <div>
          <label className={labelClass}>Batch *</label>
          <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className={inputClass}>
            <option value="">Select a batch</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.batchNumber}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Specification *</label>
          <select value={specificationId} onChange={(e) => { setSpecificationId(e.target.value); setParameterId('') }} className={inputClass}>
            <option value="">Select a specification</option>
            {specifications.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>

        {selectedSpec && (
          <div>
            <label className={labelClass}>Parameter *</label>
            <select value={parameterId} onChange={(e) => setParameterId(e.target.value)} className={inputClass}>
              <option value="">Select a parameter</option>
              {selectedSpec.parameters.map((p) => (
                <option key={p.id} value={p.id}>{p.parameterName} {p.lowerLimit && p.upperLimit ? `(${p.lowerLimit}–${p.upperLimit}${p.unit ? ` ${p.unit}` : ''})` : ''}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelClass}>Test Result *</label>
          <input value={testResult} onChange={(e) => setTestResult(e.target.value)} placeholder="e.g. 98.2% assay" className={inputClass} />
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
            Log OOS
          </button>
        </div>
      </div>
    </div>
  )
}
