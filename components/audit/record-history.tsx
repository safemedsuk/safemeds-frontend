'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { AuditEntry, getRecordHistory } from '@/lib/api/audit'

interface Props {
  recordType: string
  recordId: string
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

/**
 * Reusable Activity-tab data source — `GET /records/:type/:id/history`,
 * the same tenant-scoped, redacted audit read as the `/audit-trail`
 * screen, narrowed to one record. Drop this into any detail view (a user,
 * an invitation, a security policy) once that view exists.
 */
export function RecordHistory({ recordType, recordId }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getRecordHistory(recordType, recordId, { limit: 20 })
      .then(({ entries: rows }) => {
        if (!cancelled) setEntries(rows)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load activity history.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [recordType, recordId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading activity...
      </div>
    )
  }

  if (error) {
    return <p className="py-4 text-sm text-status-error">{error}</p>
  }

  if (entries.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">No recorded activity yet.</p>
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const hasDiff = entry.oldValue || entry.newValue
        const isExpanded = expandedId === entry.id

        return (
          <div key={entry.id} className="rounded-lg border border-border bg-card p-3">
            <button
              onClick={() => hasDiff && setExpandedId(isExpanded ? null : entry.id)}
              className="flex w-full items-start justify-between gap-3 text-left"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{formatAction(entry.action)}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.actorName ?? (entry.actorType === 'system' ? 'System' : 'Unknown user')} ·{' '}
                  {new Date(entry.occurredAt).toLocaleString()}
                </p>
              </div>
              {hasDiff && (isExpanded ? (
                <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              ))}
            </button>

            {isExpanded && hasDiff && (
              <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-2">
                {entry.oldValue && (
                  <div className="rounded-lg bg-status-error/5 p-2">
                    <p className="mb-1 text-xs font-semibold text-status-error">Before</p>
                    <pre className="overflow-x-auto text-xs text-muted-foreground">
                      {JSON.stringify(entry.oldValue, null, 2)}
                    </pre>
                  </div>
                )}
                {entry.newValue && (
                  <div className="rounded-lg bg-status-success/5 p-2">
                    <p className="mb-1 text-xs font-semibold text-status-success">After</p>
                    <pre className="overflow-x-auto text-xs text-muted-foreground">
                      {JSON.stringify(entry.newValue, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
