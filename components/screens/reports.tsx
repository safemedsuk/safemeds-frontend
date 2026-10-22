'use client'

import { useEffect, useState } from 'react'
import { BarChart3, CheckCircle2, ClipboardCheck, FileSpreadsheet, FileText, Loader2, Plus, Send, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  GeneratedReport,
  GeneratedReportStatus,
  GeneratedReportWithWorkflow,
  createGeneratedReport,
  finalizeGeneratedReport,
  getGeneratedReport,
  listGeneratedReports,
  submitGeneratedReport,
} from '@/lib/api/reports'
import { attachPeriodicReportEvidence } from '@/lib/api/periodic-reports'
import { ReportType, listReportTypes } from '@/lib/api/report-types'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { Modal } from '@/components/ui/modal'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'
import { DocumentsPanel } from '@/components/documents/documents-panel'
import { WorkflowActionsPanel } from '@/components/pv-cases/workflow-actions-panel'
import { ReportingDashboardPanel } from '@/components/reporting/dashboard-panel'
import { GenerateLineListingModal } from '@/components/reporting/generate-line-listing-modal'
import { GeneratePeriodicReportModal } from '@/components/reporting/generate-periodic-report-modal'
import { BenefitRiskModal } from '@/components/reporting/benefit-risk-modal'
import { GenerateRegReportModal } from '@/components/reporting/generate-reg-report-modal'
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

const MODULE_OPTIONS: { key: string; labelKey: MessageKey }[] = [
  { key: 'pv', labelKey: 'reports.moduleLabelPv' },
  { key: 'qualcloud', labelKey: 'reports.moduleLabelQualcloud' },
  { key: 'regcloud', labelKey: 'reports.moduleLabelRegcloud' },
]

/** Real-usage request, 11 Sep 2026 — these report types drive their own lifecycle through a real workflow instance (QC review, QPPV sign-off+submit), so the generic row-level Finalize/Submit quick actions (which have no such gating) are hidden for them — open the report's own detail view for the real Workflow Actions panel instead. */
const PERIODIC_REPORT_TYPE_KEYS = new Set(['psur', 'pbrer', 'dsur', 'pader', 'cioms_ii'])

const STATUS_STYLES: Record<GeneratedReportStatus, string> = {
  draft: 'bg-status-warning/10 text-status-warning',
  final: 'bg-status-info/10 text-status-info',
  qc_reviewed: 'bg-status-info/10 text-status-info',
  submitted: 'bg-status-success/10 text-status-success',
}

const STATUS_LABEL_KEYS: Record<GeneratedReportStatus, MessageKey> = {
  draft: 'reports.statusDraft',
  final: 'reports.statusFinal',
  qc_reviewed: 'reports.statusQcReviewed',
  submitted: 'reports.statusSubmitted',
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

export function Reports() {
  const { t } = useTranslation()
  const moduleLabel = (key: string): string => {
    const found = MODULE_OPTIONS.find((m) => m.key === key)
    return found ? t(found.labelKey) : key
  }
  const { has } = usePermissions()
  const canView = has('reports.view')
  const canManage = has('reports.manage')

  const [reports, setReports] = useState<GeneratedReport[]>([])
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [moduleFilter, setModuleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const [createOpen, setCreateOpen] = useState(false)
  const [lineListingOpen, setLineListingOpen] = useState(false)
  const [periodicReportOpen, setPeriodicReportOpen] = useState(false)
  const [benefitRiskOpen, setBenefitRiskOpen] = useState(false)
  const [regReportOpen, setRegReportOpen] = useState(false)
  const [detail, setDetail] = useState<GeneratedReport | GeneratedReportWithWorkflow | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [attachingEvidence, setAttachingEvidence] = useState(false)

  useEffect(() => {
    if (!canView) return
    setPage(1)
  }, [moduleFilter, statusFilter, canView])

  useEffect(() => {
    if (!canView) return
    let cancelled = false
    setLoading(true)
    setError(null)

    listGeneratedReports({
      moduleKey: moduleFilter === 'all' ? undefined : moduleFilter,
      status: statusFilter === 'all' ? undefined : (statusFilter as GeneratedReportStatus),
      page,
      limit,
    })
      .then(({ reports: rows, meta }) => {
        if (cancelled) return
        setReports(rows)
        setTotalPages(meta.totalPages)
        setTotal(meta.total)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, t('reports.errorLoad')))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [moduleFilter, statusFilter, page, limit, canView])

  const refreshRow = (updated: GeneratedReport) => {
    setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    setDetail((prev) => (prev && prev.id === updated.id ? updated : prev))
  }

  const openDetail = async (row: GeneratedReport) => {
    setDetail(row)
    setEvidenceFile(null)
    // The list row never carries `workflowInstanceId` — refetch full detail
    // so a periodic report's real Workflow Actions panel and evidence
    // control show up even after a page reload, not just right after
    // generating it.
    try {
      const full = await getGeneratedReport(row.id)
      setDetail((prev) => (prev && prev.id === full.id ? full : prev))
    } catch {
      // Best-effort — the row's own data still renders the rest of the modal fine.
    }
  }

  const handleAttachEvidence = async (report: GeneratedReport, file: File) => {
    setAttachingEvidence(true)
    setActionError(null)
    try {
      refreshRow(await attachPeriodicReportEvidence(report.id, file))
      setEvidenceFile(null)
    } catch (err) {
      setActionError(getErrorMessage(err, t('reports.errorAttachEvidence')))
    } finally {
      setAttachingEvidence(false)
    }
  }

  const handleFinalize = async (report: GeneratedReport) => {
    setBusyId(report.id)
    setActionError(null)
    try {
      refreshRow(await finalizeGeneratedReport(report.id))
    } catch (err) {
      setActionError(getErrorMessage(err, t('reports.errorFinalize')))
    } finally {
      setBusyId(null)
    }
  }

  const handleSubmit = async (report: GeneratedReport) => {
    if (!window.confirm(t('reports.confirmSubmit', { title: report.title }))) return
    setBusyId(report.id)
    setActionError(null)
    try {
      refreshRow(await submitGeneratedReport(report.id))
    } catch (err) {
      setActionError(getErrorMessage(err, t('reports.errorSubmit')))
    } finally {
      setBusyId(null)
    }
  }

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">{t('reports.title')}</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{t('reports.noPermission')}</p>
        </div>
      </div>
    )
  }

  const columns: DataTableColumn<GeneratedReport>[] = [
    {
      key: 'title',
      label: t('reports.columnReport'),
      render: (_v, row) => (
        <div className="min-w-0">
          <p className="font-medium text-foreground truncate">{row.title}</p>
          <p className="text-xs text-muted-foreground truncate">{row.reportTypeKey.replace(/_/g, ' ')}</p>
        </div>
      ),
    },
    { key: 'moduleKey', label: t('reports.columnModule'), render: (v) => moduleLabel(v as string) },
    {
      key: 'status',
      label: t('reports.columnStatus'),
      render: (v) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLES[v as GeneratedReportStatus]}`}>
          {t(STATUS_LABEL_KEYS[v as GeneratedReportStatus])}
        </span>
      ),
    },
    { key: 'dueAt', label: t('reports.columnDue'), render: (v) => formatDate(v as string | null) },
    { key: 'createdAt', label: t('reports.columnCreated'), render: (v) => formatDate(v as string) },
    {
      key: 'id',
      label: t('reports.columnActions'),
      align: 'right',
      render: (_v, row) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {canManage && row.status === 'draft' && !PERIODIC_REPORT_TYPE_KEYS.has(row.reportTypeKey) && (
            <button
              onClick={() => handleFinalize(row)}
              disabled={busyId === row.id}
              title={t('reports.finalizeThisReport')}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {busyId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            </button>
          )}
          {canManage && row.status === 'final' && !PERIODIC_REPORT_TYPE_KEYS.has(row.reportTypeKey) && (
            <button
              onClick={() => handleSubmit(row)}
              disabled={busyId === row.id}
              title={t('reports.markAsSubmitted')}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {busyId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">{t('reports.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total === 1 ? t('reports.reportCountSingular', { count: total }) : t('reports.reportCountPlural', { count: total })} · {t('reports.subtitleSuffix')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setBenefitRiskOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <BarChart3 className="h-4 w-4" />
            {t('reports.benefitRiskView')}
          </button>
          {canManage && (
            <>
              <button
                onClick={() => setLineListingOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {t('reports.lineListing')}
              </button>
              <button
                onClick={() => setPeriodicReportOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <FileText className="h-4 w-4" />
                {t('reports.periodicReport')}
              </button>
              <button
                onClick={() => setRegReportOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <ClipboardCheck className="h-4 w-4" />
                {t('reports.regulatoryReport')}
              </button>
              <button
                onClick={() => setCreateOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors"
              >
                <Plus className="h-4 w-4" />
                {t('reports.newReport')}
              </button>
            </>
          )}
        </div>
      </div>

      <ReportingDashboardPanel />

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('reports.module')}</label>
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="all">{t('reports.allModules')}</option>
              {MODULE_OPTIONS.map((m) => (
                <option key={m.key} value={m.key}>
                  {t(m.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('reports.status')}</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="all">{t('reports.allStatuses')}</option>
              <option value="draft">{t('reports.statusDraft')}</option>
              <option value="final">{t('reports.statusFinal')}</option>
              <option value="submitted">{t('reports.statusSubmitted')}</option>
            </select>
          </div>
        </div>
      </div>

      {(error || actionError) && (
        <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error ?? actionError}</div>
      )}

      <DataTableV2
        data={reports}
        columns={columns}
        onRowClick={(row) => openDetail(row)}
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

      {!loading && reports.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            {moduleFilter !== 'all' || statusFilter !== 'all' ? t('reports.noReportsMatchFilters') : t('reports.noReportsYet')}
          </p>
          {canManage && moduleFilter === 'all' && statusFilter === 'all' && (
            <button onClick={() => setCreateOpen(true)} className="mt-3 text-sm font-medium text-safemeds-teal hover:underline">
              {t('reports.createFirstReport')}
            </button>
          )}
        </div>
      )}

      {lineListingOpen && (
        <GenerateLineListingModal
          onClose={() => setLineListingOpen(false)}
          onGenerated={(report) => {
            setReports((prev) => [report, ...prev])
            setTotal((t) => t + 1)
            setLineListingOpen(false)
            setDetail(report)
          }}
        />
      )}

      {periodicReportOpen && (
        <GeneratePeriodicReportModal
          onClose={() => setPeriodicReportOpen(false)}
          onGenerated={(report) => {
            setReports((prev) => [report, ...prev])
            setTotal((t) => t + 1)
            setPeriodicReportOpen(false)
            setDetail(report)
          }}
        />
      )}

      {benefitRiskOpen && <BenefitRiskModal onClose={() => setBenefitRiskOpen(false)} />}

      {regReportOpen && (
        <GenerateRegReportModal
          onClose={() => setRegReportOpen(false)}
          onGenerated={(report) => {
            setReports((prev) => [report, ...prev])
            setTotal((t) => t + 1)
            setRegReportOpen(false)
            setDetail(report)
          }}
        />
      )}

      {createOpen && (
        <Modal title={t('reports.newReportTitle')} onClose={() => setCreateOpen(false)}>
          <CreateReportForm
            onCreated={(created) => {
              setReports((prev) => [created, ...prev])
              setTotal((t) => t + 1)
              setCreateOpen(false)
            }}
            onCancel={() => setCreateOpen(false)}
          />
        </Modal>
      )}

      {detail && (
        <Modal title={detail.title} onClose={() => setDetail(null)} maxWidth="max-w-2xl">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[detail.status]}`}>{t(STATUS_LABEL_KEYS[detail.status])}</span>
              <span className="text-xs text-muted-foreground">{moduleLabel(detail.moduleKey)}</span>
              <span className="text-xs text-muted-foreground">· {detail.reportTypeKey.replace(/_/g, ' ')}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{t('reports.period')}</p>
                <p className="text-foreground">
                  {detail.periodStart || detail.periodEnd ? `${formatDate(detail.periodStart)} – ${formatDate(detail.periodEnd)}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('reports.due')}</p>
                <p className="text-foreground">{formatDate(detail.dueAt)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('reports.created')}</p>
                <p className="text-foreground">{formatDate(detail.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('reports.submitted')}</p>
                <p className="text-foreground">{formatDate(detail.submittedAt)}</p>
              </div>
            </div>

            {'workflowInstanceId' in detail && detail.workflowInstanceId ? (
              <div className="pt-1">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('reports.workflowCaption')}</p>
                <WorkflowActionsPanel
                  workflowInstanceId={detail.workflowInstanceId}
                  onTransitioned={() => {
                    getGeneratedReport(detail.id)
                      .then((full) => setDetail((prev) => (prev && prev.id === full.id ? full : prev)))
                      .catch(() => {})
                  }}
                />
              </div>
            ) : (
              canManage && (
                <div className="flex gap-2 pt-1">
                  {detail.status === 'draft' && (
                    <button
                      onClick={() => handleFinalize(detail)}
                      disabled={busyId === detail.id}
                      className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-2 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
                    >
                      {busyId === detail.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      {t('reports.finalize')}
                    </button>
                  )}
                  {detail.status === 'final' && (
                    <button
                      onClick={() => handleSubmit(detail)}
                      disabled={busyId === detail.id}
                      className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-2 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
                    >
                      {busyId === detail.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      {t('reports.markSubmitted')}
                    </button>
                  )}
                </div>
              )
            )}

            {'workflowInstanceId' in detail && detail.workflowInstanceId && detail.status === 'submitted' && canManage && (
              <div className="pt-2 border-t border-[var(--border)]">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('reports.submissionEvidence')}</p>
                {detail.evidenceDocumentId ? (
                  <p className="flex items-center gap-1.5 text-xs text-status-success">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {t('reports.evidenceAttached')}
                  </p>
                ) : (
                  <>
                    <p className="mb-2 text-xs text-muted-foreground">{t('reports.evidenceHelp')}</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
                        className="block flex-1 text-xs text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
                      />
                      <button
                        onClick={() => evidenceFile && handleAttachEvidence(detail, evidenceFile)}
                        disabled={attachingEvidence || !evidenceFile}
                        className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50 whitespace-nowrap"
                      >
                        {attachingEvidence && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {t('reports.attachEvidence')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="pt-2 border-t border-[var(--border)]">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('reports.reportFile')}</p>
              <DocumentsPanel recordType="generated_report" recordId={detail.id} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function CreateReportForm({ onCreated, onCancel }: { onCreated: (report: GeneratedReport) => void; onCancel: () => void }) {
  const { t } = useTranslation()
  const [moduleKey, setModuleKey] = useState('pv')
  const [reportTypes, setReportTypes] = useState<ReportType[]>([])
  const [reportTypeKey, setReportTypeKey] = useState('')
  const [customReportTypeKey, setCustomReportTypeKey] = useState('')
  const [title, setTitle] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setReportTypeKey('')
    listReportTypes(moduleKey)
      .then(setReportTypes)
      .catch(() => setReportTypes([]))
  }, [moduleKey])

  const effectiveReportTypeKey = reportTypes.length > 0 ? reportTypeKey : customReportTypeKey.trim()
  const canSubmit = title.trim().length > 0 && effectiveReportTypeKey.length > 0

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const created = await createGeneratedReport({
        moduleKey,
        reportTypeKey: effectiveReportTypeKey,
        title: title.trim(),
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
        dueAt: dueAt || undefined,
      })
      onCreated(created)
    } catch (err) {
      setError(getErrorMessage(err, t('reports.errorCreate')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t('reports.moduleFormLabel')}</label>
        <select
          value={moduleKey}
          onChange={(e) => setModuleKey(e.target.value)}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm"
        >
          {MODULE_OPTIONS.map((m) => (
            <option key={m.key} value={m.key}>
              {t(m.labelKey)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t('reports.reportTypeFormLabel')}</label>
        {reportTypes.length > 0 ? (
          <select
            value={reportTypeKey}
            onChange={(e) => setReportTypeKey(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm"
          >
            <option value="">{t('reports.selectReportType')}</option>
            {reportTypes.map((rt) => (
              <option key={rt.typeKey} value={rt.typeKey}>
                {rt.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={customReportTypeKey}
            onChange={(e) => setCustomReportTypeKey(e.target.value)}
            placeholder={t('reports.reportTypeCustomPlaceholder')}
            className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm"
          />
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t('reports.titleLabel')}</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('reports.titlePlaceholder')}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t('reports.periodStart')}</label>
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t('reports.periodEnd')}</label>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t('reports.dueDate')}</label>
        <input
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm"
        />
      </div>

      {error && <p className="text-xs text-status-error">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="px-3 py-2 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text)]">
          {t('reports.cancel')}
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--primary)] text-white text-xs font-medium disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t('reports.createReport')}
        </button>
      </div>
    </div>
  )
}
