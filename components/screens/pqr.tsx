'use client'

import { useCallback, useEffect, useState } from 'react'
import { ClipboardList, Download, FileText, Loader2, Plus, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { listProducts, Product } from '@/lib/api/master-data'
import { assemblePqr, getApqrDownloadUrl, listPqrs, Pqr, reviewPqr } from '@/lib/api/pqr'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { SignatureModal } from '@/components/ui/signature-modal'
import { DocumentPreviewModal } from '@/components/ui/document-preview-modal'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

/**
 * QualCloud (Phase 13) Stage 13 — Annual Product Quality Review (APQR), renamed
 * from PQR in Phase 2 Pass C. Assembling pulls a live cross-module snapshot
 * server-side and freezes it; this screen shows that frozen snapshot and never
 * re-queries. Review is e-signature-gated and archives a PDF and an Excel
 * workbook. Both downloads serve the archived files.
 */
export function PqrScreen() {
  const { has } = usePermissions()
  const canView = has('quality.view_pqr')
  const canManage = has('quality.manage_pqr')

  const [pqrs, setPqrs] = useState<Pqr[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showAssemble, setShowAssemble] = useState(false)
  const [reviewing, setReviewing] = useState<Pqr | null>(null)
  const [downloading, setDownloading] = useState<{ pqr: Pqr; format: 'pdf' | 'xlsx' } | null>(null)
  const [productFilter, setProductFilter] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([listPqrs(productFilter || undefined), listProducts({ page: 1, limit: 100 })])
      .then(([pqrRes, productRes]) => {
        setPqrs(pqrRes)
        setProducts(productRes.rows)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load Annual Product Quality Reviews.')))
      .finally(() => setLoading(false))
  }, [productFilter])

  useEffect(load, [load])

  const productName = (id: string) => products.find((p) => p.id === id)?.brandName ?? id

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">Annual Product Quality Reviews (APQR)</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to view Annual Product Quality Reviews.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Annual Product Quality Reviews (APQR)</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Per ICH Q10 — an annual, frozen cross-module snapshot (batches, deviations, CAPAs, OOS, complaints,
            changes, recalls, returns, stability, regulatory activity) reviewed and signed off by Quality.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowAssemble(true)}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors"
          >
            <Plus className="h-4 w-4" /> Assemble APQR
          </button>
        )}
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground">Product</label>
        <select
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">All products</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.brandName}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : pqrs.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No Annual Product Quality Reviews assembled yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">Product</th>
                <th className="p-3">Period</th>
                <th className="p-3">Status</th>
                <th className="p-3">Next Review Due</th>
                <th className="p-3">Downloads</th>
                {canManage && <th className="p-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {pqrs.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="p-3 text-foreground font-medium">{productName(p.productId)}</td>
                  <td className="p-3 text-muted-foreground">
                    {p.periodStart.slice(0, 10)} – {p.periodEnd.slice(0, 10)}
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.status === 'reviewed' ? 'bg-status-success/10 text-status-success' : 'bg-status-warning/10 text-status-warning'}`}>
                      {p.status === 'reviewed' ? 'Reviewed' : 'Draft'}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{p.nextReviewDueAt ? p.nextReviewDueAt.slice(0, 10) : '—'}</td>
                  <td className="p-3">
                    {p.status === 'reviewed' && p.generatedReportId ? (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => setDownloading({ pqr: p, format: 'pdf' })} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted">
                          <FileText className="h-3.5 w-3.5" /> PDF
                        </button>
                        <button onClick={() => setDownloading({ pqr: p, format: 'xlsx' })} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted">
                          <Download className="h-3.5 w-3.5" /> Excel
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Available once signed</span>
                    )}
                  </td>
                  {canManage && (
                    <td className="p-3">
                      {p.status === 'draft' && (
                        <button onClick={() => setReviewing(p)} className="text-xs text-safemeds-teal hover:underline">
                          Review &amp; Sign Off
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAssemble && (
        <AssemblePqrModal
          products={products}
          onClose={() => setShowAssemble(false)}
          onAssembled={() => {
            setShowAssemble(false)
            setNotice('APQR assembled from live quality records.')
            load()
          }}
        />
      )}

      {downloading && (
        <DocumentPreviewModal
          title={`APQR — ${productName(downloading.pqr.productId)} (${downloading.format === 'pdf' ? 'PDF' : 'Excel'})`}
          filename={downloading.format === 'pdf' ? 'apqr.pdf' : 'apqr.xlsx'}
          contentType={downloading.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}
          getUrl={async () => (await getApqrDownloadUrl(downloading.pqr.id, downloading.format)).url}
          onClose={() => setDownloading(null)}
        />
      )}

      {reviewing && (
        <ReviewPqrModal
          pqr={reviewing}
          productName={productName(reviewing.productId)}
          onClose={() => setReviewing(null)}
          onReviewed={() => {
            setReviewing(null)
            setNotice('APQR reviewed, signed, and archived as PDF and Excel.')
            load()
          }}
        />
      )}
    </div>
  )
}

function AssemblePqrModal({
  products,
  onClose,
  onAssembled,
}: {
  products: Product[]
  onClose: () => void
  onAssembled: () => void
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = Boolean(productId) && (!periodStart || !!periodEnd) && (!periodEnd || !!periodStart)

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await assemblePqr({
        productId,
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
      })
      onAssembled()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not assemble this APQR.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">Assemble APQR</h2>

        <div>
          <label className={labelClass}>Product *</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brandName}
              </option>
            ))}
          </select>
        </div>
        <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          Leave the dates empty to use the default period: 1 January to 31 December {new Date().getUTCFullYear()}, computed in
          UTC (the company has no timezone setting). Each event counts on the calendar day of its UTC timestamp.
        </p>
        <div>
          <label className={labelClass}>Period start</label>
          <input
            type="date"
            value={periodStart}
            placeholder={`${new Date().getUTCFullYear()}-01-01`}
            onChange={(e) => setPeriodStart(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Period end</label>
          <input
            type="date"
            value={periodEnd}
            placeholder={`${new Date().getUTCFullYear()}-12-31`}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className={inputClass}
          />
        </div>
        {(periodStart || periodEnd) && (!periodStart || !periodEnd) && (
          <p className="text-xs text-status-warning">Enter both dates, or clear both to use the default year.</p>
        )}

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Assemble
          </button>
        </div>
      </div>
    </div>
  )
}

function ReviewPqrModal({
  pqr,
  productName,
  onClose,
  onReviewed,
}: {
  pqr: Pqr
  productName: string
  onClose: () => void
  onReviewed: () => void
}) {
  const [conclusionsNarrative, setConclusionsNarrative] = useState('')
  const [trendsNarrative, setTrendsNarrative] = useState('')
  const [actionDescription, setActionDescription] = useState('')
  const [openCapa, setOpenCapa] = useState(false)
  const [showSignature, setShowSignature] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const assembled = pqr.assembledData

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-lg border border-border bg-card p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="font-display font-bold text-lg text-foreground">Review APQR — {productName}</h2>

        {assembled && (
          <div className="rounded-lg bg-muted p-4 text-xs grid grid-cols-2 gap-2 text-muted-foreground">
            <span>Batches: {assembled.batchCount}</span>
            <span>Deviations: {assembled.deviationCount}</span>
            <span>CAPAs: {assembled.capaCount}</span>
            <span>OOS: {assembled.oosCount}</span>
            <span>Complaints: {assembled.complaintCount}</span>
            <span>Changes: {assembled.changeControlCount}</span>
            <span>Reg. Submissions: {assembled.regSubmissionCount}</span>
            <span>Reg. Variations: {assembled.regVariationCount}</span>
            <span>Recalls: {assembled.recallCount ?? 0}</span>
            <span className="col-span-2">Stability: {assembled.stabilityNote}</span>
            {assembled.openQualityTrendFlags.length > 0 && (
              <span className="col-span-2">Open trend flags: {assembled.openQualityTrendFlags.join('; ')}</span>
            )}
          </div>
        )}

        <div>
          <label className={labelClass}>Conclusions</label>
          <textarea value={conclusionsNarrative} onChange={(e) => setConclusionsNarrative(e.target.value)} rows={3} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Trends</label>
          <textarea value={trendsNarrative} onChange={(e) => setTrendsNarrative(e.target.value)} rows={3} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Recommended Action (optional)</label>
          <input value={actionDescription} onChange={(e) => setActionDescription(e.target.value)} className={inputClass} />
          <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={openCapa} onChange={(e) => setOpenCapa(e.target.checked)} disabled={!actionDescription.trim()} />
            Open a CAPA for this action
          </label>
        </div>

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={() => setShowSignature(true)}
            className="rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce"
          >
            Sign &amp; Submit
          </button>
        </div>
      </div>

      <SignatureModal
        isOpen={showSignature}
        onClose={() => setShowSignature(false)}
        documentTitle={`Annual Product Quality Review — ${productName}`}
        documentId={pqr.id}
        onSigned={async ({ signatureToken, intentStatement }) => {
          try {
            await reviewPqr(pqr.id, {
              conclusionsNarrative: conclusionsNarrative.trim() || undefined,
              trendsNarrative: trendsNarrative.trim() || undefined,
              recommendedActions: actionDescription.trim()
                ? [{ description: actionDescription.trim(), openCapa }]
                : undefined,
              intentStatement,
              signatureToken,
            })
            setShowSignature(false)
            onReviewed()
          } catch (err) {
            setError(getErrorMessage(err, 'Could not record this APQR review.'))
            throw err
          }
        }}
      />
    </div>
  )
}
