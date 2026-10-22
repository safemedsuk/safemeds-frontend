'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Loader2, ShieldAlert } from 'lucide-react'
import { ConsentCaptureWidget } from '@/components/consent/consent-capture-widget'
import { ApiRequestError } from '@/lib/api/client'
import {
  createDataSubjectRequest,
  listDataSubjectRequests,
  type DataSubjectRequest,
  type DataSubjectRequestType,
} from '@/lib/api/data-privacy'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

const STATUS_STYLE: Record<DataSubjectRequest['status'], { bg: string; text: string; labelKey: MessageKey }> = {
  pending: { bg: 'bg-[var(--warn-bg)]', text: 'text-[var(--warn)]', labelKey: 'settings.dataPrivacy.statusPending' },
  completed: { bg: 'bg-[var(--ok-bg)]', text: 'text-[var(--ok)]', labelKey: 'settings.dataPrivacy.statusCompleted' },
  blocked: { bg: 'bg-[var(--bad-bg)]', text: 'text-[var(--bad)]', labelKey: 'settings.dataPrivacy.statusBlocked' },
}

/**
 * VigiCloud Stage 0.2 — data-subject access (export) and erasure requests,
 * plus a live preview of the Stage 0.1 consent-capture widget. Both are
 * base-engine primitives with no VigiCloud case-intake screen to attach
 * to yet (Stage 3) — this section is where a company admin can already
 * exercise the real backend today, ahead of that integration.
 */
export function DataPrivacySection() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canManage = has('data_privacy.manage')

  const [requests, setRequests] = useState<DataSubjectRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [recordType, setRecordType] = useState('')
  const [recordId, setRecordId] = useState('')
  const [requestType, setRequestType] = useState<DataSubjectRequestType>('export')
  const [submitting, setSubmitting] = useState(false)

  // Generated client-side only, after mount, to avoid an SSR/hydration
  // mismatch (a value from `crypto.randomUUID()` would differ between the
  // server render and the client's first render otherwise) — a stable
  // per-tab id the consent-widget preview below can point at.
  const [demoRecordId, setDemoRecordId] = useState<string | null>(null)
  useEffect(() => {
    const existing = window.sessionStorage.getItem('consent-demo-id')
    const id = existing ?? crypto.randomUUID()
    window.sessionStorage.setItem('consent-demo-id', id)
    setDemoRecordId(id)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { requests } = await listDataSubjectRequests()
      setRequests(requests)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t('settings.dataPrivacy.errorLoad'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSubmit = async () => {
    if (!recordType.trim() || !recordId.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await createDataSubjectRequest(recordType.trim(), recordId.trim(), requestType)
      setRecordType('')
      setRecordId('')
      await load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t('settings.dataPrivacy.errorSubmit'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-status-error/10 border border-status-error text-status-error text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div>
        <h4 className="text-xs font-semibold text-[var(--text)] mb-2">{t('settings.dataPrivacy.submitRequest')}</h4>
        {!canManage ? (
          <p className="text-[10px] text-[var(--text-muted)] italic flex items-center gap-1.5">
            <ShieldAlert className="h-3 w-3" /> {t('settings.dataPrivacy.onlyAdminCanSubmit')}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input
              value={recordType}
              onChange={(e) => setRecordType(e.target.value)}
              placeholder={t('settings.dataPrivacy.recordTypePlaceholder')}
              className="sm:col-span-1 px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
            />
            <input
              value={recordId}
              onChange={(e) => setRecordId(e.target.value)}
              placeholder={t('settings.dataPrivacy.recordIdPlaceholder')}
              className="sm:col-span-1 px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
            />
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as DataSubjectRequestType)}
              className="sm:col-span-1 px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
            >
              <option value="export">{t('settings.dataPrivacy.export')}</option>
              <option value="erasure">{t('settings.dataPrivacy.erasure')}</option>
            </select>
            <button
              onClick={handleSubmit}
              disabled={submitting || !recordType.trim() || !recordId.trim()}
              className="sm:col-span-1 h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t('settings.dataPrivacy.submit')}
            </button>
          </div>
        )}
        <p className="text-[10px] text-[var(--text-muted)] mt-1.5">{t('settings.dataPrivacy.erasureBlockedHelp')}</p>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-[var(--text)] mb-2">{t('settings.dataPrivacy.requestHistory')}</h4>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-[var(--text-muted)] text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('settings.dataPrivacy.loading')}
          </div>
        ) : requests.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-4 text-center">{t('settings.dataPrivacy.noRequestsYet')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[var(--text-muted)] border-b border-[var(--border)]">
                  <th className="py-2 pr-3 font-medium">{t('settings.dataPrivacy.columnRecord')}</th>
                  <th className="py-2 pr-3 font-medium">{t('settings.dataPrivacy.columnType')}</th>
                  <th className="py-2 pr-3 font-medium">{t('settings.dataPrivacy.columnStatus')}</th>
                  <th className="py-2 pr-3 font-medium">{t('settings.dataPrivacy.columnDetail')}</th>
                  <th className="py-2 font-medium">{t('settings.dataPrivacy.columnSubmitted')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {requests.map((req) => {
                  const style = STATUS_STYLE[req.status]
                  return (
                    <tr key={req.id}>
                      <td className="py-2 pr-3 font-mono text-[var(--text)]">
                        {req.recordType}/{req.recordId}
                      </td>
                      <td className="py-2 pr-3 text-[var(--text)] capitalize">
                        {req.requestType === 'export' ? t('settings.dataPrivacy.export') : t('settings.dataPrivacy.erasure')}
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}>
                          {t(style.labelKey)}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-[var(--text-muted)]">{req.blockedReason ?? '—'}</td>
                      <td className="py-2 text-[var(--text-muted)]">{new Date(req.createdAt).toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h4 className="text-xs font-semibold text-[var(--text)] mb-1">{t('settings.dataPrivacy.consentPreviewTitle')}</h4>
        <p className="text-[10px] text-[var(--text-muted)] mb-2">{t('settings.dataPrivacy.consentPreviewHelp')}</p>
        {demoRecordId && (
          <ConsentCaptureWidget
            recordType="demo_record"
            recordId={demoRecordId}
            consentType="contact"
            label={t('settings.dataPrivacy.demoConsentLabel')}
          />
        )}
      </div>
    </div>
  )
}
