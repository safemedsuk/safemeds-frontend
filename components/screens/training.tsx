'use client'

import { useCallback, useEffect, useState } from 'react'
import { GraduationCap, Loader2, ShieldAlert, Upload } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { uploadDocument } from '@/lib/api/documents'
import { attachTrainingCertificate, createTrainingRecord, listTrainingRecords, TRAINING_STATUS_LABELS, TrainingRecord, TrainingRecordComputedStatus } from '@/lib/api/training'
import { listTrainingTypes, type TrainingType } from '@/lib/api/training-types'
import { listUsers, TenantUser } from '@/lib/api/users'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const STATUS_STYLES: Record<string, string> = {
  valid: 'bg-status-success/10 text-status-success',
  expiring: 'bg-status-warning/10 text-status-warning',
  expired: 'bg-status-error/10 text-status-error',
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

function trainingColumns(
  nameFor: (userId: string) => string,
  canManage: boolean,
  uploadingFor: string | null,
  onUpload: (recordId: string, file: File) => void,
): DataTableColumn<TrainingRecord>[] {
  return [
    { key: 'userId', label: 'Staff', render: (v) => nameFor(v) },
    {
      key: 'title',
      label: 'Training',
      render: (v, row) => (
        <>
          {v}
          <span className="ml-2 text-xs text-muted-foreground">({row.trainingType})</span>
        </>
      ),
    },
    { key: 'completionDate', label: 'Completed', sortable: true, render: (v) => formatDate(v) },
    { key: 'expiryDate', label: 'Expires', sortable: true, render: (v) => formatDate(v) },
    {
      key: 'computedStatus',
      label: 'Status',
      render: (v) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[v as TrainingRecordComputedStatus]}`}>{TRAINING_STATUS_LABELS[v as TrainingRecordComputedStatus]}</span>,
    },
    {
      key: 'certificateDocumentId',
      label: 'Certificate',
      render: (v, row) =>
        v ? (
          <span className="text-xs text-status-success">Attached</span>
        ) : canManage ? (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
            {uploadingFor === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onUpload(row.id, file)
              }}
            />
          </label>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
  ]
}

/**
 * VigiCloud Stage 16.6 — the training matrix, with an upload slot and
 * overdue/expiring flags computed live server-side. Special Corner
 * SC-5: real server-side pagination — the staff name is now shown on
 * every row rather than only the first row of a visual per-staff group
 * (the original grouped-header trick assumed the full record list was
 * always in memory; it cannot be preserved correctly across arbitrary
 * page boundaries without a materially more complex backend query, so
 * this is a deliberate simplification, not a regression).
 */
export function TrainingScreen() {
  const { has, hasAny } = usePermissions()
  const canManage = has('training.manage')
  const canView = hasAny('training.view', 'training.manage')

  const [records, setRecords] = useState<TrainingRecord[]>([])
  const [users, setUsers] = useState<TenantUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showLog, setShowLog] = useState(false)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([listTrainingRecords(page, limit, query), listUsers({ limit: 100 })])
      .then(([r, u]) => {
        setRecords(r.records)
        setTotalPages(r.meta.totalPages)
        setTotal(r.meta.total)
        setUsers(u.users)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load training records.')))
      .finally(() => setLoading(false))
  }, [page, limit, query])

  useEffect(() => {
    if (!canView) return
    load()
  }, [load, canView])

  const handleRowsPerPageChange = (n: number) => {
    setLimit(n)
    setPage(1)
  }

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">Training</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to view training records. Contact your System Administrator.</p>
        </div>
      </div>
    )
  }

  const nameFor = (userId: string) => users.find((u) => u.id === userId)?.fullName ?? userId

  const handleUploadCertificate = async (recordId: string, file: File) => {
    setUploadingFor(recordId)
    setError(null)
    try {
      const version = await uploadDocument('training_record', recordId, file, { title: 'Training certificate' })
      await attachTrainingCertificate(recordId, version.documentId)
      setNotice('Certificate attached.')
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not upload this certificate.'))
    } finally {
      setUploadingFor(null)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <GraduationCap className="h-6 w-6 text-safemeds-teal" />
            <h1 className="text-3xl font-display font-bold text-foreground">Training</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">GVP certification and staff training records.</p>
        </div>
        {canManage && (
          <button onClick={() => setShowLog(true)} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce">
            Log Training
          </button>
        )}
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      {!loading && records.length === 0 && !query.trim() ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No training records logged yet.</p>
        </div>
      ) : (
        <DataTableV2<TrainingRecord>
          data={records}
          columns={trainingColumns(nameFor, canManage, uploadingFor, handleUploadCertificate)}
          exportable={false}
          showDensityToggle={false}
          loading={loading}
          page={page}
          totalPages={totalPages}
          totalCount={total}
          onPageChange={setPage}
          onSearchChange={(q) => {
            setPage(1)
            setQuery(q)
          }}
          rowsPerPage={limit}
          onRowsPerPageChange={handleRowsPerPageChange}
        />
      )}

      {showLog && (
        <LogTrainingModal
          users={users}
          onClose={() => setShowLog(false)}
          onLogged={() => {
            setShowLog(false)
            setNotice('Training logged.')
            setPage(1)
            load()
          }}
        />
      )}
    </div>
  )
}

function LogTrainingModal({ users, onClose, onLogged }: { users: TenantUser[]; onClose: () => void; onLogged: () => void }) {
  const [userId, setUserId] = useState('')
  const [trainingType, setTrainingType] = useState('')
  const [trainingTypes, setTrainingTypes] = useState<TrainingType[]>([])
  const [title, setTitle] = useState('')
  const [completionDate, setCompletionDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listTrainingTypes()
      .then((rows) => {
        setTrainingTypes(rows)
        if (rows.length > 0) setTrainingType(rows[0].typeKey)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load training types.')))
  }, [])

  const isValid = userId && trainingType && title.trim().length > 0 && completionDate.length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await createTrainingRecord({ userId, trainingType, title: title.trim(), completionDate, expiryDate: expiryDate || undefined })
      onLogged()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not log this training record.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">Log Training</h2>

        <div>
          <label className={labelClass}>Staff Member *</label>
          <select value={userId} onChange={(e) => setUserId(e.target.value)} className={inputClass}>
            <option value="">Select…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} ({u.email})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Training Type</label>
          <select value={trainingType} onChange={(e) => setTrainingType(e.target.value)} className={inputClass}>
            {trainingTypes.length === 0 && <option value="">Loading…</option>}
            {trainingTypes.map((t) => (
              <option key={t.id} value={t.typeKey}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. GVP Refresher 2026" className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Completion Date *</label>
            <input type="date" value={completionDate} onChange={(e) => setCompletionDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Expiry Date</label>
            <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className={inputClass} />
          </div>
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
            Log
          </button>
        </div>
      </div>
    </div>
  )
}
