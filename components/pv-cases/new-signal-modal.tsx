'use client'

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { createSignal } from '@/lib/api/signals'
import { ProductPicker } from '@/components/pv-cases/product-picker'
import type { Product } from '@/lib/api/master-data'

interface Props {
  onClose: () => void
  onCreated: (signalId: string) => void
}

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

/**
 * VigiCloud Stage 17 — manual signal creation, alongside the automatic
 * `detection_method: 'pattern_flag'` path (`POST /pv/signals/scan`).
 * Evidence cases can also be linked later from the detail page's own
 * "Link a case" control, so this form deliberately keeps the initial
 * capture minimal.
 */
export function NewSignalModal({ onClose, onCreated }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [productIdentifier, setProductIdentifier] = useState('')
  const [linkedProduct, setLinkedProduct] = useState<Product | null>(null)
  const [batchNumber, setBatchNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = title.trim().length > 0 && description.trim().length > 0 && productIdentifier.trim().length > 0

  const handlePickProduct = (picked: Product) => {
    setLinkedProduct(picked)
    setProductIdentifier(picked.brandName)
    // testing-todo Stage 17.2 — a real product record usually carries its
    // own current batches; this is a manual signal-raising form though,
    // not an intake wizard, so batch number stays whatever the user
    // already typed (or blank) rather than guessing one on their behalf.
  }

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      const signal = await createSignal({
        title: title.trim(),
        description: description.trim(),
        productIdentifier: productIdentifier.trim(),
        batchNumber: batchNumber.trim() || undefined,
        productId: linkedProduct?.id,
      })
      onCreated(signal.id)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this signal.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-display font-bold text-foreground">Raise a Signal</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <p className="text-xs text-muted-foreground">
            A signal is information suggesting a new, or changed, potential causal association between a product and an event (GVP Module IX). Evidence cases can be linked once
            the signal exists.
          </p>

          <div>
            <label className={labelClass}>Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Depo-Provera injection-site reaction cluster" className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Description *</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What pattern was observed, and why does it merit review?" className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Match against your product catalog</label>
            <ProductPicker
              linkedProduct={linkedProduct}
              onSelect={handlePickProduct}
              onClear={() => setLinkedProduct(null)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Product *</label>
              <input value={productIdentifier} onChange={(e) => setProductIdentifier(e.target.value)} placeholder="Product name" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Batch number</label>
              <input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="Leave blank for all batches" className={inputClass} />
            </div>
          </div>

          {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Raise Signal
          </button>
        </div>
      </div>
    </div>
  )
}
