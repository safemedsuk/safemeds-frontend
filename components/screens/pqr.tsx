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
import { useTranslation } from '@/lib/i18n/use-translation'

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
  const { t } = useTranslation()
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
      .catch((err) => setError(getErrorMessage(err, t('pqr.errorLoad'))))
      .finally(() => setLoading(false))
  }, [productFilter, t])

  useEffect(load, [load])

  const productName = (id: string) => products.find((p) => p.id === id)?.brandName ?? id

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">{t('pqr.title')}</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{t('pqr.noPermission')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">{t('pqr.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('pqr.subtitle')}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowAssemble(true)}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors"
          >
            <Plus className="h-4 w-4" /> {t('pqr.assembleApqr')}
          </button>
        )}
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground">{t('pqr.product')}</label>
        <select
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">{t('pqr.allProducts')}</option>
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
            <p className="text-sm text-muted-foreground">{t('pqr.noApqrsYet')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">{t('pqr.columnProduct')}</th>
                <th className="p-3">{t('pqr.columnPeriod')}</th>
                <th className="p-3">{t('pqr.columnStatus')}</th>
                <th className="p-3">{t('pqr.columnNextReviewDue')}</th>
                <th className="p-3">{t('pqr.columnDownloads')}</th>
                {canManage && <th className="p-3">{t('pqr.columnActions')}</th>}
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
                      {p.status === 'reviewed' ? t('pqr.statusReviewed') : t('pqr.statusDraft')}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{p.nextReviewDueAt ? p.nextReviewDueAt.slice(0, 10) : '—'}</td>
                  <td className="p-3">
                    {p.status === 'reviewed' && p.generatedReportId ? (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => setDownloading({ pqr: p, format: 'pdf' })} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted">
                          <FileText className="h-3.5 w-3.5" /> {t('pqr.pdf')}
                        </button>
                        <button onClick={() => setDownloading({ pqr: p, format: 'xlsx' })} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted">
                          <Download className="h-3.5 w-3.5" /> {t('pqr.excel')}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t('pqr.availableOnceSigned')}</span>
                    )}
                  </td>
                  {canManage && (
                    <td className="p-3">
                      {p.status === 'draft' && (
                        <button onClick={() => setReviewing(p)} className="text-xs text-safemeds-teal hover:underline">
                          {t('pqr.reviewAndSignOff')}
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
            setNotice(t('pqr.assembledNotice'))
            load()
          }}
        />
      )}

      {downloading && (
        <DocumentPreviewModal
          title={t('pqr.previewTitle', { product: productName(downloading.pqr.productId), format: downloading.format === 'pdf' ? t('pqr.pdf') : t('pqr.excel') })}
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
            setNotice(t('pqr.reviewedNotice'))
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
  const { t } = useTranslation()
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
      setError(getErrorMessage(err, t('pqr.errorAssemble')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">{t('pqr.assembleModalTitle')}</h2>

        <div>
          <label className={labelClass}>{t('pqr.productField')}</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brandName}
              </option>
            ))}
          </select>
        </div>
        <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          {t('pqr.defaultPeriodNote', { year: String(new Date().getUTCFullYear()) })}
        </p>
        <div>
          <label className={labelClass}>{t('pqr.periodStart')}</label>
          <input
            type="date"
            value={periodStart}
            placeholder={`${new Date().getUTCFullYear()}-01-01`}
            onChange={(e) => setPeriodStart(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>{t('pqr.periodEnd')}</label>
          <input
            type="date"
            value={periodEnd}
            placeholder={`${new Date().getUTCFullYear()}-12-31`}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className={inputClass}
          />
        </div>
        {(periodStart || periodEnd) && (!periodStart || !periodEnd) && (
          <p className="text-xs text-status-warning">{t('pqr.bothDatesWarning')}</p>
        )}

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
            {t('pqr.assemble')}
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
  const { t } = useTranslation()
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
        <h2 className="font-display font-bold text-lg text-foreground">{t('pqr.reviewModalTitle', { product: productName })}</h2>

        {assembled && (
          <div className="rounded-lg bg-muted p-4 text-xs grid grid-cols-2 gap-2 text-muted-foreground">
            <span>{t('pqr.batches', { count: String(assembled.batchCount) })}</span>
            <span>{t('pqr.deviations', { count: String(assembled.deviationCount) })}</span>
            <span>{t('pqr.capas', { count: String(assembled.capaCount) })}</span>
            <span>{t('pqr.oos', { count: String(assembled.oosCount) })}</span>
            <span>{t('pqr.complaints', { count: String(assembled.complaintCount) })}</span>
            <span>{t('pqr.changes', { count: String(assembled.changeControlCount) })}</span>
            <span>{t('pqr.regSubmissions', { count: String(assembled.regSubmissionCount) })}</span>
            <span>{t('pqr.regVariations', { count: String(assembled.regVariationCount) })}</span>
            <span>{t('pqr.recalls', { count: String(assembled.recallCount ?? 0) })}</span>
            <span className="col-span-2">{t('pqr.stability', { note: assembled.stabilityNote })}</span>
            {assembled.openQualityTrendFlags.length > 0 && (
              <span className="col-span-2">{t('pqr.openTrendFlags', { flags: assembled.openQualityTrendFlags.join('; ') })}</span>
            )}
          </div>
        )}

        <div>
          <label className={labelClass}>{t('pqr.conclusions')}</label>
          <textarea value={conclusionsNarrative} onChange={(e) => setConclusionsNarrative(e.target.value)} rows={3} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t('pqr.trends')}</label>
          <textarea value={trendsNarrative} onChange={(e) => setTrendsNarrative(e.target.value)} rows={3} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t('pqr.recommendedAction')}</label>
          <input value={actionDescription} onChange={(e) => setActionDescription(e.target.value)} className={inputClass} />
          <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={openCapa} onChange={(e) => setOpenCapa(e.target.checked)} disabled={!actionDescription.trim()} />
            {t('pqr.openCapaForAction')}
          </label>
        </div>

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('common.cancel')}
          </button>
          <button
            onClick={() => setShowSignature(true)}
            className="rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce"
          >
            {t('pqr.signAndSubmit')}
          </button>
        </div>
      </div>

      <SignatureModal
        isOpen={showSignature}
        onClose={() => setShowSignature(false)}
        documentTitle={t('pqr.documentTitle', { product: productName })}
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
            setError(getErrorMessage(err, t('pqr.errorReview')))
            throw err
          }
        }}
      />
    </div>
  )
}
