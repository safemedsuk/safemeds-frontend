'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Plus, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { listRecalls, type Recall } from '@/lib/api/recalls'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'
import { NewRecallModal } from '@/components/recalls/new-recall-modal'
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  under_assessment: 'bg-status-warning/10 text-status-warning',
  approved: 'bg-status-info/10 text-status-info',
  notification: 'bg-status-info/10 text-status-info',
  execution: 'bg-status-info/10 text-status-info',
  reconciliation: 'bg-status-info/10 text-status-info',
  closure_pending: 'bg-status-warning/10 text-status-warning',
  closed: 'bg-status-success/10 text-status-success',
  cancelled: 'bg-status-error/10 text-status-error',
}

const STATUS_LABEL_KEYS: Record<string, MessageKey> = {
  draft: 'recallsList.statusDraft',
  under_assessment: 'recallsList.statusUnderAssessment',
  approved: 'recallsList.statusApproved',
  notification: 'recallsList.statusNotification',
  execution: 'recallsList.statusExecution',
  reconciliation: 'recallsList.statusReconciliation',
  closure_pending: 'recallsList.statusClosurePending',
  closed: 'recallsList.statusClosed',
  cancelled: 'recallsList.statusCancelled',
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString()
}

/**
 * RegCloud (Phase 12) Stage 14 — Post-Market & Recall (cross-module).
 * A genuine top-level list, matching the precedent set by Regulatory
 * Dossiers/Reconciliation — a recall is significant enough to warrant
 * its own direct discoverability, not buried inside Master Data the way
 * Stage 13's deliberately lighter-weight promotional-material record is.
 */
/**
 * `mode` fixes this screen to one drill state without a user-facing
 * toggle — used by the dedicated `/mock-recalls` route (10.7 — "reuses
 * the Recall Cases list/detail screens with `mode: mock` filtering
 * rather than a parallel screen family"). The default `/recalls` route
 * still shows a real/drill toggle so both stay reachable from there too.
 */
export function RecallsList({ mode: fixedMode }: { mode?: 'mock' } = {}) {
  const router = useRouter()
  const { t } = useTranslation()
  const { hasAny } = usePermissions()
  const canView = hasAny('regulatory.view_all', 'records.view_all')

  const [recalls, setRecalls] = useState<Recall[]>([])
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [modeFilter, setModeFilter] = useState<'all' | 'real' | 'mock'>(fixedMode ?? 'all')

  const load = () => {
    if (!canView) return
    setLoading(true)
    setError(null)
    listRecalls({ page, limit, mode: modeFilter === 'all' ? undefined : modeFilter })
      .then(({ rows, meta }) => {
        setRecalls(rows)
        setTotalPages(meta.totalPages)
        setTotal(meta.total)
      })
      .catch((err) => setError(getErrorMessage(err, t('recallsList.errorLoad'))))
      .finally(() => setLoading(false))
  }

  useEffect(load, [page, canView, modeFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">{t('recallsList.title')}</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{t('recallsList.noPermission')}</p>
        </div>
      </div>
    )
  }

  const columns: DataTableColumn<Recall>[] = [
    {
      key: 'ref',
      label: t('recallsList.columnRef'),
      render: (v, row) => (
        <span className="flex items-center gap-1.5 font-mono text-xs text-foreground">
          {(v as string | null) ?? '—'}
          {row.mode === 'mock' && <span className="rounded-full bg-status-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-status-warning">{t('recallsList.drillBadge')}</span>}
        </span>
      ),
    },
    { key: 'product', label: t('recallsList.columnProduct'), render: (v) => (v as { brandName: string }).brandName },
    { key: 'reason', label: t('recallsList.columnReason'), render: (v) => <span className="line-clamp-1 max-w-md text-sm text-foreground">{v as string}</span> },
    { key: 'recallClass', label: t('recallsList.columnClass'), render: (v) => (v as string | null) ?? '—' },
    {
      key: 'status',
      label: t('recallsList.columnStatus'),
      render: (v) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLES[v as string] ?? 'bg-muted text-muted-foreground'}`}>
          {STATUS_LABEL_KEYS[v as string] ? t(STATUS_LABEL_KEYS[v as string]) : (v as string)}
        </span>
      ),
    },
    { key: 'createdAt', label: t('recallsList.columnReported'), render: (v) => formatDate(v as string) },
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">{fixedMode === 'mock' ? t('recallsList.titleMock') : t('recallsList.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} {total === 1 ? t('recallsList.countRecall') : t('recallsList.countRecalls')} ·{' '}
            {fixedMode === 'mock' ? t('recallsList.subtitleMock') : t('recallsList.subtitleReal')}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors"
        >
          <Plus className="h-4 w-4" />
          {fixedMode === 'mock' ? t('recallsList.scheduleDrill') : t('recallsList.reportRecall')}
        </button>
      </div>

      {!fixedMode && (
        <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1 w-fit">
          {(['all', 'real', 'mock'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setModeFilter(m)
                setPage(1)
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                modeFilter === m ? 'bg-safemeds-teal text-white' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m === 'all' ? t('recallsList.filterAll') : m === 'real' ? t('recallsList.filterReal') : t('recallsList.filterDrills')}
            </button>
          ))}
        </div>
      )}

      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error}</div>}

      <DataTableV2
        data={recalls}
        columns={columns}
        onRowClick={(row) => router.push(`/recalls/${row.id}`)}
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

      {!loading && recalls.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{t('recallsList.noRecallsYet')}</p>
          <button onClick={() => setShowNew(true)} className="mt-3 text-sm font-medium text-safemeds-teal hover:underline">
            {t('recallsList.reportFirstRecall')}
          </button>
        </div>
      )}

      {showNew && (
        <NewRecallModal
          defaultMode={fixedMode ?? (modeFilter === 'mock' ? 'mock' : 'real')}
          onClose={() => setShowNew(false)}
          onCreated={(recallId) => {
            setShowNew(false)
            router.push(`/recalls/${recallId}`)
          }}
        />
      )}
    </div>
  )
}
