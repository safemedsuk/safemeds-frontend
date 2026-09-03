'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, ClipboardCheck, Gavel, Loader2, Plus, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  AUDIT_FINDING_SEVERITY_LABELS,
  AuditFinding,
  AuditFindingSeverity,
  Capa,
  CAPA_STATUS_LABELS,
  CapaEffectivenessResult,
  CapaStatus,
  closeCapa,
  createInternalAudit,
  InternalAudit,
  InternalAuditStatus,
  INTERNAL_AUDIT_STATUS_LABELS,
  listAuditFindings,
  listCapas,
  listInternalAudits,
  recordCapaEffectivenessCheck,
} from '@/lib/api/internal-audits'
import { OpenCapaModal } from '@/components/internal-audits/open-capa-modal'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const CAPA_STATUS_STYLES: Record<string, string> = {
  open: 'bg-status-info/10 text-status-info',
  in_progress: 'bg-status-warning/10 text-status-warning',
  pending_effectiveness_check: 'bg-status-warning/10 text-status-warning',
  closed: 'bg-status-success/10 text-status-success',
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-status-error/10 text-status-error',
  major: 'bg-status-warning/10 text-status-warning',
  minor: 'bg-status-info/10 text-status-info',
  observation: 'bg-muted text-muted-foreground',
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

type Tab = 'audits' | 'findings' | 'capas'

/**
 * VigiCloud Stage 16.3 — audit schedule, findings log, and the CAPA
 * register with the effectiveness-check gate kept as a visibly separate,
 * required step before "Close" is even clickable — never a silent
 * validation error after the fact.
 */
export function InternalAuditsScreen() {
  const router = useRouter()
  const { has, hasAny } = usePermissions()
  const canManage = has('quality.manage_capa')
  const canClose = has('quality.close_capa')
  const canView = hasAny('quality.manage_capa', 'quality.view_all')

  const [tab, setTab] = useState<Tab>('audits')

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">Internal Audits</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to view internal audits. Contact your System Administrator.</p>
        </div>
      </div>
    )
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'audits', label: 'Audits', icon: <Gavel className="h-4 w-4" /> },
    { key: 'findings', label: 'Findings', icon: <AlertTriangle className="h-4 w-4" /> },
    { key: 'capas', label: 'CAPAs', icon: <ClipboardCheck className="h-4 w-4" /> },
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Gavel className="h-6 w-6 text-safemeds-teal" />
        <h1 className="text-3xl font-display font-bold text-foreground">Internal Audits</h1>
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

      {tab === 'audits' && <AuditsTab canManage={canManage} onOpenAudit={(id) => router.push(`/internal-audits/${id}`)} />}
      {tab === 'findings' && <FindingsTab />}
      {tab === 'capas' && <CapasTab canManage={canManage} canClose={canClose} />}
    </div>
  )
}

const AUDIT_COLUMNS: DataTableColumn<InternalAudit>[] = [
  { key: 'title', label: 'Title' },
  { key: 'scheduledDate', label: 'Scheduled', sortable: true, render: (v) => formatDate(v) },
  {
    key: 'status',
    label: 'Status',
    render: (v) => <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">{INTERNAL_AUDIT_STATUS_LABELS[v as InternalAuditStatus]}</span>,
  },
]

function AuditsTab({ canManage, onOpenAudit }: { canManage: boolean; onOpenAudit: (id: string) => void }) {
  const [audits, setAudits] = useState<InternalAudit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showSchedule, setShowSchedule] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const load = useCallback(() => {
    setLoading(true)
    listInternalAudits(page, limit)
      .then(({ audits: rows, meta }) => {
        setAudits(rows)
        setTotalPages(meta.totalPages)
        setTotal(meta.total)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load internal audits.')))
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
            onClick={() => setShowSchedule(true)}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce"
          >
            <Plus className="h-4 w-4" /> Schedule Audit
          </button>
        )}
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      {!loading && audits.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <Gavel className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No internal audits scheduled yet.</p>
        </div>
      ) : (
        <DataTableV2<InternalAudit>
          data={audits}
          columns={AUDIT_COLUMNS}
          onRowClick={(row) => onOpenAudit(row.id)}
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

      {showSchedule && (
        <ScheduleAuditModal
          onClose={() => setShowSchedule(false)}
          onScheduled={() => {
            setShowSchedule(false)
            setNotice('Audit scheduled.')
            setPage(1)
            load()
          }}
        />
      )}
    </div>
  )
}

function ScheduleAuditModal({ onClose, onScheduled }: { onClose: () => void; onScheduled: () => void }) {
  const [title, setTitle] = useState('')
  const [scope, setScope] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = title.trim().length > 0 && scheduledDate.length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await createInternalAudit({ title: title.trim(), scope: scope.trim() || undefined, scheduledDate })
      onScheduled()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not schedule this audit.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">Schedule Internal Audit</h2>

        <div>
          <label className={labelClass}>Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Q3 GVP Audit" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Scope</label>
          <textarea value={scope} onChange={(e) => setScope(e.target.value)} rows={2} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Scheduled Date *</label>
          <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className={inputClass} />
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
            Schedule
          </button>
        </div>
      </div>
    </div>
  )
}

const FINDING_COLUMNS: DataTableColumn<AuditFinding>[] = [
  { key: 'description', label: 'Description' },
  {
    key: 'severity',
    label: 'Severity',
    render: (v) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLES[v as AuditFindingSeverity]}`}>{AUDIT_FINDING_SEVERITY_LABELS[v as AuditFindingSeverity]}</span>,
  },
  { key: 'status', label: 'Status', render: (v) => <span className="capitalize">{(v as string).replace('_', ' ')}</span> },
  { key: 'createdAt', label: 'Logged', sortable: true, render: (v) => formatDate(v) },
]

function FindingsTab() {
  const [findings, setFindings] = useState<AuditFinding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    setLoading(true)
    listAuditFindings(page, limit)
      .then(({ findings: rows, meta }) => {
        setFindings(rows)
        setTotalPages(meta.totalPages)
        setTotal(meta.total)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load findings.')))
      .finally(() => setLoading(false))
  }, [page, limit])

  const handleRowsPerPageChange = (n: number) => {
    setLimit(n)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}
      {!loading && findings.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No findings logged yet.</p>
        </div>
      ) : (
        <DataTableV2<AuditFinding>
          data={findings}
          columns={FINDING_COLUMNS}
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
    </div>
  )
}

const CAPA_COLUMNS: DataTableColumn<Capa>[] = [
  { key: 'title', label: 'Title' },
  { key: 'dueDate', label: 'Due', sortable: true, render: (v) => formatDate(v) },
  {
    key: 'status',
    label: 'Status',
    render: (v) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${CAPA_STATUS_STYLES[v as CapaStatus]}`}>{CAPA_STATUS_LABELS[v as CapaStatus]}</span>,
  },
  {
    key: 'effectivenessCheckResult',
    label: 'Effectiveness',
    render: (v) => (v ? (v === 'effective' ? 'Effective' : 'Not effective') : '—'),
  },
]

function CapasTab({ canManage, canClose }: { canManage: boolean; canClose: boolean }) {
  const [capas, setCapas] = useState<Capa[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showOpen, setShowOpen] = useState(false)
  const [selected, setSelected] = useState<Capa | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const load = useCallback(() => {
    setLoading(true)
    listCapas(page, limit)
      .then(({ capas: rows, meta }) => {
        setCapas(rows)
        setTotalPages(meta.totalPages)
        setTotal(meta.total)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load CAPAs.')))
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
          <button onClick={() => setShowOpen(true)} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce">
            <Plus className="h-4 w-4" /> Open CAPA
          </button>
        )}
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      {!loading && capas.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ClipboardCheck className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No CAPAs opened yet.</p>
        </div>
      ) : (
        <DataTableV2<Capa>
          data={capas}
          columns={CAPA_COLUMNS}
          onRowClick={(row) => setSelected(row)}
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

      {showOpen && (
        <OpenCapaModal
          onClose={() => setShowOpen(false)}
          onOpened={() => {
            setShowOpen(false)
            setNotice('CAPA opened.')
            setPage(1)
            load()
          }}
        />
      )}

      {selected && (
        <CapaDetailModal
          capa={selected}
          canClose={canClose}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function CapaDetailModal({ capa, canClose, onClose, onChanged }: { capa: Capa; canClose: boolean; onClose: () => void; onChanged: () => void }) {
  const [result, setResult] = useState<CapaEffectivenessResult>('effective')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isClosed = capa.status === 'closed'
  const hasEffectivenessCheck = !!capa.effectivenessCheckResult

  const handleRecordCheck = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await recordCapaEffectivenessCheck(capa.id, result, note.trim() || undefined)
      onChanged()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not record this effectiveness check.'))
      setSubmitting(false)
    }
  }

  const handleClose = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await closeCapa(capa.id)
      onChanged()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not close this CAPA.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">{capa.title}</h2>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CAPA_STATUS_STYLES[capa.status]}`}>{CAPA_STATUS_LABELS[capa.status]}</span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Due</p>
            <p className="text-foreground">{formatDate(capa.dueDate)}</p>
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Corrective Action</p>
          <p className="text-sm text-foreground">{capa.correctiveAction}</p>
        </div>
        {capa.preventiveAction && (
          <div>
            <p className="text-xs text-muted-foreground">Preventive Action</p>
            <p className="text-sm text-foreground">{capa.preventiveAction}</p>
          </div>
        )}

        {/* The effectiveness-check gate — a distinct, required step before Close is even enabled. */}
        <div className="rounded-lg border-2 border-dashed border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-safemeds-teal" />
            <h3 className="text-sm font-semibold text-foreground">Effectiveness Check</h3>
            {hasEffectivenessCheck && <CheckCircle2 className="h-4 w-4 text-status-success" />}
          </div>

          {hasEffectivenessCheck ? (
            <div className="text-sm">
              <p className="text-foreground">
                Result: <span className="font-medium">{capa.effectivenessCheckResult === 'effective' ? 'Effective' : 'Not effective'}</span>
              </p>
              {capa.effectivenessCheckNote && <p className="mt-1 text-muted-foreground">{capa.effectivenessCheckNote}</p>}
            </div>
          ) : canClose && !isClosed ? (
            <>
              <p className="text-xs text-muted-foreground">A CAPA cannot be closed until its effectiveness is separately confirmed here.</p>
              <div>
                <label className={labelClass}>Result</label>
                <select value={result} onChange={(e) => setResult(e.target.value as CapaEffectivenessResult)} className={inputClass}>
                  <option value="effective">Effective</option>
                  <option value="not_effective">Not effective</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Note</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputClass} />
              </div>
              <button
                onClick={handleRecordCheck}
                disabled={submitting}
                className="flex items-center gap-2 rounded-lg border border-safemeds-teal px-3 py-1.5 text-xs font-medium text-safemeds-teal hover:bg-safemeds-teal/10 disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Record Effectiveness Check
              </button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Not yet recorded — requires the quality.close_capa permission.</p>
          )}
        </div>

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Close Dialog
          </button>
          {canClose && !isClosed && (
            <button
              onClick={handleClose}
              disabled={!hasEffectivenessCheck || submitting}
              title={!hasEffectivenessCheck ? 'Record an effectiveness check first' : undefined}
              className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-40"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Close CAPA
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
