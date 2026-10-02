'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, GitBranch, Info, Loader2, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react'
import { BATCH_RECORD_REVIEW_DISPOSITIONS } from '@/lib/api/batch-quality'
import { getErrorMessage } from '@/lib/api/client'
import { Batch, getBatch } from '@/lib/api/master-data'
import {
  BatchRecordReview,
  BatchTraceabilityResult,
  createBatchRecordReview,
  getBatchTraceability,
  listRecordReviewsForBatch,
  recordBatchDisposition,
} from '@/lib/api/batch-quality'
import {
  BatchReleaseDecision,
  getBatchReleaseReadiness,
  listBatchReleaseDecisions,
  releaseBatch,
  ReleaseReadiness,
} from '@/lib/api/quality'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { SignatureModal } from '@/components/ui/signature-modal'

const QUALITY_STATUS_STYLES: Record<string, string> = {
  quarantine: 'bg-muted text-foreground',
  under_test: 'bg-status-info/10 text-status-info',
  released: 'bg-status-success/10 text-status-success',
  rejected: 'bg-status-error/10 text-status-error',
  reworked: 'bg-status-warning/10 text-status-warning',
  returned: 'bg-status-warning/10 text-status-warning',
  recalled: 'bg-status-error/10 text-status-error',
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

/**
 * QualCloud (Phase 13) Stage 7 — a batch's own detail page, reachable
 * from Master Data's Batches tab: real genealogy (upstream/downstream,
 * a simple linked list — not a force-directed graph, since the real
 * question a QA user asks is "what's upstream/downstream of this one
 * batch," not "show me the whole company's batch network"), every
 * linked quality event, and the batch-record review/disposition action.
 */
export function BatchDetail({ batchId }: { batchId: string }) {
  const router = useRouter()
  const { has } = usePermissions()
  const canReview = has('quality.review_batch_records')
  const canRelease = has('quality.manage_batch_release')

  const [batch, setBatch] = useState<Batch | null>(null)
  const [trace, setTrace] = useState<BatchTraceabilityResult | null>(null)
  const [reviews, setReviews] = useState<BatchRecordReview[]>([])
  const [readiness, setReadiness] = useState<ReleaseReadiness | null>(null)
  const [releaseDecisions, setReleaseDecisions] = useState<BatchReleaseDecision[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showCreateReview, setShowCreateReview] = useState(false)
  const [choosingDispositionFor, setChoosingDispositionFor] = useState<BatchRecordReview | null>(null)
  const [dispositioning, setDispositioning] = useState<{ review: BatchRecordReview; disposition: string } | null>(null)
  const [showRelease, setShowRelease] = useState(false)
  const [releasing, setReleasing] = useState<{
    decision: 'released' | 'rejected'
    riskAcceptances: { recordType: string; recordId: string; reason: string }[]
  } | null>(null)

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    Promise.all([
      getBatch(batchId),
      getBatchTraceability(batchId),
      listRecordReviewsForBatch(batchId),
      getBatchReleaseReadiness(batchId),
      listBatchReleaseDecisions(batchId),
    ])
      .then(([batchRes, traceRes, reviewsRes, readinessRes, decisionsRes]) => {
        setBatch(batchRes)
        setTrace(traceRes)
        setReviews(reviewsRes)
        setReadiness(readinessRes)
        setReleaseDecisions(decisionsRes)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load this batch.')))
      .finally(() => setLoading(false))
  }, [batchId])

  useEffect(() => load(), [load])

  const refresh = () => load(true)

  if (loading) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!batch || !trace) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{error ?? 'Batch not found.'}</p>
        </div>
      </div>
    )
  }

  const pendingReview = reviews.find((r) => !r.disposition)

  return (
    <div className="space-y-6 p-6">
      <button onClick={() => router.push('/master-data')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Master Data
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{batch.product.brandName}</p>
          <h1 className="text-2xl font-display font-bold text-foreground">Batch {batch.batchNumber}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Manufactured {formatDate(batch.manufacturedOn)} · Expires {formatDate(batch.expiresOn)}
            {batch.batchSize && ` · ${batch.batchSize}${batch.unit ? ` ${batch.unit}` : ''}`}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${QUALITY_STATUS_STYLES[batch.qualityStatus] ?? 'bg-muted text-foreground'}`}>
          {batch.qualityStatus.replace(/_/g, ' ')}
        </span>
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Batch Genealogy</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Upstream (made from)</p>
            {trace.upstreamBatches.length === 0 && trace.unresolvedUpstreamIds.length === 0 ? (
              <p className="text-xs text-muted-foreground">No upstream batches recorded.</p>
            ) : (
              <ul className="space-y-1">
                {trace.upstreamBatches.map((b) => (
                  <li key={b.id}>
                    <button onClick={() => router.push(`/batches/${b.id}`)} className="text-sm text-safemeds-teal hover:underline">
                      {b.batchNumber}
                    </button>
                  </li>
                ))}
                {trace.unresolvedUpstreamIds.map((id) => (
                  <li key={id} className="text-sm text-muted-foreground">
                    {id} <span className="text-xs">(external lot, not in this catalog)</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Downstream (used in)</p>
            {trace.downstreamBatches.length === 0 ? (
              <p className="text-xs text-muted-foreground">No downstream batches recorded.</p>
            ) : (
              <ul className="space-y-1">
                {trace.downstreamBatches.map((b) => (
                  <li key={b.id}>
                    <button onClick={() => router.push(`/batches/${b.id}`)} className="text-sm text-safemeds-teal hover:underline">
                      {b.batchNumber}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Linked Quality Events</p>
        {trace.deviations.length === 0 && trace.changeControls.length === 0 && trace.complaints.length === 0 && trace.oosRecords.length === 0 && trace.recallsOnSameProduct.length === 0 ? (
          <p className="text-xs text-muted-foreground">No quality events linked to this batch.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {trace.deviations.map((d) => (
              <li key={d.id} className="flex items-center justify-between">
                <span className="text-foreground">Deviation {d.deviationNumber} — {d.title}</span>
                <span className="text-xs text-muted-foreground capitalize">{d.status.replace(/_/g, ' ')}</span>
              </li>
            ))}
            {trace.changeControls.map((c) => (
              <li key={c.id} className="flex items-center justify-between">
                <span className="text-foreground">Change Control {c.changeNumber} — {c.title}</span>
                <span className="text-xs text-muted-foreground capitalize">{c.status.replace(/_/g, ' ')}</span>
              </li>
            ))}
            {trace.complaints.map((c) => (
              <li key={c.id} className="flex items-center justify-between">
                <span className="text-foreground">Complaint {c.complaintNumber}</span>
                <span className="text-xs text-muted-foreground capitalize">{c.status.replace(/_/g, ' ')}</span>
              </li>
            ))}
            {trace.oosRecords.map((o) => (
              <li key={o.id} className="flex items-center justify-between">
                <span className="text-foreground">OOS {o.oosNumber}</span>
                <span className="text-xs text-muted-foreground capitalize">{o.status.replace(/_/g, ' ')}</span>
              </li>
            ))}
            {trace.recallsOnSameProduct.length > 0 && (
              <li className="flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/5 p-2.5 mt-2">
                <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-warning" />
                <span className="text-xs text-muted-foreground">
                  {trace.recallsOnSameProduct.length} recall(s) on this same product (recalls aren&apos;t tracked at the batch level in this schema — shown for awareness, not necessarily this exact batch).
                </span>
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Batch Record Review</p>
          {canReview && (
            <button onClick={() => setShowCreateReview(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
              New Review
            </button>
          )}
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 p-2.5 text-xs leading-relaxed text-muted-foreground">
          <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-info" />
          <p>This is the QA batch-record review (pre-Qualified-Person). The separate, more senior QP release gate is below.</p>
        </div>
        {reviews.length === 0 ? (
          <p className="text-xs text-muted-foreground">No reviews recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 pr-3">Findings</th>
                <th className="py-1 pr-3">Disposition</th>
                <th className="py-1">Action</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-2 pr-3 text-foreground">{r.reviewFindings ?? '—'}</td>
                  <td className="py-2 pr-3">
                    {r.disposition ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${QUALITY_STATUS_STYLES[r.disposition] ?? 'bg-muted text-foreground'}`}>{r.disposition}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Pending</span>
                    )}
                  </td>
                  <td className="py-2">
                    {!r.disposition && canReview && (
                      <button onClick={() => setChoosingDispositionFor(r)} className="text-xs font-medium text-safemeds-teal hover:underline">
                        Record Disposition
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Batch Release (Qualified Person)</p>
          </div>
          {canRelease && releaseDecisions.length === 0 && (
            <button onClick={() => setShowRelease(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
              Review Readiness &amp; Release
            </button>
          )}
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 p-2.5 text-xs leading-relaxed text-muted-foreground">
          <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-info" />
          <p>
            A distinct, more senior gate than the QA review above — real-world Qualified Person designation is a
            jurisdiction-specific professional credential, so this is modeled as a permission
            (<code>quality.manage_batch_release</code>) a platform operator grants to a specific role, not a new
            role this product invents.
          </p>
        </div>
        {releaseDecisions.length > 0 ? (
          <ul className="space-y-1.5 text-sm">
            {releaseDecisions.map((d) => (
              <li key={d.id} className="flex items-center justify-between">
                <span className="capitalize text-foreground">{d.decision}</span>
                <span className="text-xs text-muted-foreground">{formatDate(d.releasedAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No release decision has been recorded yet.</p>
        )}
        {batch.qualityStatus === 'rejected' || batch.qualityStatus === 'recalled' ? (
          <button
            onClick={() => router.push(`/quality-waste-disposal?batchId=${batchId}`)}
            className="flex items-center gap-1.5 text-xs font-medium text-safemeds-teal hover:underline"
          >
            <Trash2 className="h-3.5 w-3.5" /> Log the disposal of this batch
          </button>
        ) : null}
      </div>

      {showRelease && readiness && (
        <ReleaseReadinessModal
          readiness={readiness}
          onClose={() => setShowRelease(false)}
          onReadyToSign={(riskAcceptances) => {
            setShowRelease(false)
            setReleasing({ decision: 'released', riskAcceptances })
          }}
        />
      )}

      {releasing && (
        <SignatureModal
          isOpen={true}
          onClose={() => setReleasing(null)}
          documentTitle={`Release batch ${batch.batchNumber}`}
          documentId={batchId}
          onSigned={async ({ signatureToken, intentStatement }) => {
            await releaseBatch(batchId, {
              decision: releasing.decision,
              riskAcceptances: releasing.riskAcceptances,
              intentStatement,
              signatureToken,
            })
            setReleasing(null)
            setNotice('Batch release decision recorded.')
            refresh()
          }}
        />
      )}

      {showCreateReview && (
        <CreateReviewModal
          batchId={batchId}
          onClose={() => setShowCreateReview(false)}
          onCreated={() => {
            setShowCreateReview(false)
            setNotice('Review recorded.')
            refresh()
          }}
        />
      )}

      {choosingDispositionFor && (
        <ChooseDispositionModal
          onClose={() => setChoosingDispositionFor(null)}
          onChosen={(disposition) => {
            const review = choosingDispositionFor
            setChoosingDispositionFor(null)
            setDispositioning({ review, disposition })
          }}
        />
      )}

      {dispositioning && (
        <SignatureModal
          isOpen={true}
          onClose={() => setDispositioning(null)}
          documentTitle={`${dispositioning.disposition} — batch ${batch.batchNumber}`}
          documentId={dispositioning.review.id}
          onSigned={async ({ signatureToken, intentStatement }) => {
            await recordBatchDisposition(dispositioning.review.id, {
              disposition: dispositioning.disposition,
              intentStatement,
              signatureToken,
            })
            setDispositioning(null)
            setNotice('Disposition recorded.')
            refresh()
          }}
        />
      )}
    </div>
  )
}

function ChooseDispositionModal({ onClose, onChosen }: { onClose: () => void; onChosen: (disposition: string) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-display font-bold text-base text-foreground">Record Disposition</h3>
        <p className="text-xs text-muted-foreground">This will require an electronic signature.</p>
        <div className="space-y-2">
          {BATCH_RECORD_REVIEW_DISPOSITIONS.map((d) => (
            <button
              key={d}
              onClick={() => onChosen(d)}
              className="w-full rounded-lg border border-border p-2.5 text-left text-sm font-medium capitalize text-foreground hover:bg-muted"
            >
              {d}
            </button>
          ))}
        </div>
        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function ReleaseReadinessModal({
  readiness,
  onClose,
  onReadyToSign,
}: {
  readiness: ReleaseReadiness
  onClose: () => void
  onReadyToSign: (riskAcceptances: { recordType: string; recordId: string; reason: string }[]) => void
}) {
  const failingWithRecord = readiness.items.filter((i) => !i.passed && i.recordType && i.recordId)
  const [reasons, setReasons] = useState<Record<string, string>>({})

  const allRiskAcceptancesTyped = failingWithRecord.every((i) => (reasons[i.key] ?? '').trim().length > 0)
  const canProceed = readiness.allPassed || (failingWithRecord.length > 0 && allRiskAcceptancesTyped && failingWithRecord.length === readiness.items.filter((i) => !i.passed).length)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 space-y-4 my-8">
        <h3 className="font-display font-bold text-base text-foreground">Release Readiness</h3>
        <p className="text-xs text-muted-foreground">
          Every condition below is shown clearly, pass or fail, before any signature is offered.
        </p>
        <ul className="space-y-2">
          {readiness.items.map((item) => (
            <li key={item.key} className="rounded-lg border border-border p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-foreground">{item.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.passed ? 'bg-status-success/10 text-status-success' : 'bg-status-error/10 text-status-error'}`}>
                  {item.passed ? 'Pass' : 'Fail'}
                </span>
              </div>
              {!item.passed && item.detail && <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>}
              {!item.passed && item.recordType && item.recordId && (
                <div className="mt-2">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Risk-acceptance reason (required to proceed anyway)</label>
                  <input
                    value={reasons[item.key] ?? ''}
                    onChange={(e) => setReasons((prev) => ({ ...prev, [item.key]: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground"
                    placeholder="e.g. Unrelated to this batch, confirmed by QA"
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={() => {
              const riskAcceptances = failingWithRecord.map((i) => ({
                recordType: i.recordType!,
                recordId: i.recordId!,
                reason: reasons[i.key] ?? '',
              }))
              onReadyToSign(riskAcceptances)
            }}
            disabled={!canProceed}
            className="rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            Continue to Signature
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateReviewModal({ batchId, onClose, onCreated }: { batchId: string; onClose: () => void; onCreated: () => void }) {
  const [reviewFindings, setReviewFindings] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await createBatchRecordReview({ batchId, reviewFindings: reviewFindings.trim() || undefined })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this review.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-display font-bold text-base text-foreground">New Batch Record Review</h3>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Review Findings</label>
          <textarea
            value={reviewFindings}
            onChange={(e) => setReviewFindings(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            placeholder="e.g. All in-process checks reviewed and pass"
          />
        </div>
        {error && <p className="text-sm text-status-error">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
