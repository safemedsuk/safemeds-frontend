'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, ClipboardCheck, FileText, Gavel, Loader2, Plus, Upload } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  addAuditFinding,
  AUDIT_FINDING_SEVERITY_LABELS,
  AUDIT_SCOPE_LABELS,
  AuditFinding,
  AuditFindingSeverity,
  CHECKLIST_RESPONSE_STATUS_LABELS,
  ChecklistResponseStatus,
  createRegulatoryInspectionResponse,
  InternalAuditChecklistResponse,
  InternalAuditStatus,
  InternalAuditWithFindings,
  INTERNAL_AUDIT_STATUS_LABELS,
  getInternalAudit,
  listAuditChecklist,
  listRegulatoryInspectionResponses,
  RegulatoryInspectionResponse,
  respondToChecklistItem,
  startAuditConduct,
  submitRegulatoryInspectionResponse,
  updateInternalAudit,
} from '@/lib/api/internal-audits'
import { OpenCapaModal } from '@/components/internal-audits/open-capa-modal'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { useTranslation } from '@/lib/i18n/use-translation'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-status-error/10 text-status-error',
  major: 'bg-status-warning/10 text-status-warning',
  minor: 'bg-status-info/10 text-status-info',
  observation: 'bg-muted text-muted-foreground',
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

interface Props {
  auditId: string
}

export function InternalAuditDetail({ auditId }: Props) {
  const router = useRouter()
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canManage = has('quality.manage_capa')

  const [audit, setAudit] = useState<InternalAuditWithFindings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showFinding, setShowFinding] = useState(false)
  const [openingCapaFor, setOpeningCapaFor] = useState<AuditFinding | null>(null)

  // `silent` refreshes must never re-show the spinner — see
  // `pv-case-detail.tsx`'s identical fix for the full reasoning.
  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      setError(null)
      try {
        setAudit(await getInternalAudit(auditId))
      } catch (err) {
        setError(getErrorMessage(err, t('internalAuditDetail.errorLoadAudit')))
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [auditId, t],
  )

  const refresh = useCallback(() => load(true), [load])

  useEffect(() => {
    load()
  }, [load])

  const handleStatusChange = async (status: InternalAuditStatus) => {
    if (!audit) return
    try {
      const updated = await updateInternalAudit(audit.id, { status })
      setAudit({ ...audit, ...updated })
      setNotice(t('internalAuditDetail.statusUpdated', { status: INTERNAL_AUDIT_STATUS_LABELS[status] }))
    } catch (err) {
      setError(getErrorMessage(err, t('internalAuditDetail.errorUpdateStatus')))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !audit) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error ?? t('internalAuditDetail.auditNotFound')}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <button onClick={() => router.push('/internal-audits')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t('internalAuditDetail.backToAudits')}
      </button>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Gavel className="h-6 w-6 text-safemeds-teal" />
            <h1 className="text-2xl font-display font-bold text-foreground">{audit.title}</h1>
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span>{t('internalAuditDetail.scheduled', { date: formatDate(audit.scheduledDate) })}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">{AUDIT_SCOPE_LABELS[audit.auditScope]}</span>
          </div>
          {audit.scope && <p className="mt-2 text-sm text-foreground">{audit.scope}</p>}
        </div>
        {canManage ? (
          <select value={audit.status} onChange={(e) => handleStatusChange(e.target.value as InternalAuditStatus)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground">
            {Object.entries(INTERNAL_AUDIT_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        ) : (
          <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-foreground">{INTERNAL_AUDIT_STATUS_LABELS[audit.status]}</span>
        )}
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}

      {audit.auditScope === 'regulatory' ? (
        <RegulatoryResponsePanel auditId={audit.id} canManage={canManage} />
      ) : (
        <ChecklistConductPanel auditId={audit.id} canManage={canManage} />
      )}

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">{t('internalAuditDetail.findings')}</h2>
          {canManage && (
            <button
              onClick={() => setShowFinding(true)}
              className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce"
            >
              <Plus className="h-3.5 w-3.5" /> {t('internalAuditDetail.logFinding')}
            </button>
          )}
        </div>

        {audit.findings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{t('internalAuditDetail.noFindingsForAudit')}</p>
        ) : (
          <div className="space-y-2">
            {audit.findings.map((f) => (
              <div key={f.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLES[f.severity]}`}>{AUDIT_FINDING_SEVERITY_LABELS[f.severity as AuditFindingSeverity]}</span>
                  <span className="text-xs text-muted-foreground capitalize">{f.status.replace('_', ' ')}</span>
                </div>
                <p className="mt-2 text-sm text-foreground">{f.description}</p>
                {f.status === 'open' && canManage && (
                  <button
                    onClick={() => setOpeningCapaFor(f)}
                    className="mt-2 flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" /> {t('internalAudits.openCapa')}
                  </button>
                )}
                {f.status === 'capa_assigned' && (
                  <p className="mt-2 text-xs text-muted-foreground">{t('internalAuditDetail.capaAssignedNote')}</p>
                )}
                {f.status === 'closed' && <p className="mt-2 text-xs text-status-success">{t('internalAuditDetail.closedNote')}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {showFinding && (
        <LogFindingModal
          auditId={audit.id}
          onClose={() => setShowFinding(false)}
          onLogged={() => {
            setShowFinding(false)
            setNotice(t('internalAuditDetail.findingLogged'))
            refresh()
          }}
        />
      )}

      {openingCapaFor && (
        <OpenCapaModal
          findingId={openingCapaFor.id}
          onClose={() => setOpeningCapaFor(null)}
          onOpened={() => {
            setOpeningCapaFor(null)
            setNotice(t('internalAuditDetail.capaOpenedLinked'))
            refresh()
          }}
        />
      )}
    </div>
  )
}

function LogFindingModal({ auditId, onClose, onLogged }: { auditId: string; onClose: () => void; onLogged: () => void }) {
  const { t } = useTranslation()
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<AuditFindingSeverity>('minor')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = description.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await addAuditFinding(auditId, { description: description.trim(), severity })
      onLogged()
    } catch (err) {
      setError(getErrorMessage(err, t('internalAuditDetail.errorLogFinding')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">{t('internalAuditDetail.logFinding')}</h2>

        <div>
          <label className={labelClass}>{t('internalAuditDetail.descriptionRequired')}</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t('internalAudits.columnSeverity')}</label>
          <select value={severity} onChange={(e) => setSeverity(e.target.value as AuditFindingSeverity)} className={inputClass}>
            {Object.entries(AUDIT_FINDING_SEVERITY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('internalAuditDetail.logFinding')}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * QualCloud (Phase 13) Stage 9 — "check off each real inspection item
 * live against the template, attach observations." A checklist is
 * only instantiated on demand ("Start Conduct") since a scheduled
 * audit may never actually run.
 */
function ChecklistConductPanel({ auditId, canManage }: { auditId: string; canManage: boolean }) {
  const { t } = useTranslation()
  const [items, setItems] = useState<InternalAuditChecklistResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    listAuditChecklist(auditId)
      .then(setItems)
      .catch((err) => setError(getErrorMessage(err, t('internalAuditDetail.errorLoadChecklist'))))
      .finally(() => setLoading(false))
  }, [auditId, t])

  useEffect(load, [load])

  const handleStart = async () => {
    setStarting(true)
    setError(null)
    try {
      await startAuditConduct(auditId)
      load()
    } catch (err) {
      setError(getErrorMessage(err, t('internalAuditDetail.errorStartConduct')))
    } finally {
      setStarting(false)
    }
  }

  const handleRespond = async (responseId: string, status: ChecklistResponseStatus, observations: string) => {
    try {
      await respondToChecklistItem(auditId, responseId, { status, observations: observations.trim() || undefined })
      load()
    } catch (err) {
      setError(getErrorMessage(err, t('internalAuditDetail.errorSaveChecklistItem')))
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-safemeds-teal" />
          <h2 className="text-sm font-semibold text-foreground">{t('internalAuditDetail.inspectionChecklist')}</h2>
        </div>
        {canManage && items.length === 0 && !loading && (
          <button onClick={handleStart} disabled={starting} className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
            {starting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t('internalAuditDetail.startConduct')}
          </button>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-status-error">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">{t('internalAuditDetail.notStartedYet')}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <ChecklistItemRow key={item.id} item={item} canManage={canManage} onRespond={handleRespond} />
          ))}
        </div>
      )}
    </div>
  )
}

function ChecklistItemRow({
  item,
  canManage,
  onRespond,
}: {
  item: InternalAuditChecklistResponse
  canManage: boolean
  onRespond: (responseId: string, status: ChecklistResponseStatus, observations: string) => void
}) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<ChecklistResponseStatus>(item.status)
  const [observations, setObservations] = useState(item.observations ?? '')

  const STATUS_STYLES: Record<ChecklistResponseStatus, string> = {
    not_reviewed: 'bg-muted text-muted-foreground',
    compliant: 'bg-status-success/10 text-status-success',
    non_compliant: 'bg-status-error/10 text-status-error',
    not_applicable: 'bg-muted text-muted-foreground',
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{item.checklistTemplate.title}</p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[item.status]}`}>{CHECKLIST_RESPONSE_STATUS_LABELS[item.status]}</span>
      </div>
      {item.checklistTemplate.description && <p className="mt-1 text-xs text-muted-foreground">{item.checklistTemplate.description}</p>}
      {canManage && (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
          <select value={status} onChange={(e) => setStatus(e.target.value as ChecklistResponseStatus)} className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground">
            {Object.entries(CHECKLIST_RESPONSE_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <input
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder={t('internalAuditDetail.observationsPlaceholder')}
            className="flex-1 rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground"
          />
          <button onClick={() => onRespond(item.id, status, observations)} className="rounded-lg border border-safemeds-teal px-3 py-1.5 text-xs font-medium text-safemeds-teal hover:bg-safemeds-teal/10">
            {t('common.save')}
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * QualCloud (Phase 13) Stage 9 — the regulatory-scope "prepare, host,
 * respond" half: PPB raises a finding while inspecting us, and this is
 * the tracked response, with its own deadline and evidence pack.
 */
function RegulatoryResponsePanel({ auditId, canManage }: { auditId: string; canManage: boolean }) {
  const { t } = useTranslation()
  const [responses, setResponses] = useState<RegulatoryInspectionResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [showOpen, setShowOpen] = useState(false)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    listRegulatoryInspectionResponses(auditId)
      .then(setResponses)
      .catch((err) => setError(getErrorMessage(err, t('internalAuditDetail.errorLoadRegResponses'))))
      .finally(() => setLoading(false))
  }, [auditId, t])

  useEffect(load, [load])

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-safemeds-teal" />
          <h2 className="text-sm font-semibold text-foreground">{t('internalAuditDetail.regulatoryInspectionResponses')}</h2>
        </div>
        {canManage && (
          <button onClick={() => setShowOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white">
            <Plus className="h-3.5 w-3.5" /> {t('internalAuditDetail.openResponse')}
          </button>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-status-error">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : responses.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">{t('internalAuditDetail.noRegResponseYet')}</p>
      ) : (
        <div className="space-y-2">
          {responses.map((r) => (
            <div key={r.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-foreground">{t('internalAuditDetail.due', { date: formatDate(r.responseDueDate) })}</p>
                {r.submittedAt ? (
                  <span className="flex items-center gap-1 text-xs text-status-success">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {t('internalAuditDetail.submitted', { date: formatDate(r.submittedAt) })}
                  </span>
                ) : (
                  canManage && (
                    <button onClick={() => setSubmittingId(r.id)} className="flex items-center gap-1 text-xs font-medium text-status-warning hover:underline">
                      <Upload className="h-3.5 w-3.5" /> {t('internalAuditDetail.submitResponse')}
                    </button>
                  )
                )}
              </div>
              {r.responseText && <p className="mt-2 text-sm text-foreground">{r.responseText}</p>}
            </div>
          ))}
        </div>
      )}

      {showOpen && (
        <OpenRegulatoryResponseModal
          auditId={auditId}
          onClose={() => setShowOpen(false)}
          onOpened={() => {
            setShowOpen(false)
            load()
          }}
        />
      )}

      {submittingId && (
        <SubmitRegulatoryResponseModal
          auditId={auditId}
          responseId={submittingId}
          onClose={() => setSubmittingId(null)}
          onSubmitted={() => {
            setSubmittingId(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function OpenRegulatoryResponseModal({ auditId, onClose, onOpened }: { auditId: string; onClose: () => void; onOpened: () => void }) {
  const { t } = useTranslation()
  const [responseDueDate, setResponseDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await createRegulatoryInspectionResponse(auditId, { responseDueDate: responseDueDate || undefined })
      onOpened()
    } catch (err) {
      setError(getErrorMessage(err, t('internalAuditDetail.errorOpenResponse')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">{t('internalAuditDetail.openRegulatoryResponseTitle')}</h2>
        <div>
          <label className={labelClass}>{t('internalAuditDetail.responseDueDateLabel')}</label>
          <input type="date" value={responseDueDate} onChange={(e) => setResponseDueDate(e.target.value)} className={inputClass} />
        </div>
        {error && <p className="text-sm text-status-error">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">{t('common.cancel')}</button>
          <button onClick={handleSubmit} disabled={submitting} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('internalAuditDetail.open')}
          </button>
        </div>
      </div>
    </div>
  )
}

function SubmitRegulatoryResponseModal({
  auditId,
  responseId,
  onClose,
  onSubmitted,
}: {
  auditId: string
  responseId: string
  onClose: () => void
  onSubmitted: () => void
}) {
  const { t } = useTranslation()
  const [responseText, setResponseText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = responseText.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await submitRegulatoryInspectionResponse(auditId, responseId, responseText.trim(), file ?? undefined)
      onSubmitted()
    } catch (err) {
      setError(getErrorMessage(err, t('internalAuditDetail.errorSubmitResponse')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">{t('internalAuditDetail.submitRegulatoryResponseTitle')}</h2>
        <div>
          <label className={labelClass}>{t('internalAuditDetail.responseRequired')}</label>
          <textarea value={responseText} onChange={(e) => setResponseText(e.target.value)} rows={4} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t('internalAuditDetail.evidenceOptional')}</label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input px-3 py-2 text-xs text-muted-foreground">
            <Upload className="h-3.5 w-3.5" /> {file ? file.name : t('internalAuditDetail.attachEvidence')}
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        {error && <p className="text-sm text-status-error">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">{t('common.cancel')}</button>
          <button onClick={handleSubmit} disabled={!isValid || submitting} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('common.submit')}
          </button>
        </div>
      </div>
    </div>
  )
}
