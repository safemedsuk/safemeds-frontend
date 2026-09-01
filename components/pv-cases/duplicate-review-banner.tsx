'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Loader2, ShieldQuestion, XCircle } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { confirmDuplicate, dismissDuplicate, DuplicateReview, listDuplicateReviews } from '@/lib/api/pv-cases'

interface Props {
  caseId: string
  canTriage: boolean
  /** Fired after a confirm/dismiss decision — the parent re-fetches the case itself, since `duplicateOfCaseId` may have just changed. */
  onResolved: () => void
}

function otherCase(review: DuplicateReview, caseId: string) {
  return review.caseId === caseId ? review.matchedCase : review.case
}

/**
 * VigiCloud Stage 10 — the "possible duplicate" banner from the EMA
 * guideline's own two-step process: detection (already ran automatically
 * at intake/periodic re-screen — nothing here triggers it) surfaces as a
 * `possible` review; this component is purely the human confirmation
 * step. Never auto-resolves anything itself.
 */
export function DuplicateReviewBanner({ caseId, canTriage, onResolved }: Props) {
  const [reviews, setReviews] = useState<DuplicateReview[]>([])
  const [loading, setLoading] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setReviews(await listDuplicateReviews(caseId))
    } catch {
      // Best-effort — the case itself already loaded; a duplicate-review hiccup shouldn't block the page.
    } finally {
      setLoading(false)
    }
  }, [caseId])

  useEffect(() => {
    load()
  }, [load])

  const refresh = async () => {
    await load()
    onResolved()
  }

  if (loading) return null

  const possible = reviews.filter((r) => r.status === 'possible')
  const decided = reviews.filter((r) => r.status !== 'possible')

  if (possible.length === 0 && decided.length === 0) return null

  return (
    <div className="space-y-2">
      {possible.map((review) => (
        <PossibleDuplicateCard key={review.id} review={review} caseId={caseId} canTriage={canTriage} onDecided={refresh} />
      ))}

      {decided.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {historyOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Duplicate review history ({decided.length})
          </button>
          {historyOpen && (
            <div className="space-y-1.5 border-t border-border p-3">
              {decided.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-foreground">
                    {r.status === 'confirmed_duplicate' ? (
                      <>
                        Confirmed duplicate of <span className="font-mono">{otherCase(r, caseId).referenceNumber}</span> (
                        {r.resolutionPattern})
                      </>
                    ) : (
                      <>
                        Not a duplicate of <span className="font-mono">{otherCase(r, caseId).referenceNumber}</span>
                      </>
                    )}
                  </span>
                  {r.reviewNote && <span className="truncate text-muted-foreground" title={r.reviewNote}>{r.reviewNote}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PossibleDuplicateCard({ review, caseId, canTriage, onDecided }: { review: DuplicateReview; caseId: string; canTriage: boolean; onDecided: () => Promise<void> }) {
  const [mode, setMode] = useState<'idle' | 'confirming' | 'dismissing'>('idle')
  const [pattern, setPattern] = useState<'allocation' | 'creation'>('allocation')
  const [masterCaseId, setMasterCaseId] = useState(caseId)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const other = otherCase(review, caseId)
  const thisCase = review.caseId === caseId ? review.case : review.matchedCase

  const handleConfirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await confirmDuplicate(review.id, { resolutionPattern: pattern, masterCaseId: pattern === 'allocation' ? masterCaseId : undefined, reviewNote: note.trim() || undefined })
      setMode('idle')
      await onDecided()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not confirm this duplicate.'))
    } finally {
      setBusy(false)
    }
  }

  const handleDismiss = async () => {
    if (!note.trim()) {
      setError('Say why these are not duplicates before dismissing.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await dismissDuplicate(review.id, note.trim())
      setMode('idle')
      await onDecided()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not dismiss this duplicate flag.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-status-warning/40 bg-status-warning/10 p-4">
      <div className="flex items-start gap-2.5">
        <ShieldQuestion className="h-5 w-5 flex-shrink-0 text-status-warning mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            Possible duplicate of <span className="font-mono">{other.referenceNumber}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {review.matchedFields.citedReferenceNumber
              ? 'The reporter cited this reference number directly.'
              : `Matched on ${[review.matchedFields.country && 'country', review.matchedFields.sex && 'sex', review.matchedFields.age && 'age', Array.isArray(review.matchedFields.products) && review.matchedFields.products.length > 0 && 'product', Array.isArray(review.matchedFields.reactions) && review.matchedFields.reactions.length > 0 && 'reaction']
                  .filter(Boolean)
                  .join(', ')}.`}
          </p>

          {canTriage && mode === 'idle' && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setMode('confirming')}
                className="flex items-center gap-1.5 rounded-lg bg-status-warning px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              >
                <Copy className="h-3.5 w-3.5" /> Confirm duplicate
              </button>
              <button
                onClick={() => setMode('dismissing')}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                <XCircle className="h-3.5 w-3.5" /> Not a duplicate
              </button>
            </div>
          )}

          {mode === 'confirming' && (
            <div className="mt-3 space-y-2 rounded-lg border border-border bg-card p-3">
              <div className="space-y-1.5">
                <label className="flex items-start gap-2 text-xs">
                  <input type="radio" name={`pattern-${review.id}`} checked={pattern === 'allocation'} onChange={() => setPattern('allocation')} className="mt-0.5" />
                  <span>
                    <strong className="text-foreground">Allocation</strong> — one of these two existing cases becomes the Master Case, the other is
                    invalidated (kept for audit only).
                  </span>
                </label>
                {pattern === 'allocation' && (
                  <select
                    value={masterCaseId}
                    onChange={(e) => setMasterCaseId(e.target.value)}
                    className="ml-6 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                  >
                    <option value={caseId}>This case ({thisCase.referenceNumber}) is the master</option>
                    <option value={other.id}>{other.referenceNumber} is the master</option>
                  </select>
                )}
                <label className="flex items-start gap-2 text-xs">
                  <input type="radio" name={`pattern-${review.id}`} checked={pattern === 'creation'} onChange={() => setPattern('creation')} className="mt-0.5" />
                  <span>
                    <strong className="text-foreground">Creation</strong> — a brand-new Master Case is created, synthesizing both, and both originals
                    are invalidated (kept for audit only).
                  </span>
                </label>
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note"
                rows={2}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
              />
              {error && <p className="text-xs text-status-error">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleConfirm}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg bg-status-warning px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  {busy && <Loader2 className="h-3 w-3 animate-spin" />} Confirm
                </button>
                <button onClick={() => setMode('idle')} disabled={busy} className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {mode === 'dismissing' && (
            <div className="mt-3 space-y-2 rounded-lg border border-border bg-card p-3">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why are these not duplicates?"
                rows={2}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
              />
              {error && <p className="text-xs text-status-error">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleDismiss}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-50"
                >
                  {busy && <Loader2 className="h-3 w-3 animate-spin" />} Dismiss
                </button>
                <button onClick={() => setMode('idle')} disabled={busy} className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
