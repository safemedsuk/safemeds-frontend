'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, BarChart3, Bell, CheckCircle2, ClipboardList, Loader2, Plus, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  acknowledgeTrendFlag,
  getQualityMetrics,
  listQualityTrendFlags,
  QualityMetricsSnapshot,
  QualityTrendFlag,
  runTrendDetectionNow,
} from '@/lib/api/quality-metrics'
import {
  getManagementReview,
  ManagementReview,
  listManagementReviews,
  recordManagementReviewActions,
  scheduleManagementReview,
  addManagementReviewAttendee,
  withdrawManagementReviewAttendee,
  ManagementReviewAttendee,
} from '@/lib/api/management-reviews'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { useTranslation } from '@/lib/i18n/use-translation'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

function defaultPeriod(): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 90)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

type Tab = 'metrics' | 'trends' | 'reviews'

/**
 * QualCloud (Phase 13) Stage 8 — Metrics, Trending & Management
 * Review (ICH Q10). Live-computed metrics (never cached), the
 * root-cause trend register, and the management-review history —
 * one screen, three tabs, matching this codebase's own established
 * "dense feature → tabs, not stacked sections" preference.
 */
export function QualityMetricsScreen() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canView = has('quality.view_metrics')
  const canManageReview = has('quality.manage_management_review')

  const [tab, setTab] = useState<Tab>('metrics')

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">{t('qualityMetrics.title')}</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{t('qualityMetrics.noPermission')}</p>
        </div>
      </div>
    )
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'metrics', label: t('qualityMetrics.tabMetrics'), icon: <BarChart3 className="h-4 w-4" /> },
    { key: 'trends', label: t('qualityMetrics.tabTrendFlags'), icon: <AlertTriangle className="h-4 w-4" /> },
    { key: 'reviews', label: t('qualityMetrics.tabManagementReviews'), icon: <ClipboardList className="h-4 w-4" /> },
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-safemeds-teal" />
          <h1 className="text-3xl font-display font-bold text-foreground">{t('qualityMetrics.title')}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t('qualityMetrics.subtitle')}</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === tb.key ? 'border-safemeds-teal text-safemeds-teal' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tb.icon}
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'metrics' && <MetricsTab />}
      {tab === 'trends' && <TrendFlagsTab canAcknowledge={canManageReview} />}
      {tab === 'reviews' && <ManagementReviewsTab canManage={canManageReview} />}
    </div>
  )
}

function StatCard({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'warning' | 'success' }) {
  const toneClass = tone === 'warning' ? 'text-status-warning' : tone === 'success' ? 'text-status-success' : 'text-foreground'
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-display font-bold ${toneClass}`}>{value}</p>
    </div>
  )
}

function MetricsTab() {
  const { t } = useTranslation()
  const [period, setPeriod] = useState(defaultPeriod())
  const [metrics, setMetrics] = useState<QualityMetricsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getQualityMetrics(period.from, period.to)
      .then(setMetrics)
      .catch((err) => setError(getErrorMessage(err, t('qualityMetrics.errorLoadMetrics'))))
      .finally(() => setLoading(false))
  }, [period, t])

  useEffect(load, [load])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <div>
          <label className={labelClass}>{t('qualityMetrics.from')}</label>
          <input type="date" value={period.from} onChange={(e) => setPeriod({ ...period, from: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t('qualityMetrics.to')}</label>
          <input type="date" value={period.to} onChange={(e) => setPeriod({ ...period, to: e.target.value })} className={inputClass} />
        </div>
      </div>

      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      {loading || !metrics ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label={t('qualityMetrics.deviationsOpenedClosed')} value={`${metrics.deviationsOpened} / ${metrics.deviationsClosed}`} />
            <StatCard label={t('qualityMetrics.complaintsOpenedClosed')} value={`${metrics.complaintsOpened} / ${metrics.complaintsClosed}`} />
            <StatCard label={t('qualityMetrics.capasOpenedClosed')} value={`${metrics.capasOpened} / ${metrics.capasClosed}`} />
            <StatCard
              label={t('qualityMetrics.rightFirstTimeRate')}
              value={metrics.rightFirstTimeRate === null ? '—' : `${metrics.rightFirstTimeRate}%`}
              tone={metrics.rightFirstTimeRate !== null && metrics.rightFirstTimeRate < 80 ? 'warning' : 'success'}
            />
            <StatCard label={t('qualityMetrics.overdueCapas')} value={String(metrics.overdueCapaCount)} tone={metrics.overdueCapaCount > 0 ? 'warning' : 'success'} />
            <StatCard label={t('qualityMetrics.recurringIssues')} value={String(metrics.recurringIssueCount)} tone={metrics.recurringIssueCount > 0 ? 'warning' : 'success'} />
            <StatCard
              label={t('qualityMetrics.trainingCompliance')}
              value={metrics.trainingComplianceRate === null ? '—' : `${metrics.trainingComplianceRate}%`}
              tone={metrics.trainingComplianceRate !== null && metrics.trainingComplianceRate < 90 ? 'warning' : 'success'}
            />
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">{t('qualityMetrics.oosRateTitle')}</h3>
            {metrics.oosRatePerProduct.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('qualityMetrics.noOosOrBatches')}</p>
            ) : (
              <div className="space-y-2">
                {metrics.oosRatePerProduct.map((row) => (
                  <div key={row.productId} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{row.brandName}</span>
                    <span className="text-muted-foreground">
                      {t('qualityMetrics.oosBatchCount', { oosCount: String(row.oosCount), batchCount: String(row.batchCount), rate: row.ratePercent !== null ? ` — ${row.ratePercent}%` : '' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function TrendFlagsTab({ canAcknowledge }: { canAcknowledge: boolean }) {
  const { t } = useTranslation()
  const [flags, setFlags] = useState<QualityTrendFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [notice, setNotice] = useTimedMessage()
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    listQualityTrendFlags()
      .then(setFlags)
      .catch((err) => setError(getErrorMessage(err, t('qualityMetrics.errorLoadFlags'))))
      .finally(() => setLoading(false))
  }, [t])

  useEffect(load, [load])

  const handleRunNow = async () => {
    setRunning(true)
    setError(null)
    try {
      const result = await runTrendDetectionNow()
      setNotice(t('qualityMetrics.scanComplete', { opened: String(result.flagsOpened), resolved: String(result.flagsResolved) }))
      load()
    } catch (err) {
      setError(getErrorMessage(err, t('qualityMetrics.errorRunDetection')))
    } finally {
      setRunning(false)
    }
  }

  const handleAcknowledge = async (id: string) => {
    try {
      await acknowledgeTrendFlag(id)
      load()
    } catch (err) {
      setError(getErrorMessage(err, t('qualityMetrics.errorAcknowledge')))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={handleRunNow} disabled={running} className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50">
          {running && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('qualityMetrics.runDetectionNow')}
        </button>
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : flags.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-status-success/60 mb-3" />
          <p className="text-sm text-muted-foreground">{t('qualityMetrics.noTrendsFlagged')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {flags.map((flag) => (
            <div key={flag.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`h-4 w-4 ${flag.status === 'open' ? 'text-status-warning' : 'text-status-success'}`} />
                  <p className="text-sm font-medium text-foreground capitalize">{flag.rootCauseCategory.replace(/_/g, ' ')}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${flag.status === 'open' ? 'bg-status-warning/10 text-status-warning' : 'bg-status-success/10 text-status-success'}`}>
                  {flag.status === 'open' ? t('qualityMetrics.open') : t('qualityMetrics.resolved')}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('qualityMetrics.capasSharing', { count: String(flag.occurrenceCount), start: formatDate(flag.windowStart), end: formatDate(flag.windowEnd) })}
              </p>
              {flag.acknowledgedAt ? (
                <p className="mt-2 text-xs text-status-success">{t('qualityMetrics.acknowledgedOn', { date: formatDate(flag.acknowledgedAt) })}</p>
              ) : (
                canAcknowledge && flag.status === 'open' && (
                  <button onClick={() => handleAcknowledge(flag.id)} className="mt-2 flex items-center gap-1 text-xs font-medium text-safemeds-teal hover:underline">
                    <Bell className="h-3.5 w-3.5" /> {t('qualityMetrics.acknowledge')}
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ManagementReviewsTab({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation()
  const [reviews, setReviews] = useState<ManagementReview[]>([])
  const [loading, setLoading] = useState(true)
  const [showSchedule, setShowSchedule] = useState(false)
  const [selected, setSelected] = useState<ManagementReview | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    listManagementReviews()
      .then(setReviews)
      .catch((err) => setError(getErrorMessage(err, t('qualityMetrics.errorLoadReviews'))))
      .finally(() => setLoading(false))
  }, [t])

  useEffect(load, [load])

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canManage && (
          <button onClick={() => setShowSchedule(true)} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce">
            <Plus className="h-4 w-4" /> {t('qualityMetrics.scheduleReview')}
          </button>
        )}
      </div>

      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : reviews.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{t('qualityMetrics.noReviewScheduled')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reviews.map((r) => (
            <button key={r.id} onClick={() => setSelected(r)} className="w-full rounded-lg border border-border bg-card p-4 text-left hover:bg-muted">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{r.period}</p>
                <p className="text-xs text-muted-foreground">{formatDate(r.reviewDate)}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t('qualityMetrics.actionsAgreedCount', { count: String(r.actionsAgreed?.length ?? 0) })}</p>
            </button>
          ))}
        </div>
      )}

      {showSchedule && (
        <ScheduleReviewModal
          onClose={() => setShowSchedule(false)}
          onScheduled={() => {
            setShowSchedule(false)
            load()
          }}
        />
      )}

      {selected && (
        <ReviewDetailModal
          reviewId={selected.id}
          canManage={canManage}
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

function ScheduleReviewModal({ onClose, onScheduled }: { onClose: () => void; onScheduled: () => void }) {
  const { t } = useTranslation()
  const [period, setPeriod] = useState('')
  const [reviewDate, setReviewDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [attendees, setAttendees] = useState<{ name: string; roleOrOrganisation: string }[]>([])
  const [attendeeName, setAttendeeName] = useState('')
  const [attendeeRole, setAttendeeRole] = useState('')
  const [nextReviewDueAt, setNextReviewDueAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = period.trim().length > 0 && reviewDate.length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await scheduleManagementReview({
        period: period.trim(),
        reviewDate,
        attendeeRows: attendees.map((a) => ({
          name: a.name,
          roleOrOrganisation: a.roleOrOrganisation.trim() || undefined,
        })),
        nextReviewDueAt: nextReviewDueAt || undefined,
      })
      onScheduled()
    } catch (err) {
      setError(getErrorMessage(err, t('qualityMetrics.errorSchedule')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">{t('qualityMetrics.scheduleModalTitle')}</h2>
        <p className="text-xs text-muted-foreground">{t('qualityMetrics.scheduleModalNote')}</p>
        <div>
          <label className={labelClass}>{t('qualityMetrics.periodField')}</label>
          <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder={t('qualityMetrics.periodPlaceholder')} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t('qualityMetrics.reviewDateField')}</label>
          <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t('qualityMetrics.attendees')}</label>
          <p className="mb-2 text-[11px] text-muted-foreground">{t('qualityMetrics.attendeesHelp')}</p>
          {attendees.length > 0 && (
            <ul className="mb-2 space-y-1 text-sm">
              {attendees.map((a, index) => (
                <li key={`${a.name}-${index}`} className="flex items-center justify-between gap-2">
                  <span className="text-foreground">
                    {a.name}
                    {a.roleOrOrganisation && <span className="text-muted-foreground"> · {a.roleOrOrganisation}</span>}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-status-error hover:underline"
                    onClick={() => setAttendees((prev) => prev.filter((_, i) => i !== index))}
                  >
                    {t('qualityMetrics.remove')}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input value={attendeeName} onChange={(e) => setAttendeeName(e.target.value)} placeholder={t('qualityMetrics.fullName')} className={inputClass} />
            <input value={attendeeRole} onChange={(e) => setAttendeeRole(e.target.value)} placeholder={t('qualityMetrics.roleOrOrganisation')} className={inputClass} />
          </div>
          <button
            type="button"
            disabled={attendeeName.trim().length < 2}
            onClick={() => {
              setAttendees((prev) => [...prev, { name: attendeeName.trim(), roleOrOrganisation: attendeeRole }])
              setAttendeeName('')
              setAttendeeRole('')
            }}
            className="mt-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {t('qualityMetrics.addAttendee')}
          </button>
        </div>
        <div>
          <label className={labelClass}>{t('qualityMetrics.nextReviewDue')}</label>
          <input type="date" value={nextReviewDueAt} onChange={(e) => setNextReviewDueAt(e.target.value)} className={inputClass} />
        </div>
        {error && <p className="text-sm text-status-error">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">{t('common.cancel')}</button>
          <button onClick={handleSubmit} disabled={!isValid || submitting} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('qualityMetrics.schedule')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ReviewDetailModal({
  reviewId,
  canManage,
  onClose,
  onChanged,
}: {
  reviewId: string
  canManage: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const { t } = useTranslation()
  const [review, setReview] = useState<ManagementReview | null>(null)
  const [loading, setLoading] = useState(true)
  const [attendeeName, setAttendeeName] = useState('')
  const [attendeeRole, setAttendeeRole] = useState('')
  const [attendeeError, setAttendeeError] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [openCapa, setOpenCapa] = useState(false)
  const [rootCauseCategory, setRootCauseCategory] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getManagementReview(reviewId).then(setReview).finally(() => setLoading(false))
  }, [reviewId])

  const handleAddAction = async () => {
    if (!description.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const existing = review?.actionsAgreed ?? []
      await recordManagementReviewActions(reviewId, [
        ...existing.map((a) => ({ description: a.description, ownerUserId: a.ownerUserId, openCapa: false })),
        { description: description.trim(), openCapa, rootCauseCategory: rootCauseCategory.trim() || undefined },
      ])
      onChanged()
    } catch (err) {
      setError(getErrorMessage(err, t('qualityMetrics.errorRecordAction')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 space-y-4 max-h-[85vh] overflow-y-auto">
        {loading || !review ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <h2 className="font-display font-bold text-lg text-foreground">{review.period} — {formatDate(review.reviewDate)}</h2>
            <div className="rounded-lg border border-border p-3 text-sm">
              <p className="mb-2 font-medium text-foreground">{t('qualityMetrics.attendeesHeading')}</p>
              {(review.attendeeRows ?? []).length === 0 && !review.attendees && (
                <p className="text-xs text-muted-foreground">{t('qualityMetrics.noAttendeesRecorded')}</p>
              )}
              {review.attendees && (review.attendeeRows ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">{t('qualityMetrics.recordedBeforeLists', { attendees: review.attendees })}</p>
              )}
              <ul className="space-y-1">
                {(review.attendeeRows ?? []).map((a: ManagementReviewAttendee) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-foreground">
                      {a.name}
                      {a.roleOrOrganisation && <span className="text-muted-foreground"> · {a.roleOrOrganisation}</span>}
                    </span>
                    {canManage && (
                      <button
                        type="button"
                        className="text-status-error hover:underline"
                        onClick={async () => {
                          setAttendeeError(null)
                          try {
                            await withdrawManagementReviewAttendee(reviewId, a.id)
                            setReview(await getManagementReview(reviewId))
                          } catch (err) {
                            setAttendeeError(getErrorMessage(err, t('qualityMetrics.errorRemoveAttendee')))
                          }
                        }}
                      >
                        {t('qualityMetrics.remove')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {canManage && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <input value={attendeeName} onChange={(e) => setAttendeeName(e.target.value)} placeholder={t('qualityMetrics.fullName')} className={inputClass} />
                  <input value={attendeeRole} onChange={(e) => setAttendeeRole(e.target.value)} placeholder={t('qualityMetrics.roleOrOrganisation')} className={inputClass} />
                  <button
                    type="button"
                    disabled={attendeeName.trim().length < 2}
                    onClick={async () => {
                      setAttendeeError(null)
                      try {
                        await addManagementReviewAttendee(reviewId, {
                          name: attendeeName.trim(),
                          roleOrOrganisation: attendeeRole.trim() || undefined,
                        })
                        setAttendeeName('')
                        setAttendeeRole('')
                        setReview(await getManagementReview(reviewId))
                      } catch (err) {
                        setAttendeeError(getErrorMessage(err, t('qualityMetrics.errorAddAttendee')))
                      }
                    }}
                    className="col-span-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    {t('qualityMetrics.addAttendee')}
                  </button>
                </div>
              )}
              {attendeeError && <p className="mt-2 text-xs text-status-error">{attendeeError}</p>}
            </div>

            <div className="rounded-lg border border-border p-3 text-sm">
              <p className="text-foreground">{t('qualityMetrics.deviationsSummary', { opened: String(review.metricsSnapshot.deviationsOpened), closed: String(review.metricsSnapshot.deviationsClosed) })}</p>
              <p className="text-foreground">{t('qualityMetrics.capasSummary', { opened: String(review.metricsSnapshot.capasOpened), closed: String(review.metricsSnapshot.capasClosed) })}</p>
              <p className="text-foreground">{t('qualityMetrics.overdueCapasAtTime', { count: String(review.metricsSnapshot.overdueCapaCount) })}</p>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">{t('qualityMetrics.agreedActions')}</h3>
              {(review.actionsAgreed ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('qualityMetrics.noneRecordedYet')}</p>
              ) : (
                <ul className="space-y-1">
                  {(review.actionsAgreed ?? []).map((a, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-status-success" />
                      {a.description}
                      {a.capaId && <span className="text-xs text-muted-foreground">{t('qualityMetrics.capaOpenedTag')}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {canManage && (
              <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
                <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('qualityMetrics.describeNewAction')} className={inputClass} />
                <label className="flex items-center gap-2 text-xs text-foreground">
                  <input type="checkbox" checked={openCapa} onChange={(e) => setOpenCapa(e.target.checked)} /> {t('qualityMetrics.openCapaForAction')}
                </label>
                {openCapa && (
                  <input value={rootCauseCategory} onChange={(e) => setRootCauseCategory(e.target.value)} placeholder={t('qualityMetrics.rootCauseCategoryPlaceholder')} className={inputClass} />
                )}
                <button onClick={handleAddAction} disabled={submitting || !description.trim()} className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {t('qualityMetrics.addAction')}
                </button>
              </div>
            )}

            {error && <p className="text-sm text-status-error">{error}</p>}
          </>
        )}
        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">{t('qualityMetrics.close')}</button>
        </div>
      </div>
    </div>
  )
}
