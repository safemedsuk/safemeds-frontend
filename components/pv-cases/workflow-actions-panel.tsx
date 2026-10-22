'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Loader2, Undo2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { AvailableTransition, getAvailableTransitions, postTransition } from '@/lib/api/workflow'
import type { MessageKey } from '@/lib/i18n/messages/en'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { SignatureModal } from '@/components/ui/signature-modal'
import { useTranslation } from '@/lib/i18n/use-translation'

interface Props {
  workflowInstanceId: string | null
  onTransitioned: () => void
  /**
   * VigiCloud Stage 17 — signal transitions are guarded server-side by
   * `SignalWorkflowGuards`, which rejects any transition with no
   * non-empty `note` (GVP Module IX's own "document the decision"
   * requirement). When set, every transition click first collects that
   * rationale inline before running (or, for a signature-gated
   * transition, before opening the signature modal) — pv_case/clinical
   * trial usages leave this unset and behave exactly as before. `true`
   * requires a note on every transition (Signal's own usage); a
   * `string[]` (RegCloud Stage 6's own `rejected` usage) requires one
   * only for the named `toStateKey`s, leaving every other transition on
   * this same panel unaffected.
   */
  requireNote?: boolean | string[]
  /** Copy for the inline note prompt; defaults to the Signal/GVP wording. */
  noteHelp?: { title?: (transitionName: string) => string; body?: string; placeholder?: string }
  /**
   * RegCloud Stage 6 — for a transition whose domain action needs more
   * than a role/signature/note (e.g. approving a registration needs a
   * real registration number), render this custom trigger instead of
   * the default button. The click handler owns the *entire* flow itself
   * (including signing, if the transition requires it) — this panel
   * still surfaces the transition (so "no action available to your
   * role" stays accurate) but never runs it directly.
   */
  customTriggers?: Record<string, { label?: string; onClick: (transition: AvailableTransition) => void }>
}

function labelFor(transition: AvailableTransition, t: (key: MessageKey, params?: Record<string, string | number>) => string): string {
  // A handful of transitions read more naturally with a specific verb than
  // a bare "Move to <state>" — everything else falls back to that default.
  // `toStateName` itself is backend workflow-definition data, not frontend
  // chrome — stays as the backend phrases it, per todo-i18n.md's own scope
  // boundary (seed/reference data displayed as data, not translated).
  if (transition.toStateKey === 'medical_review') return t('workflowActions.returnToMedicalReview')
  return t('workflowActions.moveTo', { state: transition.toStateName })
}

/**
 * VigiCloud Stage 8/9 — a real workflow-action panel on the case detail
 * page itself, closing a gap flagged repeatedly since Stage 4
 * (`vigicloud-stage4-5-testing.md`'s own note: "there's still no
 * dedicated 'transition this case' button on the case detail page
 * itself"). Reuses the exact same `getAvailableTransitions()`/
 * `postTransition()` API the standalone Workflow Viewer tool already
 * uses — this is a second, purpose-built consumer of that same
 * mechanism, not a parallel one. Guard rejections (Stage 4/8/9's own
 * `TRANSITION_NOT_ALLOWED` reasons) surface exactly as the backend
 * phrases them, reactively after a click — `available-transitions`
 * only checks role, not registered guards, so a transition can look
 * clickable and still come back blocked; that's the honest state, not
 * a bug (see `WorkflowService.availableTransitions()`'s own scope).
 */
export function WorkflowActionsPanel({ workflowInstanceId, onTransitioned, requireNote, noteHelp, customTriggers }: Props) {
  const { t } = useTranslation()
  const [allTransitions, setAllTransitions] = useState<AvailableTransition[]>([])
  const [transitions, setTransitions] = useState<AvailableTransition[]>([])
  const [loading, setLoading] = useState(false)
  const [busyToStateKey, setBusyToStateKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [pendingSignature, setPendingSignature] = useState<AvailableTransition | null>(null)
  const [pendingNote, setPendingNote] = useState<{ transition: AvailableTransition; draft: string } | null>(null)
  const [confirmedNote, setConfirmedNote] = useState<string | undefined>(undefined)

  const load = useCallback(async () => {
    if (!workflowInstanceId) {
      setAllTransitions([])
      setTransitions([])
      return
    }
    setLoading(true)
    try {
      const all = await getAvailableTransitions(workflowInstanceId)
      setAllTransitions(all)
      setTransitions(all.filter((t) => t.allowed))
    } catch {
      // Best-effort — the case itself already loaded; a transitions hiccup shouldn't block the page.
      setAllTransitions([])
      setTransitions([])
    } finally {
      setLoading(false)
    }
  }, [workflowInstanceId])

  useEffect(() => {
    load()
  }, [load])

  const runTransition = async (toStateKey: string, signature?: { signatureToken: string; intentStatement: string }, note?: string) => {
    if (!workflowInstanceId) return
    setBusyToStateKey(toStateKey)
    setError(null)
    try {
      await postTransition(workflowInstanceId, toStateKey, signature, note)
      setNotice(t('workflowActions.movedTo', { state: toStateKey.replace(/_/g, ' ') }))
      await load()
      onTransitioned()
    } catch (err) {
      setError(getErrorMessage(err, t('workflowActions.errorTransition')))
    } finally {
      setBusyToStateKey(null)
      setConfirmedNote(undefined)
    }
  }

  const needsNote = (transition: AvailableTransition) => requireNote === true || (Array.isArray(requireNote) && requireNote.includes(transition.toStateKey))

  const handleClick = (transition: AvailableTransition) => {
    if (busyToStateKey) return
    if (customTriggers?.[transition.toStateKey]) {
      customTriggers[transition.toStateKey].onClick(transition)
      return
    }
    if (needsNote(transition)) {
      setPendingNote({ transition, draft: '' })
      return
    }
    if (transition.requiresSignature) {
      setPendingSignature(transition)
      return
    }
    void runTransition(transition.toStateKey)
  }

  const confirmNote = () => {
    if (!pendingNote || pendingNote.draft.trim().length === 0) return
    const { transition, draft } = pendingNote
    setPendingNote(null)
    if (transition.requiresSignature) {
      setConfirmedNote(draft)
      setPendingSignature(transition)
      return
    }
    void runTransition(transition.toStateKey, undefined, draft)
  }

  // testing-todo Stage 4.1 — a case genuinely at a terminal state (no
  // outgoing transitions defined at all) has nothing to show, so the panel
  // stays hidden exactly as before. But a case with real outgoing
  // transitions that the current actor's role just doesn't hold for any of
  // them used to hit this same silent-`null` path — indistinguishable from
  // "there's nothing here at all." That's the reported bug: a case sitting
  // at Intake with every Validity Gate criterion met and a real
  // `intake → triage` transition on its workflow, but no visible action and
  // no explanation, because the viewing actor's role wasn't
  // `SUPERINTENDENT_PHARMACIST`. Now genuinely distinguished below.
  if (!workflowInstanceId || (!loading && allTransitions.length === 0)) {
    return null
  }

  const roleBlocked = !loading && allTransitions.length > 0 && transitions.length === 0

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('workflowActions.title')}</p>
      {notice && <p className="mb-2 text-xs text-status-success">{notice}</p>}
      {error && <p className="mb-2 text-xs text-status-error">{error}</p>}
      {roleBlocked && (
        <p className="mb-2 text-xs text-muted-foreground">
          {t('workflowActions.roleBlockedPrefix')}{' '}
          {allTransitions.map((at) => `"${at.toStateName}"`).join(` ${t('workflowActions.roleBlockedOr')} `)}
          {t('workflowActions.roleBlockedRequiresRole')}{' '}
          {[...new Set(allTransitions.map((at) => at.requiredRoleKey))].join(` ${t('workflowActions.roleBlockedOr')} `)}{' '}
          {t('workflowActions.roleBlockedRoleSuffix')}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {transitions.map((t2) => (
          <button
            key={t2.id}
            onClick={() => handleClick(t2)}
            disabled={busyToStateKey !== null}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {busyToStateKey === t2.toStateKey ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : t2.toStateKey === 'medical_review' ? (
              <Undo2 className="h-3.5 w-3.5" />
            ) : (
              <ArrowRight className="h-3.5 w-3.5" />
            )}
            {customTriggers?.[t2.toStateKey]?.label ?? labelFor(t2, t)}
          </button>
        ))}
      </div>

      {pendingNote && (
        <div className="mt-3 rounded-lg border border-border bg-card p-3">
          <label className="mb-1.5 block text-xs font-medium text-foreground">
            {noteHelp?.title
              ? noteHelp.title(pendingNote.transition.toStateName)
              : t('workflowActions.rationaleForMovingTo', { state: pendingNote.transition.toStateName })}{' '}
            <span className="text-status-error">*</span>
          </label>
          <p className="mb-2 text-xs text-muted-foreground">
            {noteHelp?.body ?? t('workflowActions.defaultNoteBody')}
          </p>
          <textarea
            autoFocus
            value={pendingNote.draft}
            onChange={(e) => setPendingNote({ ...pendingNote, draft: e.target.value })}
            rows={3}
            placeholder={noteHelp?.placeholder ?? t('workflowActions.defaultNotePlaceholder')}
            className="mb-2 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex gap-2">
            <button
              onClick={confirmNote}
              disabled={pendingNote.draft.trim().length === 0}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {t('workflowActions.continue')}
            </button>
            <button onClick={() => setPendingNote(null)} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {pendingSignature && (
        <SignatureModal
          isOpen={true}
          onClose={() => {
            setPendingSignature(null)
            setConfirmedNote(undefined)
          }}
          documentTitle={t('workflowActions.approveTransitionTo', { state: pendingSignature.toStateName })}
          documentId={workflowInstanceId}
          onSigned={async ({ signatureToken, intentStatement }) => {
            const transition = pendingSignature
            const note = confirmedNote
            setPendingSignature(null)
            if (transition) {
              await runTransition(transition.toStateKey, { signatureToken, intentStatement }, note)
            }
          }}
        />
      )}
    </div>
  )
}
