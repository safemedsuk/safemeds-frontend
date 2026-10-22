'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, FileSignature, Loader2, Upload } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { uploadDocument } from '@/lib/api/documents'
import {
  attachDistributorTrainingCertificate,
  createDistributorTrainingRecord,
  DistributorTrainingStatus,
  getDistributorTrainingStatus,
} from '@/lib/api/distributor-training'
import { Distributor, listDistributors } from '@/lib/api/reconciliation'
import { activateSdea, attachSdeaDocument, createSdea, getSdeaStatusForDistributor, listSdeas, Sdea, SDEA_STATUS_LABELS, SdeaDistributorStatus, SdeaStatus } from '@/lib/api/sdea'
import { listTrainingTypes, TrainingType } from '@/lib/api/training-types'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const DISTRIBUTOR_STATUS_STYLES: Record<SdeaDistributorStatus, string> = {
  active: 'bg-status-success/10 text-status-success',
  expiring: 'bg-status-warning/10 text-status-warning',
  expired: 'bg-status-error/10 text-status-error',
  missing: 'bg-muted text-muted-foreground',
}

const DISTRIBUTOR_STATUS_LABEL_KEYS: Record<SdeaDistributorStatus, MessageKey> = {
  active: 'sdea.distributorStatusActive',
  expiring: 'sdea.distributorStatusExpiring',
  expired: 'sdea.distributorStatusExpired',
  missing: 'sdea.distributorStatusMissing',
}

/** Real-usage request, 22 Sep 2026 (item 6) — the "trained annually" flag, same style as the SDEA status pill above. */
const TRAINING_STATUS_STYLES: Record<DistributorTrainingStatus, string> = {
  valid: 'bg-status-success/10 text-status-success',
  expiring: 'bg-status-warning/10 text-status-warning',
  expired: 'bg-status-error/10 text-status-error',
  missing: 'bg-muted text-muted-foreground',
}
const TRAINING_STATUS_LABEL_KEYS: Record<DistributorTrainingStatus, MessageKey> = {
  valid: 'sdea.trainingStatusValid',
  expiring: 'sdea.trainingStatusExpiring',
  expired: 'sdea.trainingStatusExpired',
  missing: 'sdea.trainingStatusMissing',
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

interface DistributorRow {
  distributor: Distributor
  status: SdeaDistributorStatus
  trainingStatus: DistributorTrainingStatus
}

/**
 * VigiCloud Stage 16.5 — the SDEA repository, framed around each
 * distributor's own current status (the "reconciliation-at-risk flag"
 * this stage exists to surface) rather than a bare version list.
 */
export function SdeaScreen() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canManage = has('sdea.manage')

  const SDEA_HISTORY_COLUMNS: DataTableColumn<Sdea>[] = [
    { key: 'title', label: t('sdea.columnTitle') },
    { key: 'version', label: t('sdea.columnVersion'), render: (v) => <span className="font-mono text-xs">v{v}</span> },
    { key: 'status', label: t('sdea.columnStatus'), render: (v) => SDEA_STATUS_LABELS[v as SdeaStatus] },
    { key: 'receivedDate', label: t('sdea.columnReceived'), sortable: true, render: (v) => formatDate(v) },
    { key: 'expiryDate', label: t('sdea.columnRenewal'), sortable: true, render: (v) => formatDate(v) },
  ]

  const [rows, setRows] = useState<DistributorRow[]>([])
  const [history, setHistory] = useState<Sdea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showNew, setShowNew] = useState(false)
  const [loggingTrainingFor, setLoggingTrainingFor] = useState<Distributor | null>(null)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyLimit, setHistoryLimit] = useState(10)
  const [historyTotalPages, setHistoryTotalPages] = useState(1)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const distResult = await listDistributors({ limit: 100 })
      const [statuses, trainingStatuses] = await Promise.all([
        Promise.all(distResult.distributors.map((d) => getSdeaStatusForDistributor(d.id))),
        Promise.all(distResult.distributors.map((d) => getDistributorTrainingStatus(d.id))),
      ])
      setRows(
        distResult.distributors.map((d, i) => ({
          distributor: d,
          status: statuses[i].status,
          trainingStatus: trainingStatuses[i].status,
        })),
      )
    } catch (err) {
      setError(getErrorMessage(err, t('sdea.errorLoad')))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadHistory = useCallback(
    async (page = historyPage, limit = historyLimit) => {
      setHistoryLoading(true)
      try {
        const { sdeas, meta } = await listSdeas(page, limit)
        setHistory(sdeas)
        setHistoryTotalPages(meta.totalPages)
        setHistoryTotal(meta.total)
      } catch (err) {
        setError(getErrorMessage(err, t('sdea.errorLoadHistory')))
      } finally {
        setHistoryLoading(false)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [historyPage, historyLimit],
  )

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    loadHistory(historyPage, historyLimit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyPage, historyLimit])

  const handleHistoryRowsPerPageChange = (n: number) => {
    setHistoryLimit(n)
    setHistoryPage(1)
  }

  const atRiskCount = rows.filter((r) => r.status === 'expiring' || r.status === 'expired' || r.status === 'missing').length
  const untrainedCount = rows.filter((r) => r.trainingStatus === 'expiring' || r.trainingStatus === 'expired' || r.trainingStatus === 'missing').length

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <FileSignature className="h-6 w-6 text-safemeds-teal" />
            <h1 className="text-3xl font-display font-bold text-foreground">{t('sdea.title')}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t('sdea.subtitle')}</p>
        </div>
        {canManage && (
          <button onClick={() => setShowNew(true)} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce">
            {t('sdea.newRenewSdea')}
          </button>
        )}
      </div>

      {atRiskCount > 0 && (
        <div className="rounded-lg border border-status-warning bg-status-warning/10 p-4 text-sm text-status-warning flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          {atRiskCount === 1 ? t('sdea.atRiskSingular', { count: atRiskCount }) : t('sdea.atRiskPlural', { count: atRiskCount })}
        </div>
      )}

      {/* Real-usage request, 22 Sep 2026 (item 6) — proof distributors are actually trained annually. */}
      {untrainedCount > 0 && (
        <div className="rounded-lg border border-status-warning bg-status-warning/10 p-4 text-sm text-status-warning flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          {untrainedCount === 1 ? t('sdea.untrainedSingular', { count: untrainedCount }) : t('sdea.untrainedPlural', { count: untrainedCount })}
        </div>
      )}

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <FileSignature className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{t('sdea.noDistributorsYet')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">{t('sdea.columnDistributor')}</th>
                <th className="p-3">{t('sdea.columnSdeaStatus')}</th>
                <th className="p-3">{t('sdea.columnTrainingStatus')}</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.distributor.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium text-foreground">{r.distributor.name}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DISTRIBUTOR_STATUS_STYLES[r.status]}`}>{t(DISTRIBUTOR_STATUS_LABEL_KEYS[r.status])}</span>
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TRAINING_STATUS_STYLES[r.trainingStatus]}`}>{t(TRAINING_STATUS_LABEL_KEYS[r.trainingStatus])}</span>
                  </td>
                  <td className="p-3 text-right">
                    {canManage && (
                      <button onClick={() => setLoggingTrainingFor(r.distributor)} className="text-xs font-medium text-safemeds-teal hover:underline whitespace-nowrap">
                        {t('sdea.logTraining')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">{t('sdea.versionHistory')}</h2>
        {!historyLoading && history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{t('sdea.noVersionsYet')}</p>
        ) : (
          <DataTableV2<Sdea>
            data={history}
            columns={SDEA_HISTORY_COLUMNS}
            searchable={false}
            exportable={false}
            showDensityToggle={false}
            loading={historyLoading}
            page={historyPage}
            totalPages={historyTotalPages}
            totalCount={historyTotal}
            onPageChange={setHistoryPage}
            rowsPerPage={historyLimit}
            onRowsPerPageChange={handleHistoryRowsPerPageChange}
          />
        )}
      </div>

      {showNew && (
        <NewSdeaModal
          distributors={rows.map((r) => r.distributor)}
          onClose={() => setShowNew(false)}
          onDone={() => {
            setShowNew(false)
            setNotice(t('sdea.sdeaActivated'))
            load()
            setHistoryPage(1)
            loadHistory(1, historyLimit)
          }}
        />
      )}

      {loggingTrainingFor && (
        <LogDistributorTrainingModal
          distributor={loggingTrainingFor}
          onClose={() => setLoggingTrainingFor(null)}
          onDone={() => {
            setLoggingTrainingFor(null)
            setNotice(t('sdea.trainingLogged'))
            load()
          }}
        />
      )}
    </div>
  )
}

function NewSdeaModal({ distributors, onClose, onDone }: { distributors: Distributor[]; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation()
  const [step, setStep] = useState<'details' | 'upload'>('details')
  const [distributorId, setDistributorId] = useState('')
  const [title, setTitle] = useState('')
  const [counterpartyName, setCounterpartyName] = useState('')
  const [receivedDate, setReceivedDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [draftId, setDraftId] = useState<string | null>(null)
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const detailsValid = distributorId && title.trim().length > 0 && counterpartyName.trim().length > 0

  const handleCreateDraft = async () => {
    if (!detailsValid) return
    setSubmitting(true)
    setError(null)
    try {
      const draft = await createSdea({
        distributorId,
        title: title.trim(),
        counterpartyName: counterpartyName.trim(),
        receivedDate: receivedDate || undefined,
        expiryDate: expiryDate || undefined,
      })
      setDraftId(draft.id)
      setStep('upload')
    } catch (err) {
      setError(getErrorMessage(err, t('sdea.errorCreateDraft')))
    } finally {
      setSubmitting(false)
    }
  }

  const handleFileSelected = async (file: File) => {
    if (!draftId) return
    setUploading(true)
    setError(null)
    try {
      const version = await uploadDocument('sdea', draftId, file, { title: 'Signed SDEA' })
      await attachSdeaDocument(draftId, version.documentId)
      setDocumentId(version.documentId)
    } catch (err) {
      setError(getErrorMessage(err, t('sdea.errorUploadDocument')))
    } finally {
      setUploading(false)
    }
  }

  const handleActivate = async () => {
    if (!draftId) return
    setSubmitting(true)
    setError(null)
    try {
      await activateSdea(draftId)
      onDone()
    } catch (err) {
      setError(getErrorMessage(err, t('sdea.errorActivate')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">{t('sdea.newRenewSdeaModalTitle')}</h2>

        {step === 'details' ? (
          <>
            <div>
              <label className={labelClass}>{t('sdea.distributor')}</label>
              <select value={distributorId} onChange={(e) => setDistributorId(e.target.value)} className={inputClass}>
                <option value="">{t('sdea.select')}</option>
                {distributors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('sdea.titleField')}</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('sdea.titlePlaceholder')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('sdea.counterpartyName')}</label>
              <input value={counterpartyName} onChange={(e) => setCounterpartyName(e.target.value)} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t('sdea.dateReceived')}</label>
                <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('sdea.renewalExpiryDate')}</label>
                <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className={inputClass} />
              </div>
            </div>

            {error && <p className="text-sm text-status-error">{error}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
                {t('sdea.cancel')}
              </button>
              <button
                onClick={handleCreateDraft}
                disabled={!detailsValid || submitting}
                className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('sdea.next')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t('sdea.uploadSignedAgreementHelp')}</p>
            {documentId ? (
              <p className="text-sm text-status-success">{t('sdea.documentAttached')}</p>
            ) : (
              <label className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground cursor-pointer hover:bg-muted">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {t('sdea.uploadSignedSdea')}
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileSelected(file)
                  }}
                />
              </label>
            )}

            {error && <p className="text-sm text-status-error">{error}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
                {t('sdea.cancel')}
              </button>
              <button
                onClick={handleActivate}
                disabled={!documentId || submitting}
                title={!documentId ? t('sdea.uploadDocumentFirst') : undefined}
                className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-40"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('sdea.activate')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Real-usage request, 22 Sep 2026 (item 6) — "proof distributors are
 * actually trained annually; should essentially be a record
 * checklist." One log entry per training event, with an optional
 * certificate upload as the real evidence — the certificate can be
 * attached later too (not required to log the training itself), since
 * a completed training and a scanned certificate often arrive at
 * different times in practice.
 */
function LogDistributorTrainingModal({
  distributor,
  onClose,
  onDone,
}: {
  distributor: Distributor
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [trainingType, setTrainingType] = useState('pv_annual')
  // QualCloud Phase 1 Pass B (item A5 / D-series) — the training type is picked by name from the catalogue; the stored value is its key.
  const [trainingTypeOptions, setTrainingTypeOptions] = useState<TrainingType[]>([])
  useEffect(() => {
    listTrainingTypes().then(setTrainingTypeOptions).catch(() => setTrainingTypeOptions([]))
  }, [])
  const [title, setTitle] = useState('')
  const [completionDate, setCompletionDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [recordId, setRecordId] = useState<string | null>(null)
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const detailsValid = title.trim().length > 0 && completionDate.length > 0

  const handleLog = async () => {
    if (!detailsValid) return
    setSubmitting(true)
    setError(null)
    try {
      const record = await createDistributorTrainingRecord({
        distributorId: distributor.id,
        trainingType,
        title: title.trim(),
        completionDate,
        expiryDate: expiryDate || undefined,
      })
      setRecordId(record.id)
    } catch (err) {
      setError(getErrorMessage(err, t('sdea.errorLogTraining')))
    } finally {
      setSubmitting(false)
    }
  }

  const handleFileSelected = async (file: File) => {
    if (!recordId) return
    setUploading(true)
    setError(null)
    try {
      const version = await uploadDocument('distributor_training_record', recordId, file, { title: 'Training certificate' })
      await attachDistributorTrainingCertificate(recordId, version.documentId)
      setDocumentId(version.documentId)
    } catch (err) {
      setError(getErrorMessage(err, t('sdea.errorUploadCertificate')))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">{t('sdea.logTrainingTitle', { name: distributor.name })}</h2>

        {!recordId ? (
          <>
            <div>
              <label className={labelClass}>{t('sdea.trainingType')}</label>
              <select value={trainingType} onChange={(e) => setTrainingType(e.target.value)} className={inputClass}>
                {trainingTypeOptions.length === 0 && <option value={trainingType}>{trainingType}</option>}
                {trainingTypeOptions.map((tt) => (
                  <option key={tt.id} value={tt.typeKey}>
                    {tt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('sdea.titleField')}</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Annual PV/Reporting-Obligations Training 2026" className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t('sdea.completionDate')}</label>
                <input type="date" value={completionDate} onChange={(e) => setCompletionDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('sdea.renewalDue')}</label>
                <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className={inputClass} />
                <p className="mt-1 text-xs text-muted-foreground">{t('sdea.leaveBlankIfNoExpiry')}</p>
              </div>
            </div>

            {error && <p className="text-sm text-status-error">{error}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
                {t('sdea.cancel')}
              </button>
              <button
                onClick={handleLog}
                disabled={!detailsValid || submitting}
                className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('sdea.logTraining')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-status-success">{t('sdea.trainingLogged')}</p>
            <p className="text-sm text-muted-foreground">{t('sdea.optionallyAttachCertificate')}</p>
            {documentId ? (
              <p className="text-sm text-status-success">{t('sdea.certificateAttached')}</p>
            ) : (
              <label className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground cursor-pointer hover:bg-muted">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {t('sdea.uploadCertificate')}
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileSelected(file)
                  }}
                />
              </label>
            )}

            {error && <p className="text-sm text-status-error">{error}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onDone} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce">
                {t('sdea.done')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
