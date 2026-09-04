'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Clock, ListChecks, Loader2, Undo2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { claimTask, listTasks, releaseTask, type Task, type TaskUrgency } from '@/lib/api/tasks'
import { useAuthStore } from '@/lib/store/auth-store'

const URGENCY_META: Record<TaskUrgency, { label: string; className: string; icon: typeof AlertCircle }> = {
  overdue: { label: 'Overdue', className: 'bg-status-error/10 text-status-error border-status-error/30', icon: AlertCircle },
  due_soon: { label: 'Due soon', className: 'bg-status-warning/10 text-status-warning border-status-warning/30', icon: Clock },
  normal: { label: 'Normal', className: 'bg-muted text-muted-foreground border-border', icon: CheckCircle2 },
}

/**
 * Special Corner SC-6 — "how do I even discover tasks tied to a
 * specific case?" This is the reverse direction from Task Inbox's own
 * click-through: mount on a record's own detail page and it shows
 * every task ever raised against this specific record, open or
 * closed, regardless of who it's assigned/claimed to — via `GET
 * /tasks?scope=all&recordId=`, the same filter Task Inbox's own
 * record-type dropdown is built on.
 */
export function RecordTasksPanel({ recordType, recordId }: { recordType: string; recordId: string }) {
  const currentUserId = useAuthStore((state) => state.currentUser?.id)
  const currentUserRoleKeys = useAuthStore((state) => state.currentUser?.roleKeys ?? [])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { rows } = await listTasks({ scope: 'all', recordType, recordId, limit: 25 })
      setTasks(rows)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load tasks for this record.'))
    } finally {
      setLoading(false)
    }
  }, [recordType, recordId])

  useEffect(() => {
    load()
  }, [load])

  const handleClaim = async (task: Task) => {
    setActingId(task.id)
    try {
      await claimTask(task.id)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not claim that task.'))
    } finally {
      setActingId(null)
    }
  }

  const handleRelease = async (task: Task) => {
    setActingId(task.id)
    try {
      await releaseTask(task.id)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not release that task.'))
    } finally {
      setActingId(null)
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading tasks…
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-safemeds-teal" />
        <h3 className="text-sm font-semibold text-foreground">Tasks for this record</h3>
      </div>

      {error && <p className="text-xs text-status-error">{error}</p>}

      {tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">No tasks have been raised for this record.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => {
            const meta = URGENCY_META[t.urgency]
            const Icon = meta.icon
            const isMine = t.claimedBy === currentUserId
            return (
              <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-medium whitespace-nowrap ${meta.className}`}>
                      <Icon className="h-3 w-3" /> {meta.label}
                    </span>
                    <span className="font-medium text-foreground truncate">{t.title}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {t.status === 'closed'
                      ? 'Closed'
                      : t.status === 'claimed'
                        ? isMine
                          ? 'Claimed by you'
                          : 'Claimed by a teammate'
                        : t.assignedRoleKey
                          ? `Open — ${t.assignedRoleKey.replace(/_/g, ' ').toLowerCase()} queue`
                          : 'Assigned directly'}
                  </p>
                </div>
                {t.status === 'open' && t.assignedRoleKey && currentUserRoleKeys.includes(t.assignedRoleKey) && (
                  <button
                    onClick={() => handleClaim(t)}
                    disabled={actingId === t.id}
                    className="flex-shrink-0 px-2.5 py-1 rounded-md text-xs font-medium bg-safemeds-teal text-white disabled:opacity-50 flex items-center gap-1"
                  >
                    {actingId === t.id && <Loader2 className="h-3 w-3 animate-spin" />}
                    Claim
                  </button>
                )}
                {t.status === 'open' && t.assignedRoleKey && !currentUserRoleKeys.includes(t.assignedRoleKey) && (
                  <span
                    title={`Requires the ${t.assignedRoleKey.replace(/_/g, ' ').toLowerCase()} role`}
                    className="flex-shrink-0 px-2.5 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground cursor-not-allowed whitespace-nowrap"
                  >
                    Needs {t.assignedRoleKey.replace(/_/g, ' ').toLowerCase()}
                  </span>
                )}
                {t.status === 'claimed' && isMine && (
                  <button
                    onClick={() => handleRelease(t)}
                    disabled={actingId === t.id}
                    title="Put this back in the open queue for a teammate to claim"
                    className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-border text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    {actingId === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
                    Release
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
