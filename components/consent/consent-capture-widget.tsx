'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck, ShieldOff, ShieldQuestion } from 'lucide-react'
import { ApiRequestError } from '@/lib/api/client'
import {
  captureConsent,
  checkConsent,
  withdrawConsent,
  type ConsentCheckResult,
  type ConsentMethod,
  type ConsentType,
} from '@/lib/api/consent'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

interface Props {
  recordType: string
  recordId: string
  consentType: ConsentType
  /** e.g. "Contact consent" — defaults to a label derived from `consentType`. */
  label?: string
}

const CONSENT_TYPE_LABEL_KEYS: Record<ConsentType, MessageKey> = {
  report: 'pvCaseDetail.reportConsentLabel',
  contact: 'consentWidget.contactConsent',
  data_privacy: 'consentWidget.dataPrivacyConsent',
}

/**
 * VigiCloud Stage 0.1 — a reusable consent-capture widget over the base
 * engine's generic `ConsentRecord` primitive. No live case-intake screen
 * consumes this yet (that's VigiCloud Stage 3) — any page can already
 * drop this in against a real `recordType`/`recordId` today, since the
 * backend primitive itself is already real, not a mock.
 */
export function ConsentCaptureWidget({ recordType, recordId, consentType, label }: Props) {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canManage = has('consent.manage')

  const [status, setStatus] = useState<ConsentCheckResult | null>(null)
  const [method, setMethod] = useState<ConsentMethod>('written')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useTimedMessage()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await checkConsent(recordType, recordId, consentType)
      setStatus(result)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t('consentWidget.errorLoadStatus'))
    } finally {
      setLoading(false)
    }
  }, [recordType, recordId, consentType, t])

  useEffect(() => {
    load()
  }, [load])

  const handleCapture = async (granted: boolean) => {
    setBusy(true)
    setError(null)
    try {
      await captureConsent(recordType, recordId, consentType, granted, method)
      setSuccess(granted ? t('consentWidget.consentCaptured') : t('consentWidget.declineRecorded'))
      await load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t('consentWidget.errorCapture'))
    } finally {
      setBusy(false)
    }
  }

  const handleWithdraw = async () => {
    if (!status?.record) return
    setBusy(true)
    setError(null)
    try {
      await withdrawConsent(status.record.id)
      setSuccess(t('consentWidget.consentWithdrawn'))
      await load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t('consentWidget.errorWithdraw'))
    } finally {
      setBusy(false)
    }
  }

  const title = label ?? t(CONSENT_TYPE_LABEL_KEYS[consentType])

  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 flex items-center justify-center text-[var(--text-muted)] text-sm">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('consentWidget.loadingStatus')}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2 text-sm">
        {status?.granted ? (
          <ShieldCheck className="h-4 w-4 text-[var(--ok)]" />
        ) : status?.hasRecord ? (
          <ShieldOff className="h-4 w-4 text-[var(--bad)]" />
        ) : (
          <ShieldQuestion className="h-4 w-4 text-[var(--text-muted)]" />
        )}
        {title}
      </h3>
      <p className="text-xs text-[var(--text-muted)] mb-4">
        {recordType} · {recordId}
      </p>

      {error && (
        <div className="mb-3 p-2.5 rounded-lg bg-status-error/10 border border-status-error text-status-error text-xs flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && !error && (
        <div className="mb-3 p-2.5 rounded-lg bg-status-success/10 border border-status-success text-status-success text-xs flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
          {success}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--text-muted)]">{t('consentWidget.currentStatus')}</span>
          <span
            className={
              status?.granted
                ? 'font-medium text-[var(--ok)]'
                : status?.hasRecord
                  ? 'font-medium text-[var(--bad)]'
                  : 'font-medium text-[var(--text-muted)]'
            }
          >
            {status?.granted
              ? t('pvCaseWizard.granted')
              : status?.hasRecord
                ? status.record?.withdrawnAt
                  ? t('consentWidget.withdrawnStatus')
                  : t('pvCaseWizard.declined')
                : t('consentWidget.notYetCaptured')}
          </span>
        </div>

        {!canManage && <p className="text-[10px] text-[var(--text-muted)] italic">{t('consentWidget.noPermission')}</p>}

        {canManage && !status?.granted && (
          <>
            <div>
              <label className="block text-xs font-medium text-[var(--text)] mb-1.5">{t('consentWidget.howObtained')}</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as ConsentMethod)}
                disabled={busy}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
              >
                <option value="written">{t('pvCaseWizard.written')}</option>
                <option value="verbal">{t('pvCaseWizard.verbal')}</option>
                <option value="implied">{t('pvCaseWizard.implied')}</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleCapture(true)}
                disabled={busy}
                className="flex-1 h-8 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t('consentWidget.recordConsentGiven')}
              </button>
              <button
                onClick={() => handleCapture(false)}
                disabled={busy}
                className="flex-1 h-8 rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-raised)] disabled:opacity-40 text-xs font-medium transition-colors"
              >
                {t('consentWidget.recordDecline')}
              </button>
            </div>
          </>
        )}

        {canManage && status?.granted && (
          <button
            onClick={handleWithdraw}
            disabled={busy}
            className="w-full h-8 rounded-lg border border-status-error text-status-error hover:bg-status-error/10 disabled:opacity-40 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t('consentWidget.withdrawConsent')}
          </button>
        )}
      </div>
    </div>
  )
}
