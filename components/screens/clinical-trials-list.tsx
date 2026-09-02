'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FlaskConical, Plus, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { ClinicalTrial, listClinicalTrials, TRIAL_STATUS_LABELS } from '@/lib/api/clinical-trials'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-status-success/10 text-status-success',
  completed: 'bg-status-info/10 text-status-info',
  terminated: 'bg-muted text-muted-foreground',
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString()
}

/**
 * VigiCloud Stage 14 — the trial-level dashboard the build spec's own
 * checklist asks for ("open SAEs, upcoming annual renewal"): both are
 * columns here rather than a separate widget, since the list itself
 * already carries a row per trial. `openSaeCaseCount`/`annualRenewalDueAt`
 * come straight off `GET /pv/clinical-trials`'s own summary fields —
 * never recomputed client-side.
 */
export function ClinicalTrialsList() {
  const router = useRouter()
  const { has, hasAny } = usePermissions()
  const canView = hasAny('pv.capture_case', 'pv.view_all', 'pv.manage_clinical_trials')
  const canCreate = has('pv.manage_clinical_trials')

  const [trials, setTrials] = useState<ClinicalTrial[]>([])
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!canView) return
    setPage(1)
  }, [search, canView])

  useEffect(() => {
    if (!canView) return
    let cancelled = false
    setLoading(true)
    setError(null)

    listClinicalTrials({ page, limit, q: search.trim() || undefined })
      .then(({ trials: rows, meta }) => {
        if (cancelled) return
        setTrials(rows)
        setTotalPages(meta.totalPages)
        setTotal(meta.total)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load clinical trials.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [page, limit, search, canView])

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">Clinical Trials</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to view clinical trials. Contact your System Administrator.</p>
        </div>
      </div>
    )
  }

  const columns: DataTableColumn<ClinicalTrial>[] = [
    { key: 'trialReference', label: 'Reference', render: (v) => <span className="font-medium text-foreground font-mono text-sm">{v as string}</span> },
    { key: 'trialName', label: 'Trial' },
    { key: 'sponsor', label: 'Sponsor', render: (v) => (v as string) || '—' },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLES[v as string] ?? 'bg-muted text-muted-foreground'}`}>{TRIAL_STATUS_LABELS[v as keyof typeof TRIAL_STATUS_LABELS] ?? (v as string)}</span>,
    },
    {
      key: 'openSaeCaseCount',
      label: 'Open SAEs',
      render: (v) => (
        <span className={`text-sm font-medium ${(v as number) > 0 ? 'text-status-warning' : 'text-muted-foreground'}`}>{v as number}</span>
      ),
    },
    { key: 'subjectCount', label: 'Subjects' },
    { key: 'annualRenewalDueAt', label: 'Annual Renewal Due', render: (v) => formatDate(v as string) },
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Clinical Trials</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} {total === 1 ? 'trial' : 'trials'} · solicited SAE reporting, subject enrollment, and treatment-arm unblinding
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => router.push('/clinical-trials/new')}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Trial
          </button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Search reference or trial name</label>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="e.g. NCT-0001"
          className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground sm:max-w-sm"
        />
      </div>

      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error}</div>}

      <DataTableV2
        data={trials}
        columns={columns}
        onRowClick={(row) => router.push(`/clinical-trials/${row.id}`)}
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

      {!loading && trials.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <FlaskConical className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{search ? 'No trials match this search.' : 'No clinical trials set up yet.'}</p>
          {canCreate && !search && (
            <button onClick={() => router.push('/clinical-trials/new')} className="mt-3 text-sm font-medium text-safemeds-teal hover:underline">
              Set up your first trial
            </button>
          )}
        </div>
      )}
    </div>
  )
}
