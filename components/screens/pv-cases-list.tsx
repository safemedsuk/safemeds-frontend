'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ShieldAlert, Stethoscope } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { PvCase, listPvCases } from '@/lib/api/pv-cases'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

const STATUS_STYLES: Record<string, string> = {
  intake: 'bg-status-info/10 text-status-info',
  triage: 'bg-status-warning/10 text-status-warning',
  medical_review: 'bg-status-warning/10 text-status-warning',
  coding: 'bg-status-warning/10 text-status-warning',
  narrative: 'bg-status-warning/10 text-status-warning',
  quality_check: 'bg-status-warning/10 text-status-warning',
  submission_ready: 'bg-status-info/10 text-status-info',
  submitted: 'bg-status-success/10 text-status-success',
  closed_archived: 'bg-muted text-muted-foreground',
}

const STATUS_LABEL_KEYS: Record<string, MessageKey> = {
  intake: 'pvCases.list.statusIntake',
  triage: 'pvCases.list.statusTriage',
  medical_review: 'pvCases.list.statusMedicalReview',
  coding: 'pvCases.list.statusCoding',
  narrative: 'pvCases.list.statusNarrative',
  quality_check: 'pvCases.list.statusQualityCheck',
  submission_ready: 'pvCases.list.statusSubmissionReady',
  submitted: 'pvCases.list.statusSubmitted',
  closed_archived: 'pvCases.list.statusClosedArchived',
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString()
}

export function PvCasesList() {
  const { t } = useTranslation()
  const router = useRouter()
  const { has, hasAny } = usePermissions()
  const canView = hasAny('pv.capture_case', 'pv.view_all', 'records.view_all')
  const canCreate = has('pv.capture_case')

  const [cases, setCases] = useState<PvCase[]>([])
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!canView) return
    setPage(1)
  }, [search, statusFilter, canView])

  useEffect(() => {
    if (!canView) return
    let cancelled = false
    setLoading(true)
    setError(null)

    listPvCases({ page, limit, search: search.trim() || undefined, status: statusFilter === 'all' ? undefined : statusFilter })
      .then(({ cases: rows, meta }) => {
        if (cancelled) return
        setCases(rows)
        setTotalPages(meta.totalPages)
        setTotal(meta.total)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, t('pvCases.list.errorLoad')))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [page, limit, search, statusFilter, canView])

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">{t('pvCases.list.title')}</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{t('pvCases.list.noPermission')}</p>
        </div>
      </div>
    )
  }

  const columns: DataTableColumn<PvCase>[] = [
    {
      key: 'referenceNumber',
      label: t('pvCases.list.columnReference'),
      render: (v) => <span className="font-medium text-foreground font-mono text-sm">{v as string}</span>,
    },
    { key: 'channel', label: t('pvCases.list.columnChannel'), render: (v) => (v as string).replace(/_/g, ' ') },
    {
      key: 'status',
      label: t('pvCases.list.columnStatus'),
      render: (v) => {
        const key = v as string
        const labelKey = STATUS_LABEL_KEYS[key]
        return (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLES[key] ?? 'bg-muted text-muted-foreground'}`}>
            {labelKey ? t(labelKey) : key}
          </span>
        )
      },
    },
    { key: 'awarenessDate', label: t('pvCases.list.columnAwarenessDate'), render: (v) => formatDate(v as string) },
    { key: 'receivedDate', label: t('pvCases.list.columnReceived'), render: (v) => formatDate(v as string) },
    { key: 'createdAt', label: t('pvCases.list.columnCreated'), render: (v) => formatDate(v as string) },
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">{t('pvCases.list.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total === 1 ? t('pvCases.list.subtitleOne') : t('pvCases.list.subtitleMany', { count: total })}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => router.push('/pv-cases/new')}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t('pvCases.list.newCase')}
          </button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('pvCases.list.searchReferenceLabel')}</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. PV-2026-00042"
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('pvCases.list.workflowStatus')}</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="all">{t('pvCases.list.allStatuses')}</option>
              <option value="intake">{t('pvCases.list.statusIntake')}</option>
              <option value="triage">{t('pvCases.list.statusTriage')}</option>
              <option value="medical_review">{t('pvCases.list.statusMedicalReview')}</option>
              <option value="coding">{t('pvCases.list.statusCoding')}</option>
              <option value="narrative">{t('pvCases.list.statusNarrative')}</option>
              <option value="quality_check">{t('pvCases.list.statusQualityCheck')}</option>
              <option value="submission_ready">{t('pvCases.list.statusSubmissionReady')}</option>
              <option value="submitted">{t('pvCases.list.statusSubmitted')}</option>
              <option value="closed_archived">{t('pvCases.list.statusClosedArchived')}</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error}</div>}

      <DataTableV2
        data={cases}
        columns={columns}
        onRowClick={(row) => router.push(`/pv-cases/${row.id}`)}
        searchable={false}
        exportable={false}
        showDensityToggle={false}
        loading={loading}
        page={page}
        totalPages={totalPages}
        totalCount={total}
        onPageChange={setPage}
        rowsPerPage={limit}
      />

      {!loading && cases.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Stethoscope className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            {search || statusFilter !== 'all' ? t('pvCases.list.noMatchFilters') : t('pvCases.list.noCasesYet')}
          </p>
          {canCreate && !search && statusFilter === 'all' && (
            <button onClick={() => router.push('/pv-cases/new')} className="mt-3 text-sm font-medium text-safemeds-teal hover:underline">
              {t('pvCases.list.captureFirstCase')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
