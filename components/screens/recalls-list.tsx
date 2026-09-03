'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Plus, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { listRecalls, RECALL_STATUS_LABELS, type Recall } from '@/lib/api/recalls'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'
import { NewRecallModal } from '@/components/recalls/new-recall-modal'

const STATUS_STYLES: Record<string, string> = {
  reported: 'bg-status-warning/10 text-status-warning',
  investigating: 'bg-status-warning/10 text-status-warning',
  notified_to_authority: 'bg-status-info/10 text-status-info',
  in_progress: 'bg-status-info/10 text-status-info',
  closed: 'bg-status-success/10 text-status-success',
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
export function RecallsList() {
  const router = useRouter()
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

  const load = () => {
    if (!canView) return
    setLoading(true)
    setError(null)
    listRecalls({ page, limit })
      .then(({ rows, meta }) => {
        setRecalls(rows)
        setTotalPages(meta.totalPages)
        setTotal(meta.total)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load recalls.')))
      .finally(() => setLoading(false))
  }

  useEffect(load, [page, canView]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">Recalls</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to view recalls. Contact your System Administrator.</p>
        </div>
      </div>
    )
  }

  const columns: DataTableColumn<Recall>[] = [
    { key: 'product', label: 'Product', render: (v) => (v as { brandName: string }).brandName },
    { key: 'reason', label: 'Reason', render: (v) => <span className="line-clamp-1 max-w-md text-sm text-foreground">{v as string}</span> },
    { key: 'recallClass', label: 'Class', render: (v) => (v as string | null) ?? '—' },
    {
      key: 'status',
      label: 'Status',
      render: (v) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLES[v as string] ?? 'bg-muted text-muted-foreground'}`}>
          {RECALL_STATUS_LABELS[v as string] ?? (v as string)}
        </span>
      ),
    },
    { key: 'createdAt', label: 'Reported', render: (v) => formatDate(v as string) },
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Recalls</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} {total === 1 ? 'recall' : 'recalls'} · reported through to a signed closure
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors"
        >
          <Plus className="h-4 w-4" />
          Report a Recall
        </button>
      </div>

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
          <p className="text-sm text-muted-foreground">No recalls reported yet.</p>
          <button onClick={() => setShowNew(true)} className="mt-3 text-sm font-medium text-safemeds-teal hover:underline">
            Report your first recall
          </button>
        </div>
      )}

      {showNew && (
        <NewRecallModal
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
