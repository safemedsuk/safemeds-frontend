'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import { ClipboardCheck, Loader2, Plus, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  createValidationProtocol,
  createValidationReport,
  finalizeValidationReport,
  listValidationProtocols,
  listValidationReports,
  ValidationProtocol,
  ValidationReport,
  ValidationType,
} from '@/lib/api/quality'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const VALIDATION_TYPE_LABEL_KEYS: Record<ValidationType, MessageKey> = {
  process: 'qualityValidation.typeProcess',
  cleaning: 'qualityValidation.typeCleaning',
  analytical_method: 'qualityValidation.typeAnalyticalMethod',
  computer_system: 'qualityValidation.typeComputerSystem',
}

const DOCUMENT_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-foreground',
  in_review: 'bg-status-info/10 text-status-info',
  approved: 'bg-status-warning/10 text-status-warning',
  effective: 'bg-status-success/10 text-status-success',
  superseded: 'bg-muted text-muted-foreground',
  retired: 'bg-status-error/10 text-status-error',
}

/**
 * QualCloud (Phase 13) Stage 18 — Validation (Process/Cleaning/Method)
 * and Computer System Validation. A protocol *is* a controlled
 * document — its lifecycle (Draft → In Review → Approved → Effective)
 * is driven through the exact same `quality_controlled_document`
 * workflow every other SOP uses, visible here via `protocolDocument
 * .status`. Use the Controlled Documents screen to actually transition
 * a protocol's document through review/approval — this screen focuses
 * on drafting protocols and recording execution/conclusion once one is
 * effective.
 */
export function QualityValidationScreen() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canView = has('quality.view_all')
  const canDraft = has('quality.manage_documents')
  const canManage = has('quality.manage_validation')

  const [protocols, setProtocols] = useState<ValidationProtocol[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showCreate, setShowCreate] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listValidationProtocols({ page: 1, limit: 50 })
      .then((res) => setProtocols(res.rows))
      .catch((err) => setError(getErrorMessage(err, t('qualityValidation.errorLoad'))))
      .finally(() => setLoading(false))
  }, [t])

  useEffect(load, [load])

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">{t('qualityValidation.title')}</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{t('qualityValidation.noPermission')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">{t('qualityValidation.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('qualityValidation.subtitle')}</p>
        </div>
        {canDraft && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors">
            <Plus className="h-4 w-4" /> {t('qualityValidation.draftProtocol')}
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
        ) : protocols.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardCheck className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{t('qualityValidation.noProtocolsYet')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">{t('qualityValidation.columnTitle')}</th>
                <th className="p-3">{t('qualityValidation.columnType')}</th>
                <th className="p-3">{t('qualityValidation.columnDocumentNumber')}</th>
                <th className="p-3">{t('qualityValidation.columnDocumentStatus')}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {protocols.map((p) => (
                <Fragment key={p.id}>
                  <tr className="border-b border-border last:border-0">
                    <td className="p-3 text-foreground font-medium">{p.title}</td>
                    <td className="p-3 text-muted-foreground text-xs">{t(VALIDATION_TYPE_LABEL_KEYS[p.validationType])}</td>
                    <td className="p-3 text-muted-foreground font-mono text-xs">{p.protocolDocument.documentNumber}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${DOCUMENT_STATUS_STYLES[p.protocolDocument.status] ?? 'bg-muted text-foreground'}`}>
                        {p.protocolDocument.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3">
                      <button onClick={() => setExpanded(expanded === p.id ? null : p.id)} className="text-xs font-medium text-safemeds-teal hover:underline">
                        {expanded === p.id ? t('qualityValidation.hideReports') : t('qualityValidation.executionAndReports')}
                      </button>
                    </td>
                  </tr>
                  {expanded === p.id && (
                    <tr>
                      <td colSpan={5} className="bg-muted/30 p-4">
                        <ProtocolReports protocol={p} canManage={canManage} onChanged={() => setNotice(t('qualityValidation.updatedNotice'))} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateProtocolModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            setNotice(t('qualityValidation.draftedNotice'))
            load()
          }}
        />
      )}
    </div>
  )
}

function ProtocolReports({
  protocol,
  canManage,
  onChanged,
}: {
  protocol: ValidationProtocol
  canManage: boolean
  onChanged: () => void
}) {
  const { t } = useTranslation()
  const [reports, setReports] = useState<ValidationReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [conclusion, setConclusion] = useState('validated')

  const load = useCallback(() => {
    setLoading(true)
    listValidationReports(protocol.id)
      .then(setReports)
      .catch((err) => setError(getErrorMessage(err, t('qualityValidation.errorLoadReports'))))
      .finally(() => setLoading(false))
  }, [protocol.id, t])

  useEffect(load, [load])

  const isEffective = protocol.protocolDocument.status === 'effective'

  const handleRecord = async () => {
    setError(null)
    try {
      await createValidationReport(protocol.id, { conclusion })
      onChanged()
      load()
    } catch (err) {
      setError(getErrorMessage(err, t('qualityValidation.errorRecordExecution')))
    }
  }

  const conclusionLabel = (value: string | null): string => {
    if (!value) return t('qualityValidation.noConclusionYet')
    if (value === 'validated') return t('qualityValidation.validated')
    if (value === 'not_validated') return t('qualityValidation.notValidated')
    if (value === 'conditionally_validated') return t('qualityValidation.conditionallyValidated')
    return value.replace(/_/g, ' ')
  }

  return (
    <div className="space-y-3">
      {!isEffective && (
        <p className="text-xs text-muted-foreground">
          {t('qualityValidation.effectiveRequiredPrefix')} <strong>{t('qualityValidation.effectiveBold')}</strong>{' '}
          {t('qualityValidation.effectiveRequiredSuffix')}
        </p>
      )}
      {error && <p className="text-xs text-status-error">{error}</p>}
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : reports.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('qualityValidation.noExecutionYet')}</p>
      ) : (
        <ul className="space-y-1.5 text-xs">
          {reports.map((r) => (
            <li key={r.id} className="flex items-center justify-between">
              <span className="text-foreground capitalize">{conclusionLabel(r.conclusion)}</span>
              {canManage && (
                <select
                  defaultValue={r.conclusion ?? ''}
                  onChange={async (e) => {
                    await finalizeValidationReport(r.id, { conclusion: e.target.value })
                    onChanged()
                    load()
                  }}
                  className="rounded border border-input bg-background px-2 py-1 text-xs"
                >
                  <option value="validated">{t('qualityValidation.validated')}</option>
                  <option value="not_validated">{t('qualityValidation.notValidated')}</option>
                  <option value="conditionally_validated">{t('qualityValidation.conditionallyValidated')}</option>
                </select>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && isEffective && (
        <div className="flex items-center gap-2">
          <select value={conclusion} onChange={(e) => setConclusion(e.target.value)} className="rounded border border-input bg-background px-2 py-1 text-xs">
            <option value="validated">{t('qualityValidation.validated')}</option>
            <option value="not_validated">{t('qualityValidation.notValidated')}</option>
            <option value="conditionally_validated">{t('qualityValidation.conditionallyValidated')}</option>
          </select>
          <button onClick={handleRecord} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
            {t('qualityValidation.recordExecution')}
          </button>
        </div>
      )}
    </div>
  )
}

function CreateProtocolModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [validationType, setValidationType] = useState<ValidationType>('process')
  const [approach, setApproach] = useState('traditional_three_batch')
  const [gampCategory, setGampCategory] = useState('4_configured')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = title.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await createValidationProtocol({
        title: title.trim(),
        validationType,
        approach: validationType === 'process' ? approach : undefined,
        gampCategory: validationType === 'computer_system' ? gampCategory : undefined,
      })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, t('qualityValidation.errorDraft')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 space-y-4 my-8">
        <h2 className="font-display font-bold text-lg text-foreground">{t('qualityValidation.draftModalTitle')}</h2>

        <div>
          <label className={labelClass}>{t('qualityValidation.titleField')}</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder={t('qualityValidation.titlePlaceholder')} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t('qualityValidation.validationTypeField')}</label>
            <select value={validationType} onChange={(e) => setValidationType(e.target.value as ValidationType)} className={inputClass}>
              {Object.entries(VALIDATION_TYPE_LABEL_KEYS).map(([key, labelKey]) => (
                <option key={key} value={key}>{t(labelKey)}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground md:col-span-2">
            {t('qualityValidation.docNumberAutoNote')}
          </p>
        </div>

        {validationType === 'process' && (
          <div>
            <label className={labelClass}>{t('qualityValidation.approach')}</label>
            <select value={approach} onChange={(e) => setApproach(e.target.value)} className={inputClass}>
              <option value="traditional_three_batch">{t('qualityValidation.approachTraditional')}</option>
              <option value="continued_process_verification">{t('qualityValidation.approachContinued')}</option>
            </select>
          </div>
        )}

        {validationType === 'computer_system' && (
          <div>
            <label className={labelClass}>{t('qualityValidation.gampCategory')}</label>
            <select value={gampCategory} onChange={(e) => setGampCategory(e.target.value)} className={inputClass}>
              <option value="1_infrastructure">{t('qualityValidation.gampCategory1')}</option>
              <option value="3_non_configured">{t('qualityValidation.gampCategory3')}</option>
              <option value="4_configured">{t('qualityValidation.gampCategory4')}</option>
              <option value="5_custom">{t('qualityValidation.gampCategory5')}</option>
            </select>
          </div>
        )}

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
            {t('qualityValidation.draft')}
          </button>
        </div>
      </div>
    </div>
  )
}
