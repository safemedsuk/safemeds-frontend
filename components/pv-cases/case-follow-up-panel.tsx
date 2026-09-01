'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock, Loader2, Mail, Phone, XCircle } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  CaseFollowUp,
  FOLLOW_UP_STATUS_LABELS,
  LogFollowUpAttemptInput,
  getCaseFollowUp,
  logFollowUpAttempt,
  startCaseFollowUp,
} from '@/lib/api/pv-cases'

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

const OUTCOME_LABELS: Record<LogFollowUpAttemptInput['outcome'], string> = {
  responded_resolved: 'Reporter responded — resolved',
  responded_new_information: 'Reporter responded — new information (resets the cycle)',
  no_response: 'No response',
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
  const [followUp, setFollowUp] = useState<CaseFollowUp | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [logOutcome, setLogOutcome] = useState<LogFollowUpAttemptInput['outcome']>('no_response')
  const [logNote, setLogNote] = useState('')
  const [logging, setLogging] = useState(false)
  const [showLogForm, setShowLogForm] = useState(false)

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
      setError(getErrorMessage(err, 'Could not start a follow-up cycle.'))
    } finally {
      setStarting(false)
    }
  }

  const handleLogAttempt = async () => {
    if (!followUp) return
    setLogging(true)
    setError(null)
    try {
      await logFollowUpAttempt(followUp.id, { outcome: logOutcome, note: logNote.trim() || undefined })
      setShowLogForm(false)
      setLogNote('')
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not log this follow-up attempt.'))
    } finally {
      setLogging(false)
    }
  }

  if (loading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
  }

  if (!followUp) {
    return (
      <div className="rounded-lg border border-border p-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">No follow-up cycle started for this case yet.</p>
        {canTriage && (
          <button
            onClick={handleStart}
            disabled={starting}
            className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50 whitespace-nowrap"
          >
            {starting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Start follow-up
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
              {remaining > 0 ? `${remaining} day${remaining === 1 ? '' : 's'} left before the 28-day close` : 'Closing imminently'}
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
                Attempt {attempt.attemptNumber} — {attempt.channel === 'email' ? 'Email' : 'Phone'}
              </span>
              <AttemptOutcomeBadge outcome={attempt.outcome} />
            </div>
            <p className="mt-1 text-muted-foreground">
              Triggered {formatDateTime(attempt.triggeredAt)} · Due {formatDateTime(attempt.dueAt)}
              {attempt.respondedAt && <> · Responded {formatDateTime(attempt.respondedAt)}</>}
            </p>
            {attempt.note && <p className="mt-1 text-foreground">{attempt.note}</p>}
          </div>
        ))}
      </div>

      {canTriage && isOpen && (
        <div className="border-t border-border pt-3">
          {!showLogForm ? (
            <button onClick={() => setShowLogForm(true)} className="text-xs font-medium text-safemeds-teal hover:underline">
              Log a follow-up contact
            </button>
          ) : (
            <div className="space-y-2">
              <select
                value={logOutcome}
                onChange={(e) => setLogOutcome(e.target.value as LogFollowUpAttemptInput['outcome'])}
                className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
              >
                {(Object.keys(OUTCOME_LABELS) as LogFollowUpAttemptInput['outcome'][]).map((key) => (
                  <option key={key} value={key}>
                    {OUTCOME_LABELS[key]}
                  </option>
                ))}
              </select>
              <textarea
                value={logNote}
                onChange={(e) => setLogNote(e.target.value)}
                placeholder="What did the reporter say? (optional)"
                rows={2}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleLogAttempt}
                  disabled={logging}
                  className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
                >
                  {logging && <Loader2 className="h-3 w-3 animate-spin" />} Log attempt
                </button>
                <button
                  onClick={() => setShowLogForm(false)}
                  disabled={logging}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-status-error">{error}</p>}
    </div>
  )
}

function AttemptOutcomeBadge({ outcome }: { outcome: CaseFollowUp['attempts'][number]['outcome'] }) {
  if (outcome === 'pending') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-status-info/10 px-2 py-0.5 text-[10px] font-medium text-status-info">
        <Clock className="h-3 w-3" /> Pending
      </span>
    )
  }
  if (outcome === 'responded_resolved') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-status-success/10 px-2 py-0.5 text-[10px] font-medium text-status-success">
        <CheckCircle2 className="h-3 w-3" /> Resolved
      </span>
    )
  }
  if (outcome === 'responded_new_information') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-status-warning/10 px-2 py-0.5 text-[10px] font-medium text-status-warning">
        <CheckCircle2 className="h-3 w-3" /> New information
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 rounded-full bg-status-error/10 px-2 py-0.5 text-[10px] font-medium text-status-error">
      <XCircle className="h-3 w-3" /> No response
    </span>
  )
}
