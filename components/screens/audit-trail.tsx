'use client'

import { useEffect, useMemo, useState } from 'react'
import { Filter, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { AuditEntry, getAuditEntries } from '@/lib/api/audit'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { Modal } from '@/components/ui/modal'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'

const ACTION_COLORS: Record<string, string> = {
  login: 'bg-status-info/10 text-status-info',
  login_failed: 'bg-status-error/10 text-status-error',
  user_roles_updated: 'bg-status-warning/10 text-status-warning',
  user_deactivated: 'bg-status-error/10 text-status-error',
  invitation_created: 'bg-status-success/10 text-status-success',
  invitation_revoked: 'bg-status-error/10 text-status-error',
  invitation_accepted: 'bg-status-success/10 text-status-success',
  security_policy_updated: 'bg-status-warning/10 text-status-warning',
  password_changed: 'bg-status-info/10 text-status-info',
  password_reset: 'bg-status-info/10 text-status-info',
  registration_approved: 'bg-status-success/10 text-status-success',
  registration_rejected: 'bg-status-error/10 text-status-error',
}

const RECORD_TYPES = ['app_user', 'invitation', 'security_policy', 'company_registration', 'system']

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

function actionColor(action: string): string {
  return ACTION_COLORS[action] ?? 'bg-muted text-muted-foreground'
}

export function AuditTrail() {
  const { has } = usePermissions()
  const canRead = has('audit.read')

  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailEntry, setDetailEntry] = useState<AuditEntry | null>(null)

  const [recordType, setRecordType] = useState('all')
  const [action, setAction] = useState('all')
  const [timeRange, setTimeRange] = useState('all')
  const [knownActions, setKnownActions] = useState<string[]>([])

  const from = useMemo(() => {
    if (timeRange === 'all') return undefined
    const hours = timeRange === '24h' ? 24 : timeRange === '7d' ? 24 * 7 : 24 * 30
    return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
  }, [timeRange])

  useEffect(() => {
    if (!canRead) return
    setPage(1)
  }, [recordType, action, timeRange, limit, canRead])

  useEffect(() => {
    if (!canRead) return
    let cancelled = false
    setLoading(true)
    setError(null)

    getAuditEntries({
      recordType: recordType === 'all' ? undefined : recordType,
      action: action === 'all' ? undefined : action,
      from,
      page,
      limit,
    })
      .then(({ entries: rows, meta }) => {
        if (cancelled) return
        setEntries(rows)
        setTotalPages(meta.totalPages)
        setTotal(meta.total)
        setKnownActions((prev) => Array.from(new Set([...prev, ...rows.map((r) => r.action)])).sort())
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load the audit trail.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- from is derived from timeRange, re-running on it directly would double-fetch
  }, [recordType, action, page, limit, canRead])

  if (!canRead) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">Audit Trail</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">
            You don&apos;t have permission to view the audit trail. Contact your System Administrator.
          </p>
        </div>
      </div>
    )
  }

  const columns: DataTableColumn<AuditEntry>[] = [
    {
      key: 'action',
      label: 'Action',
      sortable: false,
      render: (value: string) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${actionColor(value)}`}>
          {formatAction(value)}
        </span>
      ),
    },
    {
      key: 'recordType',
      label: 'Record',
      render: (value: string, row: AuditEntry) => (
        <span className="whitespace-nowrap">
          {value.replace(/_/g, ' ')}
          {row.recordId ? ` · ${row.recordId.slice(0, 8)}` : ''}
        </span>
      ),
    },
    {
      key: 'actorName',
      label: 'Actor',
      render: (value: string | null, row: AuditEntry) => value ?? (row.actorType === 'system' ? 'System' : 'Unknown user'),
    },
    { key: 'ip', label: 'IP Address', render: (value: string | null) => value ?? '—' },
    {
      key: 'occurredAt',
      label: 'When',
      sortable: false,
      render: (value: string) => (
        <span className="whitespace-nowrap">
          {new Date(value).toLocaleDateString()} {new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Audit Trail</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} entries · Complete, immutable record of every regulated change in your company
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Filters</span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Record Type
            </label>
            <select
              value={recordType}
              onChange={(e) => setRecordType(e.target.value)}
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="all">All Types</option>
              {RECORD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="all">All Actions</option>
              {knownActions.map((a) => (
                <option key={a} value={a}>
                  {formatAction(a)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Time Range
            </label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">
          {error}
        </div>
      )}

      <DataTableV2
        data={entries}
        columns={columns}
        onRowClick={(row) => (row.oldValue || row.newValue) && setDetailEntry(row)}
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

      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <span>Rows per page</span>
        {[25, 50, 100].map((size) => (
          <button
            key={size}
            onClick={() => setLimit(size)}
            className={`px-2 py-1 rounded-md font-medium ${limit === size ? 'bg-[var(--primary)] text-white' : 'hover:bg-muted'}`}
          >
            {size}
          </button>
        ))}
      </div>

      {detailEntry && (
        <Modal title={formatAction(detailEntry.action)} onClose={() => setDetailEntry(null)} maxWidth="max-w-xl">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {detailEntry.recordType.replace(/_/g, ' ')}
              {detailEntry.recordId ? ` · ${detailEntry.recordId}` : ''} · By{' '}
              {detailEntry.actorName ?? (detailEntry.actorType === 'system' ? 'System' : 'Unknown user')} ·{' '}
              {new Date(detailEntry.occurredAt).toLocaleString()}
              {detailEntry.ip ? ` · ${detailEntry.ip}` : ''}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {detailEntry.oldValue && (
                <div className="rounded-lg bg-status-error/5 p-3">
                  <p className="text-xs font-semibold text-status-error mb-1">Before</p>
                  <pre className="text-xs text-muted-foreground overflow-x-auto">
                    {JSON.stringify(detailEntry.oldValue, null, 2)}
                  </pre>
                </div>
              )}
              {detailEntry.newValue && (
                <div className="rounded-lg bg-status-success/5 p-3">
                  <p className="text-xs font-semibold text-status-success mb-1">After</p>
                  <pre className="text-xs text-muted-foreground overflow-x-auto">
                    {JSON.stringify(detailEntry.newValue, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
