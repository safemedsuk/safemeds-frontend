'use client'

import { useCallback, useEffect, useState } from 'react'
import { CircleCheck, FileBarChart, Handshake, Link2, Loader2, Plus, ShieldAlert, Unlink, Users } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  createDistributor,
  CreateDistributorInput,
  CrossTenantSummary,
  Distributor,
  DISTRIBUTOR_STATUS_LABELS,
  DistributorStatus,
  generateReconciliationReport,
  getCrossTenantSummary,
  ListDistributorsResult,
  listDistributors,
  listReconciliationReports,
  listUnmatchedCases,
  manuallyReconcileCase,
  ReconciliationReport,
  UnmatchedCase,
  updateDistributor,
} from '@/lib/api/reconciliation'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

function defaultPeriod(): { start: string; end: string } {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 30)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

type Tab = 'distributors' | 'unmatched' | 'reports'

/**
 * VigiCloud Stage 15.1 — one screen, three tabs, matching this codebase's
 * established preference for tables + modals over stacked pages for a
 * feature this dense. `Distributor.distributorCompanyId` (the cross-tenant
 * link) is deliberately read-only here — see `CreateDistributorDto`'s own
 * backend doc comment for why linking is a platform-only action, never
 * tenant self-service.
 */
export function ReconciliationScreen() {
  const { has, hasAny } = usePermissions()
  const canView = hasAny('reconciliation.view', 'reconciliation.manage')
  const canManage = has('reconciliation.manage')

  const [tab, setTab] = useState<Tab>('distributors')

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">Reconciliation</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to view distributor reconciliation. Contact your System Administrator.</p>
        </div>
      </div>
    )
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'distributors', label: 'Distributors', icon: <Users className="h-4 w-4" /> },
    { key: 'unmatched', label: 'Unmatched Cases', icon: <ShieldAlert className="h-4 w-4" /> },
    { key: 'reports', label: 'Reports', icon: <FileBarChart className="h-4 w-4" /> },
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <div className="flex items-center gap-3">
          <Handshake className="h-6 w-6 text-safemeds-teal" />
          <h1 className="text-3xl font-display font-bold text-foreground">Reconciliation</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Map incoming cases to your listed distributors, review what hasn&apos;t been reconciled, and archive periodic reconciliation reports.
        </p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key ? 'border-safemeds-teal text-safemeds-teal' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'distributors' && <DistributorsTab canManage={canManage} />}
      {tab === 'unmatched' && <UnmatchedTab canManage={canManage} />}
      {tab === 'reports' && <ReportsTab canManage={canManage} />}
    </div>
  )
}

function DistributorsTab({ canManage }: { canManage: boolean }) {
  const [result, setResult] = useState<ListDistributorsResult | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Distributor | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listDistributors({ q: search.trim() || undefined, limit: 100 })
      .then(setResult)
      .catch((err) => setError(getErrorMessage(err, 'Could not load distributors.')))
      .finally(() => setLoading(false))
  }, [search])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by distributor name…"
          className={`${inputClass} sm:max-w-sm`}
        />
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Distributor
          </button>
        )}
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !result || result.distributors.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{search ? 'No distributors match this search.' : 'No distributors listed yet.'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">Name</th>
                <th className="p-3">Contact</th>
                <th className="p-3">Status</th>
                <th className="p-3">Tenant Link</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {result.distributors.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium text-foreground">{d.name}</td>
                  <td className="p-3 text-muted-foreground">
                    {d.contactEmail || '—'}
                    {d.contactPhone ? ` · ${d.contactPhone}` : ''}
                  </td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        d.status === 'active' ? 'bg-status-success/10 text-status-success' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {DISTRIBUTOR_STATUS_LABELS[d.status]}
                    </span>
                  </td>
                  <td className="p-3">
                    {d.distributorCompanyId ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-status-info">
                        <Link2 className="h-3.5 w-3.5" /> Linked tenant
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Unlink className="h-3.5 w-3.5" /> Not linked
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {canManage && (
                      <button onClick={() => setEditing(d)} className="text-xs font-medium text-safemeds-teal hover:underline">
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Linking a distributor to its own SafeMeds tenant (for cross-tenant reconciliation) is a platform-side action — contact SafeMeds support to have a
        distributor&apos;s account linked once they&apos;re also a tenant.
      </p>

      {showCreate && (
        <DistributorModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false)
            setNotice('Distributor added.')
            load()
          }}
        />
      )}

      {editing && (
        <DistributorModal
          distributor={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            setNotice('Distributor updated.')
            load()
          }}
        />
      )}
    </div>
  )
}

function DistributorModal({
  distributor,
  onClose,
  onSaved,
}: {
  distributor?: Distributor
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!distributor
  const [name, setName] = useState(distributor?.name ?? '')
  const [contactEmail, setContactEmail] = useState(distributor?.contactEmail ?? '')
  const [contactPhone, setContactPhone] = useState(distributor?.contactPhone ?? '')
  const [status, setStatus] = useState<DistributorStatus>(distributor?.status ?? 'active')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = name.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      if (isEdit) {
        await updateDistributor(distributor.id, {
          name: name.trim(),
          contactEmail: contactEmail.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          status,
        })
      } else {
        const input: CreateDistributorInput = {
          name: name.trim(),
          contactEmail: contactEmail.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
        }
        await createDistributor(input)
      }
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save this distributor.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">{isEdit ? 'Edit Distributor' : 'Add Distributor'}</h2>

        <div>
          <label className={labelClass}>Distributor Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Meridian Pharma Distributors Ltd" className={inputClass} />
          <p className="mt-1 text-xs text-muted-foreground">Matched case-insensitively against each case&apos;s own reported organization.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Contact Email</label>
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Contact Phone</label>
            <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputClass} />
          </div>
        </div>

        {isEdit && (
          <div>
            <label className={labelClass}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as DistributorStatus)} className={inputClass}>
              {Object.entries(DISTRIBUTOR_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}

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
            {isEdit ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

function UnmatchedTab({ canManage }: { canManage: boolean }) {
  const [period, setPeriod] = useState(defaultPeriod())
  const [cases, setCases] = useState<UnmatchedCase[]>([])
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [reconciling, setReconciling] = useState<UnmatchedCase | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([listUnmatchedCases(period.start, period.end), listDistributors({ limit: 100 })])
      .then(([unmatched, distResult]) => {
        setCases(unmatched)
        setDistributors(distResult.distributors)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load unmatched cases.')))
      .finally(() => setLoading(false))
  }, [period])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className={labelClass}>Period Start</label>
          <input type="date" value={period.start} onChange={(e) => setPeriod((p) => ({ ...p, start: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Period End</label>
          <input type="date" value={period.end} onChange={(e) => setPeriod((p) => ({ ...p, end: e.target.value }))} className={inputClass} />
        </div>
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : cases.length === 0 ? (
          <div className="p-12 text-center">
            <CircleCheck className="mx-auto h-10 w-10 text-status-success/50 mb-3" />
            <p className="text-sm text-muted-foreground">Every case received in this period is reconciled to a distributor (or confirmed not
            distributor-sourced).</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">Reference</th>
                <th className="p-3">Reported Organization</th>
                <th className="p-3">Received</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.caseId} className="border-b border-border last:border-0">
                  <td className="p-3 font-mono text-xs text-foreground">{c.referenceNumber}</td>
                  <td className="p-3 text-foreground">{c.reporterOrganization || <span className="text-muted-foreground">Not stated</span>}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(c.receivedDate)}</td>
                  <td className="p-3 text-right">
                    {canManage && (
                      <button onClick={() => setReconciling(c)} className="text-xs font-medium text-safemeds-teal hover:underline">
                        Reconcile
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {reconciling && (
        <ReconcileCaseModal
          unmatchedCase={reconciling}
          distributors={distributors}
          onClose={() => setReconciling(null)}
          onReconciled={() => {
            setReconciling(null)
            setNotice('Case reconciled.')
            load()
          }}
        />
      )}
    </div>
  )
}

function ReconcileCaseModal({
  unmatchedCase,
  distributors,
  onClose,
  onReconciled,
}: {
  unmatchedCase: UnmatchedCase
  distributors: Distributor[]
  onClose: () => void
  onReconciled: () => void
}) {
  const [distributorId, setDistributorId] = useState<string>('')
  const [confirmedNotDistributor, setConfirmedNotDistributor] = useState(false)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = distributorId !== '' || confirmedNotDistributor

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await manuallyReconcileCase(unmatchedCase.caseId, {
        distributorId: confirmedNotDistributor ? null : distributorId,
        note: note.trim() || undefined,
      })
      onReconciled()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not reconcile this case.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">Reconcile Case {unmatchedCase.referenceNumber}</h2>
        <p className="text-sm text-muted-foreground">
          Reported organization: <span className="text-foreground">{unmatchedCase.reporterOrganization || 'Not stated'}</span>
        </p>

        <div>
          <label className={labelClass}>Distributor</label>
          <select
            value={distributorId}
            onChange={(e) => {
              setDistributorId(e.target.value)
              if (e.target.value) setConfirmedNotDistributor(false)
            }}
            disabled={confirmedNotDistributor}
            className={inputClass}
          >
            <option value="">Select a distributor…</option>
            {distributors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={confirmedNotDistributor}
            onChange={(e) => {
              setConfirmedNotDistributor(e.target.checked)
              if (e.target.checked) setDistributorId('')
            }}
          />
          Confirmed — this case is not distributor-sourced
        </label>

        <div>
          <label className={labelClass}>Note</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputClass} />
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
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

const REPORT_COLUMNS: DataTableColumn<ReconciliationReport>[] = [
  { key: 'periodStart', label: 'Period', render: (v, row) => `${formatDate(v)} – ${formatDate(row.periodEnd)}` },
  { key: 'distributorId', label: 'Scope', render: (v) => (v ? 'Single distributor' : 'Whole company') },
  { key: 'totalCases', label: 'Total' },
  { key: 'matchedCases', label: 'Matched', render: (v) => <span className="text-status-success">{v}</span> },
  { key: 'unmatchedCases', label: 'Unmatched', render: (v) => <span className="text-status-warning">{v}</span> },
  { key: 'generatedAt', label: 'Generated', sortable: true, render: (v) => formatDate(v) },
]

function ReportsTab({ canManage }: { canManage: boolean }) {
  const [reports, setReports] = useState<ReconciliationReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showGenerate, setShowGenerate] = useState(false)
  const [viewing, setViewing] = useState<ReconciliationReport | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listReconciliationReports(page, limit)
      .then(({ reports: rows, meta }) => {
        setReports(rows)
        setTotalPages(meta.totalPages)
        setTotal(meta.total)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load reconciliation reports.')))
      .finally(() => setLoading(false))
  }, [page, limit])

  useEffect(() => {
    load()
  }, [load])

  const handleRowsPerPageChange = (n: number) => {
    setLimit(n)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canManage && (
          <button
            onClick={() => setShowGenerate(true)}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors"
          >
            <Plus className="h-4 w-4" /> Generate Report
          </button>
        )}
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      {!loading && reports.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <FileBarChart className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No reconciliation reports generated yet.</p>
        </div>
      ) : (
        <DataTableV2<ReconciliationReport>
          data={reports}
          columns={REPORT_COLUMNS}
          onRowClick={(row) => setViewing(row)}
          searchable={false}
          exportable={false}
          showDensityToggle={false}
          loading={loading}
          page={page}
          totalPages={totalPages}
          totalCount={total}
          onPageChange={setPage}
          rowsPerPage={limit}
          onRowsPerPageChange={handleRowsPerPageChange}
        />
      )}

      {showGenerate && (
        <GenerateReportModal
          onClose={() => setShowGenerate(false)}
          onGenerated={() => {
            setShowGenerate(false)
            setNotice('Reconciliation report generated.')
            setPage(1)
            load()
          }}
        />
      )}

      {viewing && <ReportDetailModal report={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

function GenerateReportModal({ onClose, onGenerated }: { onClose: () => void; onGenerated: (report: ReconciliationReport) => void }) {
  const [period, setPeriod] = useState(defaultPeriod())
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [distributorId, setDistributorId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listDistributors({ limit: 100 })
      .then((r) => setDistributors(r.distributors))
      .catch(() => {})
  }, [])

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const report = await generateReconciliationReport({
        periodStart: period.start,
        periodEnd: period.end,
        distributorId: distributorId || undefined,
      })
      onGenerated(report)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not generate this report.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">Generate Reconciliation Report</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Period Start</label>
            <input type="date" value={period.start} onChange={(e) => setPeriod((p) => ({ ...p, start: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Period End</label>
            <input type="date" value={period.end} onChange={(e) => setPeriod((p) => ({ ...p, end: e.target.value }))} className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Distributor (optional — leave blank for whole company)</label>
          <select value={distributorId} onChange={(e) => setDistributorId(e.target.value)} className={inputClass}>
            <option value="">All distributors</option>
            {distributors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <p className="text-xs text-muted-foreground">
          This report is archived permanently once generated — it&apos;s never overwritten. Generate a new one any time to get a fresh snapshot.
        </p>

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Generate
          </button>
        </div>
      </div>
    </div>
  )
}

function ReportDetailModal({ report, onClose }: { report: ReconciliationReport; onClose: () => void }) {
  const [crossTenant, setCrossTenant] = useState<Record<string, CrossTenantSummary | 'loading' | 'error'>>({})

  const loadCrossTenant = (distributorId: string) => {
    setCrossTenant((prev) => ({ ...prev, [distributorId]: 'loading' }))
    getCrossTenantSummary(distributorId, report.periodStart, report.periodEnd)
      .then((summary) => setCrossTenant((prev) => ({ ...prev, [distributorId]: summary })))
      .catch(() => setCrossTenant((prev) => ({ ...prev, [distributorId]: 'error' })))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display font-bold text-lg text-foreground">Reconciliation Report</h2>
            <p className="text-sm text-muted-foreground">
              {formatDate(report.periodStart)} – {formatDate(report.periodEnd)}
            </p>
          </div>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
            Close
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-border p-3 text-center">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-xl font-display font-bold text-foreground">{report.totalCases}</p>
          </div>
          <div className="rounded-lg border border-border p-3 text-center">
            <p className="text-xs text-muted-foreground">Matched</p>
            <p className="text-xl font-display font-bold text-status-success">{report.matchedCases}</p>
          </div>
          <div className="rounded-lg border border-border p-3 text-center">
            <p className="text-xs text-muted-foreground">Unmatched</p>
            <p className="text-xl font-display font-bold text-status-warning">{report.unmatchedCases}</p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">By Distributor</h3>
          {report.snapshot.byDistributor.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matched cases in this period.</p>
          ) : (
            <div className="space-y-2">
              {report.snapshot.byDistributor.map((b) => {
                const ct = crossTenant[b.distributorId]
                return (
                  <div key={b.distributorId} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">{b.distributorName}</p>
                      <p className="text-sm text-muted-foreground">{b.caseCount} cases</p>
                    </div>
                    {!ct && (
                      <button onClick={() => loadCrossTenant(b.distributorId)} className="mt-1 text-xs font-medium text-safemeds-teal hover:underline">
                        Check cross-tenant summary
                      </button>
                    )}
                    {ct === 'loading' && <p className="mt-1 text-xs text-muted-foreground">Loading…</p>}
                    {ct === 'error' && <p className="mt-1 text-xs text-muted-foreground">Not linked to a SafeMeds tenant, or read failed.</p>}
                    {ct && typeof ct === 'object' && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Distributor tenant logged {ct.distributorTenantCaseCount} case(s) sent to this manufacturer in the same period (vs.{' '}
                        {ct.manufacturerMatchedCaseCount} matched here).
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Unmatched ({report.snapshot.unmatched.length})</h3>
          {report.snapshot.unmatched.length === 0 ? (
            <p className="text-sm text-muted-foreground">Every case in this period reconciled.</p>
          ) : (
            <ul className="space-y-1">
              {report.snapshot.unmatched.map((u) => (
                <li key={u.caseId} className="text-sm text-foreground flex justify-between">
                  <span className="font-mono text-xs">{u.referenceNumber}</span>
                  <span className="text-muted-foreground">{u.reporterOrganization || 'Not stated'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
