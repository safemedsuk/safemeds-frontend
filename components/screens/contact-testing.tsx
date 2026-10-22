'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Mail, Phone, PhoneCall, Plus, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  CONTACT_TEST_CHANNEL_LABELS,
  CONTACT_TEST_STATUS_LABELS,
  ContactTest,
  ContactTestAttemptOutcome,
  ContactTestChannel,
  ContactTestWithAttempts,
  getContactTest,
  listContactTests,
  logContactTestAttempt,
  startContactTest,
} from '@/lib/api/contact-tests'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'
import { useTranslation } from '@/lib/i18n/use-translation'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const STATUS_STYLES: Record<string, string> = {
  pending_attempt_1: 'bg-status-info/10 text-status-info',
  pending_attempt_2: 'bg-status-warning/10 text-status-warning',
  reached: 'bg-status-success/10 text-status-success',
  unsuccessful: 'bg-status-error/10 text-status-error',
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString()
}

/**
 * VigiCloud Stage 15.2 — "5 day testing for emails and for calls
 * immediately... Followup trigger 1 and followup trigger 2." A test the
 * tenant itself initiates against its own operated channel (a hotline
 * number, a drug-safety mailbox) — never a reporter's own contact info —
 * so there's no consent gate here, unlike Stage 11's case follow-up.
 */
export function ContactTestingScreen() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canManage = has('contact_testing.manage')

  const contactTestColumns: DataTableColumn<ContactTest>[] = [
    {
      key: 'channel',
      label: t('contactTesting.columnChannel'),
      render: (v) => (
        <span className="flex items-center gap-1.5 text-foreground">
          {v === 'email' ? <Mail className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
          {CONTACT_TEST_CHANNEL_LABELS[v as ContactTestChannel]}
        </span>
      ),
    },
    { key: 'contactValue', label: t('contactTesting.columnContact'), render: (v) => <span className="font-mono text-xs">{v}</span> },
    { key: 'purpose', label: t('contactTesting.columnPurpose'), render: (v) => v || '—' },
    {
      key: 'status',
      label: t('contactTesting.columnStatus'),
      render: (v) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLES[v as string] ?? 'bg-muted text-muted-foreground'}`}>
          {CONTACT_TEST_STATUS_LABELS[v as ContactTest['status']]}
        </span>
      ),
    },
    { key: 'windowDueAt', label: t('contactTesting.columnWindowDue'), sortable: true, render: (v) => formatDateTime(v) },
    { key: 'attemptCount', label: t('contactTesting.columnAttempts') },
  ]

  const [tests, setTests] = useState<ContactTest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showStart, setShowStart] = useState(false)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listContactTests(page, limit)
      .then(({ tests: rows, meta }) => {
        setTests(rows)
        setTotalPages(meta.totalPages)
        setTotal(meta.total)
      })
      .catch((err) => setError(getErrorMessage(err, t('contactTesting.errorLoad'))))
      .finally(() => setLoading(false))
  }, [page, limit])

  useEffect(() => {
    if (!canManage) return
    load()
  }, [load, canManage])

  const handleRowsPerPageChange = (n: number) => {
    setLimit(n)
    setPage(1)
  }

  if (!canManage) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">{t('contactTesting.title')}</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{t('contactTesting.noPermission')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <PhoneCall className="h-6 w-6 text-safemeds-teal" />
            <h1 className="text-3xl font-display font-bold text-foreground">{t('contactTesting.title')}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t('contactTesting.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowStart(true)}
          className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors"
        >
          <Plus className="h-4 w-4" /> {t('contactTesting.startTest')}
        </button>
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      {!loading && tests.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <PhoneCall className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{t('contactTesting.noTestsYet')}</p>
        </div>
      ) : (
        <DataTableV2<ContactTest>
          data={tests}
          columns={contactTestColumns}
          onRowClick={(row) => setViewingId(row.id)}
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

      {showStart && (
        <StartTestModal
          onClose={() => setShowStart(false)}
          onStarted={() => {
            setShowStart(false)
            setNotice(t('contactTesting.testStarted'))
            setPage(1)
            load()
          }}
        />
      )}

      {viewingId && (
        <TestDetailModal
          testId={viewingId}
          onClose={() => setViewingId(null)}
          onChanged={() => {
            load()
          }}
        />
      )}
    </div>
  )
}

function StartTestModal({ onClose, onStarted }: { onClose: () => void; onStarted: () => void }) {
  const { t } = useTranslation()
  const [channel, setChannel] = useState<ContactTestChannel>('email')
  const [contactValue, setContactValue] = useState('')
  const [purpose, setPurpose] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = contactValue.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await startContactTest({ channel, contactValue: contactValue.trim(), purpose: purpose.trim() || undefined })
      onStarted()
    } catch (err) {
      setError(getErrorMessage(err, t('contactTesting.errorStart')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">{t('contactTesting.startTestModalTitle')}</h2>

        <div>
          <label className={labelClass}>{t('contactTesting.channel')}</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value as ContactTestChannel)} className={inputClass}>
            <option value="email">{t('contactTesting.email')}</option>
            <option value="phone">{t('contactTesting.phone')}</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>{channel === 'email' ? t('contactTesting.emailAddressRequired') : t('contactTesting.phoneNumberRequired')}</label>
          <input
            value={contactValue}
            onChange={(e) => setContactValue(e.target.value)}
            placeholder={channel === 'email' ? 'drugsafety@yourcompany.com' : '+254 700 000 000'}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>{t('contactTesting.purpose')}</label>
          <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={t('contactTesting.purposePlaceholder')} className={inputClass} />
        </div>

        <p className="text-xs text-muted-foreground">
          {channel === 'email' ? t('contactTesting.emailWindowNote') : t('contactTesting.phoneWindowNote')}
        </p>

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
            {t('contactTesting.start')}
          </button>
        </div>
      </div>
    </div>
  )
}

function TestDetailModal({ testId, onClose, onChanged }: { testId: string; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation()
  const [test, setTest] = useState<ContactTestWithAttempts | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<ContactTestAttemptOutcome>('reached')
  const [note, setNote] = useState('')
  const [logging, setLogging] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    getContactTest(testId)
      .then(setTest)
      .catch((err) => setError(getErrorMessage(err, t('contactTesting.errorLoadTest'))))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId, t])

  useEffect(() => {
    load()
  }, [load])

  const isResolved = test?.status === 'reached' || test?.status === 'unsuccessful'

  const handleLog = async () => {
    setLogging(true)
    setError(null)
    try {
      await logContactTestAttempt(testId, { outcome, note: note.trim() || undefined })
      setNote('')
      await load()
      onChanged()
    } catch (err) {
      setError(getErrorMessage(err, t('contactTesting.errorLogAttempt')))
    } finally {
      setLogging(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between">
          <h2 className="font-display font-bold text-lg text-foreground">{t('contactTesting.testDetailTitle')}</h2>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
            {t('contactTesting.close')}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !test ? (
          <p className="text-sm text-status-error">{error ?? t('contactTesting.notFound')}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{t('contactTesting.columnChannel')}</p>
                <p className="text-foreground">{CONTACT_TEST_CHANNEL_LABELS[test.channel]}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('contactTesting.columnContact')}</p>
                <p className="text-foreground font-mono text-xs">{test.contactValue}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('contactTesting.columnStatus')}</p>
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[test.status] ?? 'bg-muted text-muted-foreground'}`}>
                  {CONTACT_TEST_STATUS_LABELS[test.status]}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('contactTesting.windowDue')}</p>
                <p className="text-foreground">{formatDateTime(test.windowDueAt)}</p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">{t('contactTesting.attemptHistory')}</h3>
              {test.attempts.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('contactTesting.noAttemptsYet')}</p>
              ) : (
                <ul className="space-y-2">
                  {test.attempts.map((a) => (
                    <li key={a.id} className="rounded-lg border border-border p-2.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">
                          {a.outcome === 'reached'
                            ? t('contactTesting.attemptNumberReached', { number: a.attemptNumber })
                            : t('contactTesting.attemptNumberNoResponse', { number: a.attemptNumber })}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(a.occurredAt)}</span>
                      </div>
                      {a.note && <p className="mt-1 text-xs text-muted-foreground">{a.note}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {isResolved ? (
              <p className="text-sm text-muted-foreground">{t('contactTesting.resolvedNote')}</p>
            ) : (
              <div className="space-y-3 border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-foreground">{t('contactTesting.logAttempt')}</h3>
                <div>
                  <label className={labelClass}>{t('contactTesting.outcome')}</label>
                  <select value={outcome} onChange={(e) => setOutcome(e.target.value as ContactTestAttemptOutcome)} className={inputClass}>
                    <option value="reached">{t('contactTesting.reached')}</option>
                    <option value="no_response">{t('contactTesting.noResponse')}</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>{t('contactTesting.note')}</label>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputClass} />
                </div>
                {error && <p className="text-sm text-status-error">{error}</p>}
                <div className="flex justify-end">
                  <button
                    onClick={handleLog}
                    disabled={logging}
                    className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
                  >
                    {logging && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t('contactTesting.logAttempt')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
