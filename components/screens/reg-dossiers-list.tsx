'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FolderOpen, Plus, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { listRegDossiers, type RegDossier } from '@/lib/api/reg-dossiers'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'
import { NewDossierModal } from '@/components/reg-dossiers/new-dossier-modal'

const STATUS_STYLES: Record<string, string> = {
  planning: 'bg-status-info/10 text-status-info',
  compiling: 'bg-status-warning/10 text-status-warning',
  completeness_check: 'bg-status-success/10 text-status-success',
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString()
}

/**
 * RegCloud (Phase 12) Stages 1–3 — the dossier list, mirroring
 * `PvCasesList`'s own established shape (a plain `DataTableV2` over a
 * paginated list, a "New" button opening a creation flow, an empty
 * state with a call to action). One record type carries all three
 * stages' own UI, exactly like `RegDossierService.get()`'s response
 * does on the backend — see the detail screen for the classification/
 * completeness/workflow sections.
 */
export function RegDossiersList() {
  const router = useRouter()
  const { hasAny } = usePermissions()
  const canView = hasAny('regulatory.view_all', 'records.view_all')

  const [dossiers, setDossiers] = useState<RegDossier[]>([])
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
    listRegDossiers({ page, limit })
      .then(({ rows, meta }) => {
        setDossiers(rows)
        setTotalPages(meta.totalPages)
        setTotal(meta.total)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load dossiers.')))
      .finally(() => setLoading(false))
  }

  useEffect(load, [page, canView]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">Regulatory Dossiers</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to view regulatory dossiers. Contact your System Administrator.</p>
        </div>
      </div>
    )
  }

  const columns: DataTableColumn<RegDossier>[] = [
    { key: 'productClass', label: 'Product Class', render: (v) => <span className="font-mono text-sm text-foreground">{v as string}</span> },
    { key: 'route', label: 'Route' },
    {
      key: 'status',
      label: 'Status',
      render: (v) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLES[v as string] ?? 'bg-muted text-muted-foreground'}`}>
          {statusLabel(v as string)}
        </span>
      ),
    },
    { key: 'createdAt', label: 'Started', render: (v) => formatDate(v as string) },
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Regulatory Dossiers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} {total === 1 ? 'dossier' : 'dossiers'} · classification, compilation, and the completeness gate
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors"
        >
          <Plus className="h-4 w-4" />
          Start New Dossier
        </button>
      </div>

      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error}</div>}

      <DataTableV2
        data={dossiers}
        columns={columns}
        onRowClick={(row) => router.push(`/reg-dossiers/${row.id}`)}
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

      {!loading && dossiers.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No dossiers yet.</p>
          <button onClick={() => setShowNew(true)} className="mt-3 text-sm font-medium text-safemeds-teal hover:underline">
            Start your first dossier
          </button>
        </div>
      )}

      {showNew && (
        <NewDossierModal
          onClose={() => setShowNew(false)}
          onCreated={(dossierId) => {
            setShowNew(false)
            router.push(`/reg-dossiers/${dossierId}`)
          }}
        />
      )}
    </div>
  )
}
