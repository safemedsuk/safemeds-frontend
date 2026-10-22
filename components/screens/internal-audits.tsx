'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, ClipboardCheck, Gavel, Loader2, Plus, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  AUDIT_FINDING_SEVERITY_LABELS,
  AUDIT_SCOPE_LABELS,
  AuditFinding,
  AuditFindingSeverity,
  AuditScope,
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
import { listSuppliers, type Supplier } from '@/lib/api/quality'
import { OpenCapaModal } from '@/components/internal-audits/open-capa-modal'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'
import { useTranslation } from '@/lib/i18n/use-translation'

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
  const { t } = useTranslation()
  const { has, hasAny } = usePermissions()
  const canManage = has('quality.manage_capa')
  const canClose = has('quality.close_capa')
  const canView = hasAny('quality.manage_capa', 'quality.view_all')

  const [tab, setTab] = useState<Tab>('audits')

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">{t('internalAudits.title')}</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{t('internalAudits.noPermission')}</p>
        </div>
      </div>
    )
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'audits', label: t('internalAudits.tabAudits'), icon: <Gavel className="h-4 w-4" /> },
    { key: 'findings', label: t('internalAudits.tabFindings'), icon: <AlertTriangle className="h-4 w-4" /> },
    { key: 'capas', label: t('internalAudits.tabCapas'), icon: <ClipboardCheck className="h-4 w-4" /> },
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Gavel className="h-6 w-6 text-safemeds-teal" />
        <h1 className="text-3xl font-display font-bold text-foreground">{t('internalAudits.title')}</h1>
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs.map((tabItem) => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === tabItem.key ? 'border-safemeds-teal text-safemeds-teal' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tabItem.icon}
            {tabItem.label}
          </button>
        ))}
      </div>

      {tab === 'audits' && <AuditsTab canManage={canManage} onOpenAudit={(id) => router.push(`/internal-audits/${id}`)} />}
      {tab === 'findings' && <FindingsTab />}
      {tab === 'capas' && <CapasTab canManage={canManage} canClose={canClose} />}
    </div>
  )
}

const AUDIT_SCOPE_STYLES: Record<AuditScope, string> = {
  internal: 'bg-muted text-muted-foreground',
  supplier: 'bg-status-info/10 text-status-info',
  regulatory: 'bg-status-warning/10 text-status-warning',
}

function AuditsTab({ canManage, onOpenAudit }: { canManage: boolean; onOpenAudit: (id: string) => void }) {
  const { t } = useTranslation()
  const AUDIT_COLUMNS: DataTableColumn<InternalAudit>[] = [
    { key: 'title', label: t('internalAudits.columnTitle') },
    {
      key: 'auditScope',
      label: t('internalAudits.columnScope'),
      render: (v) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${AUDIT_SCOPE_STYLES[v as AuditScope]}`}>{AUDIT_SCOPE_LABELS[v as AuditScope]}</span>,
    },
    { key: 'scheduledDate', label: t('internalAudits.columnScheduled'), sortable: true, render: (v) => formatDate(v) },
    {
      key: 'status',
      label: t('internalAudits.columnStatus'),
      render: (v) => <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">{INTERNAL_AUDIT_STATUS_LABELS[v as InternalAuditStatus]}</span>,
    },
  ]
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
      .catch((err) => setError(getErrorMessage(err, t('internalAudits.errorLoadAudits'))))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <Plus className="h-4 w-4" /> {t('internalAudits.scheduleAudit')}
          </button>
        )}
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      {!loading && audits.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <Gavel className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{t('internalAudits.noAuditsYet')}</p>
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
            setNotice(t('internalAudits.auditScheduled'))
            setPage(1)
            load()
          }}
        />
      )}
    </div>
  )
}

function ScheduleAuditModal({ onClose, onScheduled }: { onClose: () => void; onScheduled: () => void }) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [scope, setScope] = useState('')
  const [auditScope, setAuditScope] = useState<AuditScope>('internal')
  const [supplierId, setSupplierId] = useState('')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [scheduledDate, setScheduledDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (auditScope === 'supplier') {
      listSuppliers({ limit: 100 }).then((r) => setSuppliers(r.rows)).catch(() => undefined)
    }
  }, [auditScope])

  const isValid = title.trim().length > 0 && scheduledDate.length > 0 && (auditScope !== 'supplier' || supplierId.length > 0)

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await createInternalAudit({
        title: title.trim(),
        scope: scope.trim() || undefined,
        scheduledDate,
        auditScope,
        supplierId: auditScope === 'supplier' ? supplierId : undefined,
      })
      onScheduled()
    } catch (err) {
      setError(getErrorMessage(err, t('internalAudits.errorScheduleAudit')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">{t('internalAudits.scheduleAuditModalTitle')}</h2>

        <div>
          <label className={labelClass}>{t('internalAudits.titleField')}</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('internalAudits.titlePlaceholder')} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t('internalAudits.auditScope')}</label>
          <select value={auditScope} onChange={(e) => setAuditScope(e.target.value as AuditScope)} className={inputClass}>
            {Object.entries(AUDIT_SCOPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            {auditScope === 'internal' && t('internalAudits.scopeHelpInternal')}
            {auditScope === 'supplier' && t('internalAudits.scopeHelpSupplier')}
            {auditScope === 'regulatory' && t('internalAudits.scopeHelpRegulatory')}
          </p>
        </div>
        {auditScope === 'supplier' && (
          <div>
            <label className={labelClass}>{t('internalAudits.supplier')}</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputClass}>
              <option value="">{t('internalAudits.selectSupplier')}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className={labelClass}>{t('internalAudits.scopeNotes')}</label>
          <textarea value={scope} onChange={(e) => setScope(e.target.value)} rows={2} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t('internalAudits.scheduledDate')}</label>
          <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className={inputClass} />
        </div>

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('internalAudits.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('internalAudits.schedule')}
          </button>
        </div>
      </div>
    </div>
  )
}

function FindingsTab() {
  const { t } = useTranslation()
  const FINDING_COLUMNS: DataTableColumn<AuditFinding>[] = [
    { key: 'description', label: t('internalAudits.columnDescription') },
    {
      key: 'severity',
      label: t('internalAudits.columnSeverity'),
      render: (v) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLES[v as AuditFindingSeverity]}`}>{AUDIT_FINDING_SEVERITY_LABELS[v as AuditFindingSeverity]}</span>,
    },
    { key: 'status', label: t('internalAudits.columnStatus'), render: (v) => <span className="capitalize">{(v as string).replace('_', ' ')}</span> },
    { key: 'createdAt', label: t('internalAudits.columnLogged'), sortable: true, render: (v) => formatDate(v) },
  ]
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
      .catch((err) => setError(getErrorMessage(err, t('internalAudits.errorLoadFindings'))))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <p className="text-sm text-muted-foreground">{t('internalAudits.noFindingsYet')}</p>
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

function CapasTab({ canManage, canClose }: { canManage: boolean; canClose: boolean }) {
  const { t } = useTranslation()
  const CAPA_COLUMNS: DataTableColumn<Capa>[] = [
    { key: 'title', label: t('internalAudits.columnTitle') },
    { key: 'dueDate', label: t('internalAudits.columnDue'), sortable: true, render: (v) => formatDate(v) },
    {
      key: 'status',
      label: t('internalAudits.columnStatus'),
      render: (v) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${CAPA_STATUS_STYLES[v as CapaStatus]}`}>{CAPA_STATUS_LABELS[v as CapaStatus]}</span>,
    },
    {
      key: 'effectivenessCheckResult',
      label: t('internalAudits.columnEffectiveness'),
      render: (v) => (v ? (v === 'effective' ? t('internalAudits.effective') : t('internalAudits.notEffective')) : '—'),
    },
  ]
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
      .catch((err) => setError(getErrorMessage(err, t('internalAudits.errorLoadCapas'))))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <Plus className="h-4 w-4" /> {t('internalAudits.openCapa')}
          </button>
        )}
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      {!loading && capas.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ClipboardCheck className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{t('internalAudits.noCapasYet')}</p>
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
            setNotice(t('internalAudits.capaOpened'))
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
  const { t } = useTranslation()
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
      setError(getErrorMessage(err, t('internalAudits.errorRecordCheck')))
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
      setError(getErrorMessage(err, t('internalAudits.errorCloseCapa')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">{capa.title}</h2>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">{t('internalAudits.status')}</p>
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CAPA_STATUS_STYLES[capa.status]}`}>{CAPA_STATUS_LABELS[capa.status]}</span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('internalAudits.due')}</p>
            <p className="text-foreground">{formatDate(capa.dueDate)}</p>
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">{t('internalAudits.correctiveAction')}</p>
          <p className="text-sm text-foreground">{capa.correctiveAction}</p>
        </div>
        {capa.preventiveAction && (
          <div>
            <p className="text-xs text-muted-foreground">{t('internalAudits.preventiveAction')}</p>
            <p className="text-sm text-foreground">{capa.preventiveAction}</p>
          </div>
        )}

        {/* The effectiveness-check gate — a distinct, required step before Close is even enabled. */}
        <div className="rounded-lg border-2 border-dashed border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-safemeds-teal" />
            <h3 className="text-sm font-semibold text-foreground">{t('internalAudits.effectivenessCheck')}</h3>
            {hasEffectivenessCheck && <CheckCircle2 className="h-4 w-4 text-status-success" />}
          </div>

          {hasEffectivenessCheck ? (
            <div className="text-sm">
              <p className="text-foreground">
                {t('internalAudits.result')}: <span className="font-medium">{capa.effectivenessCheckResult === 'effective' ? t('internalAudits.effective') : t('internalAudits.notEffective')}</span>
              </p>
              {capa.effectivenessCheckNote && <p className="mt-1 text-muted-foreground">{capa.effectivenessCheckNote}</p>}
            </div>
          ) : canClose && !isClosed ? (
            <>
              <p className="text-xs text-muted-foreground">{t('internalAudits.cannotCloseHelp')}</p>
              <div>
                <label className={labelClass}>{t('internalAudits.result')}</label>
                <select value={result} onChange={(e) => setResult(e.target.value as CapaEffectivenessResult)} className={inputClass}>
                  <option value="effective">{t('internalAudits.effective')}</option>
                  <option value="not_effective">{t('internalAudits.notEffective')}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t('internalAudits.note')}</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputClass} />
              </div>
              <button
                onClick={handleRecordCheck}
                disabled={submitting}
                className="flex items-center gap-2 rounded-lg border border-safemeds-teal px-3 py-1.5 text-xs font-medium text-safemeds-teal hover:bg-safemeds-teal/10 disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t('internalAudits.recordEffectivenessCheck')}
              </button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{t('internalAudits.notYetRecordedHelp')}</p>
          )}
        </div>

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('internalAudits.closeDialog')}
          </button>
          {canClose && !isClosed && (
            <button
              onClick={handleClose}
              disabled={!hasEffectivenessCheck || submitting}
              title={!hasEffectivenessCheck ? t('internalAudits.recordCheckFirst') : undefined}
              className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-40"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('internalAudits.closeCapa')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
