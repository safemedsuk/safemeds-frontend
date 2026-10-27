'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Bell, CheckCheck, Loader2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  listNotifications,
  markNotificationRead,
  type Notification,
  type NotificationCategory,
} from '@/lib/api/notifications'
import { formatLocalDateTime } from '@/lib/datetime-local'
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

type Filter = 'all' | 'unread'

const CATEGORY_LABEL_KEYS: Record<NotificationCategory, MessageKey> = {
  task_assigned: 'notifications.catTask',
  deadline_approaching: 'notifications.catDeadlineApproaching',
  deadline_breached: 'notifications.catDeadlineBreached',
  workflow_update: 'notifications.catWorkflowUpdate',
}

/** Where a notification's own record lives, when this app has a screen for that record type. */
function recordHref(n: Notification): string | null {
  if (!n.recordId) return null
  switch (n.recordType) {
    case 'quality_deviation':
      return `/quality-deviations/${n.recordId}`
    case 'quality_oos':
      return `/quality-oos/${n.recordId}`
    case 'quality_complaint':
      return `/quality-complaints/${n.recordId}`
    case 'capa':
      return '/quality-capas'
    default:
      return null
  }
}

/**
 * Pass A2 (item 5a) — the full notifications inbox. Reads the existing
 * cursor-paginated `GET /notifications` (25 per page, newest first), filters
 * unread/all, and marks rows read. Timestamps show the viewer's local time
 * with the zone abbreviation, with the exact ISO instant on hover.
 */
export function NotificationsScreen() {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<Filter>('all')
  const [rows, setRows] = useState<Notification[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  const load = useCallback(
    async (cursor?: string) => {
      const isMore = Boolean(cursor)
      if (isMore) setLoadingMore(true)
      else setLoading(true)
      setError(null)
      try {
        const page = await listNotifications({ cursor, unreadOnly: filter === 'unread' })
        setRows((prev) => (isMore ? [...prev, ...page.rows] : page.rows))
        setNextCursor(page.nextCursor)
      } catch (err) {
        setError(getErrorMessage(err, t('notifications.errorLoad')))
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [filter, t],
  )

  useEffect(() => {
    void load()
  }, [load])

  const markOne = async (n: Notification) => {
    if (n.readAt) return
    try {
      const updated = await markNotificationRead(n.id)
      setRows((prev) => prev.map((r) => (r.id === n.id ? { ...r, readAt: updated.readAt } : r)))
    } catch (err) {
      setError(getErrorMessage(err, t('notifications.errorMarkOne')))
    }
  }

  const markAllVisible = async () => {
    const unread = rows.filter((r) => !r.readAt)
    if (unread.length === 0) return
    setMarkingAll(true)
    try {
      await Promise.all(unread.map((r) => markNotificationRead(r.id)))
      const now = new Date().toISOString()
      setRows((prev) => prev.map((r) => (r.readAt ? r : { ...r, readAt: now })))
    } catch (err) {
      setError(getErrorMessage(err, t('notifications.errorMarkAll')))
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">{t('notifications.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('notifications.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            {(['all', 'unread'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${filter === f ? 'bg-safemeds-teal text-white' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {f === 'all' ? t('notifications.all') : t('notifications.unread')}
              </button>
            ))}
          </div>
          <button
            onClick={markAllVisible}
            disabled={markingAll || rows.every((r) => r.readAt)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {markingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
            {t('notifications.markLoadedRead')}
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <Bell className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">{filter === 'unread' ? t('notifications.noUnread') : t('notifications.noneYet')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((n) => {
            const when = formatLocalDateTime(n.createdAt)
            const href = recordHref(n)
            return (
              <li
                key={n.id}
                className={`rounded-lg border p-4 ${n.readAt ? 'border-border bg-card' : 'border-safemeds-teal/40 bg-safemeds-teal/5'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {!n.readAt && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-safemeds-teal" aria-label={t('notifications.unreadAriaLabel')} />}
                      <p className="text-sm font-semibold text-foreground">{n.title}</p>
                    </div>
                    {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <time dateTime={when.isoTitle} title={when.isoTitle}>
                        {when.display}
                        {when.zone ? ` ${when.zone}` : ''}
                      </time>
                      <span className="rounded-full bg-muted px-2 py-0.5">{t(CATEGORY_LABEL_KEYS[n.category] ?? 'notifications.catTask')}</span>
                      {href && (
                        <Link href={href} className="text-safemeds-teal hover:underline" onClick={() => void markOne(n)}>
                          {t('notifications.openRecord')}
                        </Link>
                      )}
                    </div>
                  </div>
                  {!n.readAt && (
                    <button
                      onClick={() => void markOne(n)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      {t('notifications.markAsRead')}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {nextCursor && (
        <div className="flex justify-center">
          <button
            onClick={() => void load(nextCursor)}
            disabled={loadingMore}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('notifications.loadMore')}
          </button>
        </div>
      )}
    </div>
  )
}
