'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock, FileText, Loader2, Mail, Phone, UploadCloud, XCircle } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { DocumentVersion, getDownloadUrl, listDocuments, uploadDocument } from '@/lib/api/documents'
import {
  CaseFollowUp,
  FOLLOW_UP_STATUS_LABELS,
  LogFollowUpAttemptInput,
  getCaseFollowUp,
  logFollowUpAttempt,
  startCaseFollowUp,
} from '@/lib/api/pv-cases'
import { DocumentPreviewModal } from '@/components/ui/document-preview-modal'
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

interface Props {
  caseId: string
  canTriage: boolean
}

function daysRemaining(closesByDate: string): number {
  return Math.ceil((new Date(closesByDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
}

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '—'
}

const STATUS_STYLES: Record<CaseFollowUp['status'], string> = {
  pending_attempt_1: 'bg-status-info/10 text-status-info',
  pending_attempt_2: 'bg-status-warning/10 text-status-warning',
  closed_resolved: 'bg-status-success/10 text-status-success',
  closed_failed: 'bg-status-error/10 text-status-error',
}

const OUTCOME_LABEL_KEYS: Record<LogFollowUpAttemptInput['outcome'], MessageKey> = {
  responded_resolved: 'caseFollowUpPanel.outcomeRespondedResolved',
  responded_new_information: 'caseFollowUpPanel.outcomeRespondedNewInformation',
  no_response: 'caseFollowUpPanel.outcomeNoResponse',
}

/**
 * VigiCloud Stage 11 — the follow-up timeline: attempt 1/2 status, a
 * days-remaining countdown against the 28-day hard ceiling, and the
 * manual "log a follow-up contact" action for phone-based (or any
 * human-handled) follow-up. Starting a cycle and logging an attempt are
 * both here — nothing about the automated email side needs a UI, since
 * it's fired server-side the moment a cycle (or its next attempt) opens.
 */
export function CaseFollowUpPanel({ caseId, canTriage }: Props) {
  const { t } = useTranslation()
  const [followUp, setFollowUp] = useState<CaseFollowUp | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [logOutcome, setLogOutcome] = useState<LogFollowUpAttemptInput['outcome']>('no_response')
  const [logNote, setLogNote] = useState('')
  const [logging, setLogging] = useState(false)
  const [showLogForm, setShowLogForm] = useState(false)

  // Real-usage request, 22 Sep 2026 (item 18) — a document the reporter sent as part of their response.
  const [logDocumentId, setLogDocumentId] = useState<string | null>(null)
  const [logDocumentName, setLogDocumentName] = useState<string | null>(null)
  const [uploadingDocument, setUploadingDocument] = useState(false)
  const [previewing, setPreviewing] = useState<{ documentId: string; version: DocumentVersion } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setFollowUp(await getCaseFollowUp(caseId))
    } catch {
      // Best-effort — the case itself already loaded; a follow-up hiccup shouldn't block the page.
    } finally {
      setLoading(false)
    }
  }, [caseId])

  useEffect(() => {
    load()
  }, [load])

  const handleStart = async () => {
    setStarting(true)
    setError(null)
    try {
      await startCaseFollowUp(caseId)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, t('caseFollowUpPanel.errorStart')))
    } finally {
      setStarting(false)
    }
  }

  const handleLogAttempt = async () => {
    if (!followUp) return
    setLogging(true)
    setError(null)
    try {
      await logFollowUpAttempt(followUp.id, {
        outcome: logOutcome,
        note: logNote.trim() || undefined,
        documentId: logDocumentId ?? undefined,
      })
      setShowLogForm(false)
      setLogNote('')
      setLogDocumentId(null)
      setLogDocumentName(null)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, t('caseFollowUpPanel.errorLogAttempt')))
    } finally {
      setLogging(false)
    }
  }

  const handleUploadDocument = async (file: File) => {
    setUploadingDocument(true)
    setError(null)
    try {
      const version = await uploadDocument('pv_case', caseId, file, { title: t('caseFollowUpPanel.documentModalTitle') })
      setLogDocumentId(version.documentId)
      setLogDocumentName(file.name)
    } catch (err) {
      setError(getErrorMessage(err, t('caseFollowUpPanel.errorUploadDocument')))
    } finally {
      setUploadingDocument(false)
    }
  }

  const handleViewDocument = async (documentId: string) => {
    setError(null)
    try {
      const docs = await listDocuments('pv_case', caseId)
      const latestVersion = docs.find((d) => d.id === documentId)?.versions[0]
      if (!latestVersion) throw new Error('Document version not found')
      setPreviewing({ documentId, version: latestVersion })
    } catch (err) {
      setError(getErrorMessage(err, t('caseFollowUpPanel.errorLoadDocument')))
    }
  }

  if (loading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
  }

  if (!followUp) {
    return (
      <div className="rounded-lg border border-border p-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t('caseFollowUpPanel.noCycleStarted')}</p>
        {canTriage && (
          <button
            onClick={handleStart}
            disabled={starting}
            className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50 whitespace-nowrap"
          >
            {starting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t('caseFollowUpPanel.startFollowUp')}
          </button>
        )}
        {error && <p className="text-xs text-status-error">{error}</p>}
      </div>
    )
  }

  const isOpen = followUp.status === 'pending_attempt_1' || followUp.status === 'pending_attempt_2'
  const remaining = daysRemaining(followUp.closesByDate)

  return (
    <div className="rounded-lg border border-border p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[followUp.status]}`}>{FOLLOW_UP_STATUS_LABELS[followUp.status]}</span>
          {isOpen && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {remaining > 0
                ? remaining === 1
                  ? t('caseFollowUpPanel.daysLeft', { n: remaining })
                  : t('caseFollowUpPanel.daysLeftPlural', { n: remaining })
                : t('caseFollowUpPanel.closingImminently')}
            </span>
          )}
        </div>
        {followUp.closedReason && <span className="text-xs text-muted-foreground">{followUp.closedReason}</span>}
      </div>

      <div className="space-y-2">
        {followUp.attempts.map((attempt) => (
          <div key={attempt.id} className="rounded-md border border-border/60 p-2.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                {attempt.channel === 'email' ? <Mail className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
                {t('caseFollowUpPanel.attemptChannel', { n: attempt.attemptNumber, channel: attempt.channel === 'email' ? t('caseFollowUpPanel.email') : t('caseFollowUpPanel.phone') })}
              </span>
              <AttemptOutcomeBadge outcome={attempt.outcome} />
            </div>
            <p className="mt-1 text-muted-foreground">
              {t('caseFollowUpPanel.triggeredDue', { triggered: formatDateTime(attempt.triggeredAt), due: formatDateTime(attempt.dueAt) })}
              {attempt.respondedAt && t('caseFollowUpPanel.respondedAt', { date: formatDateTime(attempt.respondedAt) })}
            </p>
            {attempt.note && <p className="mt-1 text-foreground">{attempt.note}</p>}
            {attempt.documentId && (
              <button
                onClick={() => handleViewDocument(attempt.documentId!)}
                className="mt-1.5 flex items-center gap-1 text-xs font-medium text-safemeds-teal hover:underline"
              >
                <FileText className="h-3.5 w-3.5" /> {t('caseFollowUpPanel.viewAttachedDocument')}
              </button>
            )}
          </div>
        ))}
      </div>

      {canTriage && isOpen && (
        <div className="border-t border-border pt-3">
          {!showLogForm ? (
            <button onClick={() => setShowLogForm(true)} className="text-xs font-medium text-safemeds-teal hover:underline">
              {t('caseFollowUpPanel.logFollowUpContact')}
            </button>
          ) : (
            <div className="space-y-2">
              <select
                value={logOutcome}
                onChange={(e) => setLogOutcome(e.target.value as LogFollowUpAttemptInput['outcome'])}
                className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
              >
                {(Object.keys(OUTCOME_LABEL_KEYS) as LogFollowUpAttemptInput['outcome'][]).map((key) => (
                  <option key={key} value={key}>
                    {t(OUTCOME_LABEL_KEYS[key])}
                  </option>
                ))}
              </select>
              <textarea
                value={logNote}
                onChange={(e) => setLogNote(e.target.value)}
                placeholder={t('caseFollowUpPanel.reporterSaidPlaceholder')}
                rows={2}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
              />
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  onChange={(e) => e.target.files?.[0] && handleUploadDocument(e.target.files[0])}
                  disabled={uploadingDocument}
                  className="block flex-1 text-xs text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
                />
                {uploadingDocument && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                {logDocumentId && !uploadingDocument && (
                  <span className="flex items-center gap-1 text-xs text-status-success">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {logDocumentName ?? t('caseFollowUpPanel.uploaded')}
                  </span>
                )}
              </div>
              {!logDocumentId && !uploadingDocument && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <UploadCloud className="h-3.5 w-3.5" /> {t('caseFollowUpPanel.attachDocumentOptional')}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleLogAttempt}
                  disabled={logging}
                  className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
                >
                  {logging && <Loader2 className="h-3 w-3 animate-spin" />} {t('caseFollowUpPanel.logAttempt')}
                </button>
                <button
                  onClick={() => setShowLogForm(false)}
                  disabled={logging}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  {t('caseFollowUpPanel.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-status-error">{error}</p>}

      {previewing && (
        <DocumentPreviewModal
          title={t('caseFollowUpPanel.documentModalTitle')}
          filename={previewing.version.filename}
          contentType={previewing.version.contentType}
          getUrl={() => getDownloadUrl(previewing.documentId, previewing.version.id)}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  )
}

function AttemptOutcomeBadge({ outcome }: { outcome: CaseFollowUp['attempts'][number]['outcome'] }) {
  const { t } = useTranslation()
  if (outcome === 'pending') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-status-info/10 px-2 py-0.5 text-[10px] font-medium text-status-info">
        <Clock className="h-3 w-3" /> {t('caseFollowUpPanel.outcomePending')}
      </span>
    )
  }
  if (outcome === 'responded_resolved') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-status-success/10 px-2 py-0.5 text-[10px] font-medium text-status-success">
        <CheckCircle2 className="h-3 w-3" /> {t('caseFollowUpPanel.outcomeResolved')}
      </span>
    )
  }
  if (outcome === 'responded_new_information') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-status-warning/10 px-2 py-0.5 text-[10px] font-medium text-status-warning">
        <CheckCircle2 className="h-3 w-3" /> {t('caseFollowUpPanel.outcomeNewInformation')}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 rounded-full bg-status-error/10 px-2 py-0.5 text-[10px] font-medium text-status-error">
      <XCircle className="h-3 w-3" /> {t('caseFollowUpPanel.outcomeNoResponseBadge')}
    </span>
  )
}
