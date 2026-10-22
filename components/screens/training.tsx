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
import { useTranslation } from '@/lib/i18n/use-translation'

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
  t: (key: import('@/lib/i18n/messages/en').MessageKey, params?: Record<string, string | number>) => string,
): DataTableColumn<TrainingRecord>[] {
  return [
    { key: 'userId', label: t('training.columnStaff'), render: (v) => nameFor(v) },
    {
      key: 'title',
      label: t('training.columnTraining'),
      render: (v, row) => (
        <>
          {v}
          <span className="ml-2 text-xs text-muted-foreground">({row.trainingType})</span>
        </>
      ),
    },
    { key: 'completionDate', label: t('training.columnCompleted'), sortable: true, render: (v) => formatDate(v) },
    { key: 'expiryDate', label: t('training.columnExpires'), sortable: true, render: (v) => formatDate(v) },
    {
      key: 'computedStatus',
      label: t('training.columnStatus'),
      render: (v) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[v as TrainingRecordComputedStatus]}`}>{TRAINING_STATUS_LABELS[v as TrainingRecordComputedStatus]}</span>,
    },
    {
      key: 'certificateDocumentId',
      label: t('training.columnCertificate'),
      render: (v, row) =>
        v ? (
          <span className="text-xs text-status-success">{t('training.attached')}</span>
        ) : canManage ? (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
            {uploadingFor === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {t('training.upload')}
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
  const { t } = useTranslation()
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
      .catch((err) => setError(getErrorMessage(err, t('training.errorLoad'))))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <h1 className="text-3xl font-display font-bold text-foreground">{t('training.title')}</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{t('training.noPermission')}</p>
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
      setNotice(t('training.certificateAttached'))
      load()
    } catch (err) {
      setError(getErrorMessage(err, t('training.errorUploadCertificate')))
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
            <h1 className="text-3xl font-display font-bold text-foreground">{t('training.title')}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t('training.subtitle')}</p>
        </div>
        {canManage && (
          <button onClick={() => setShowLog(true)} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce">
            {t('training.logTraining')}
          </button>
        )}
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      {!loading && records.length === 0 && !query.trim() ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{t('training.noRecordsYet')}</p>
        </div>
      ) : (
        <DataTableV2<TrainingRecord>
          data={records}
          columns={trainingColumns(nameFor, canManage, uploadingFor, handleUploadCertificate, t)}
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
            setNotice(t('training.trainingLogged'))
            setPage(1)
            load()
          }}
        />
      )}
    </div>
  )
}

function LogTrainingModal({ users, onClose, onLogged }: { users: TenantUser[]; onClose: () => void; onLogged: () => void }) {
  const { t } = useTranslation()
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
      .catch((err) => setError(getErrorMessage(err, t('training.errorLoadTrainingTypes'))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setError(getErrorMessage(err, t('training.errorLogRecord')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">{t('training.logTrainingModalTitle')}</h2>

        <div>
          <label className={labelClass}>{t('training.staffMember')}</label>
          <select value={userId} onChange={(e) => setUserId(e.target.value)} className={inputClass}>
            <option value="">{t('training.select')}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} ({u.email})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t('training.trainingType')}</label>
          <select value={trainingType} onChange={(e) => setTrainingType(e.target.value)} className={inputClass}>
            {trainingTypes.length === 0 && <option value="">{t('training.loading')}</option>}
            {trainingTypes.map((tt) => (
              <option key={tt.id} value={tt.typeKey}>
                {tt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t('training.titleField')}</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('training.titlePlaceholder')} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>{t('training.completionDate')}</label>
            <input type="date" value={completionDate} onChange={(e) => setCompletionDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t('training.expiryDate')}</label>
            <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className={inputClass} />
          </div>
        </div>

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('training.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('training.log')}
          </button>
        </div>
      </div>
    </div>
  )
}
