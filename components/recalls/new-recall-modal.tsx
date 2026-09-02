'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { createRecall } from '@/lib/api/recalls'
import { type Product } from '@/lib/api/master-data'
import { ProductPicker } from '@/components/pv-cases/product-picker'
import { Modal } from '@/components/ui/modal'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'

/**
 * RegCloud (Phase 12) Stage 14 — starts a recall at `reported`, the
 * initial state of the seeded `recall` workflow. Evidence-case linking
 * and the QualCloud root-cause CAPA link both happen after creation, on
 * the detail page — this modal only needs product + reason to get a
 * real recall on record quickly, matching how urgently a recall needs
 * to be logged in the real world.
 */
export function NewRecallModal({ onClose, onCreated }: { onClose: () => void; onCreated: (recallId: string) => void }) {
  const [product, setProduct] = useState<Product | null>(null)
  const [reason, setReason] = useState('')
  const [recallClass, setRecallClass] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canCreate = Boolean(product) && reason.trim().length > 0 && !creating

  const handleCreate = async () => {
    if (!product) return
    setCreating(true)
    setError(null)
    try {
      const recall = await createRecall({ productId: product.id, reason: reason.trim(), recallClass: recallClass.trim() || undefined })
      onCreated(recall.id)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not report this recall.'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal title="Report a Product Recall" onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">Product</label>
          <ProductPicker linkedProduct={product} onSelect={setProduct} onClear={() => setProduct(null)} />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">Reason</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="What was found, and why is a recall needed?" className={inputClass} />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">
            Recall class <span className="font-normal text-muted-foreground">(optional — free text until Kenya&apos;s own scheme is sourced)</span>
          </label>
          <input value={recallClass} onChange={(e) => setRecallClass(e.target.value)} placeholder="e.g. Class II" className={inputClass} />
        </div>

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
            Report recall
          </button>
        </div>
      </div>
    </Modal>
  )
}
