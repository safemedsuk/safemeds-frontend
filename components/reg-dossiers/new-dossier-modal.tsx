'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { classifyRegistration, createRegDossier, type ClassificationPreview } from '@/lib/api/reg-dossiers'
import { listRegulatoryAuthorities, type RegulatoryAuthority } from '@/lib/api/regulatory-authorities'
import { type Product } from '@/lib/api/master-data'
import { ENGAGEMENT_TYPE_LABELS } from '@/lib/api/company'
import { ProductPicker } from '@/components/pv-cases/product-picker'
import { ProductClassPicker } from '@/components/regulatory/product-class-picker'
import { Modal } from '@/components/ui/modal'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'

/**
 * RegCloud (Phase 12) Stage 1 — the classification wizard. Deliberately a
 * single modal, not a multi-step wizard route: the three inputs
 * (product, authority, product class) are simple enough to fit on one
 * screen, and the live "here's what you'll need" preview is the whole
 * point — it needs to react to every field change, which is easiest to
 * show inline rather than behind a "Next" click. Picking a product is
 * optional-feeling here the same way `ProductPicker` frames it
 * everywhere else, but a dossier does need a real catalog product (no
 * free-text fallback the way a PV case's suspect product has) — the
 * Create button stays disabled until one is actually selected.
 */
export function NewDossierModal({ onClose, onCreated }: { onClose: () => void; onCreated: (dossierId: string) => void }) {
  const [product, setProduct] = useState<Product | null>(null)
  const [authorities, setAuthorities] = useState<RegulatoryAuthority[]>([])
  const [authorityId, setAuthorityId] = useState('')
  const [productClass, setProductClass] = useState('')
  const [route, setRoute] = useState('')
  const [engagementType, setEngagementType] = useState('')

  const [preview, setPreview] = useState<ClassificationPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listRegulatoryAuthorities()
      .then(setAuthorities)
      .catch(() => setAuthorities([]))
  }, [])

  useEffect(() => {
    if (!authorityId || !productClass.trim()) {
      setPreview(null)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    const timer = setTimeout(() => {
      classifyRegistration({ authorityId, productClass: productClass.trim(), route: route.trim() || undefined })
        .then((result) => {
          if (!cancelled) setPreview(result)
        })
        .catch(() => {
          if (!cancelled) setPreview(null)
        })
        .finally(() => {
          if (!cancelled) setPreviewLoading(false)
        })
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [authorityId, productClass, route])

  const canCreate = Boolean(product && authorityId && productClass.trim()) && !creating

  const handleCreate = async () => {
    if (!product) return
    setCreating(true)
    setError(null)
    try {
      const dossier = await createRegDossier({
        productId: product.id,
        authorityId,
        productClass: productClass.trim(),
        route: route.trim() || undefined,
        engagementType: engagementType || undefined,
      })
      onCreated(dossier.id)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not start this dossier.'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal title="Start a new registration dossier" onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">Product</label>
          <ProductPicker linkedProduct={product} onSelect={setProduct} onClear={() => setProduct(null)} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Regulatory authority</label>
            <select value={authorityId} onChange={(e) => setAuthorityId(e.target.value)} className={inputClass}>
              <option value="">Select an authority…</option>
              {authorities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Product class</label>
            <ProductClassPicker key={authorityId} authorityId={authorityId || undefined} value={productClass} onChange={setProductClass} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">Route of administration (optional)</label>
          <input value={route} onChange={(e) => setRoute(e.target.value)} placeholder="Leave blank to apply regardless of route" className={inputClass} />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">Engagement model override (optional)</label>
          <select value={engagementType} onChange={(e) => setEngagementType(e.target.value)} className={inputClass}>
            <option value="">Use your company&apos;s default</option>
            {Object.entries(ENGAGEMENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {previewLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking what this market requires…
          </div>
        )}

        {!previewLoading && preview && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Here&apos;s what you&apos;ll need</p>

            {preview.requirement ? (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />
                  {preview.requirement.documentDefinitions.length} document{preview.requirement.documentDefinitions.length === 1 ? '' : 's'} in the checklist
                  {preview.requirement.standardTimelineDays ? ` · ~${preview.requirement.standardTimelineDays}-day standard review` : ''}
                </p>
                <ul className="ml-5 list-disc space-y-0.5 text-xs text-muted-foreground">
                  {preview.requirement.documentDefinitions.map((d) => (
                    <li key={d.id}>
                      {d.name}
                      {!d.isMandatory && ' (optional)'}
                      {d.ctdModule && ` — ${d.ctdModule}`}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No document checklist configured for this combination yet.</p>
            )}

            {preview.feeSchedules.length > 0 && (
              <p className="text-xs text-foreground">
                Fees:{' '}
                {preview.feeSchedules.map((f) => `${f.feeType} — ${f.currency} ${f.amount}`).join(', ')}
              </p>
            )}

            {preview.renewalRule && (
              <p className="text-xs text-foreground">
                Renewal cadence: every {preview.renewalRule.intervalValue} {preview.renewalRule.intervalUnit}
              </p>
            )}

            {preview.warnings.map((w, idx) => (
              <div key={idx} className="flex items-start gap-1.5 text-xs text-status-warning">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-xs text-status-error">{error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Start dossier
          </button>
        </div>
      </div>
    </Modal>
  )
}
