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
 * RegCloud (Phase 12) Stage 14 — starts a recall at `draft`, the
 * initial state of the real QualCloud Stage 10.2 9-state `recall`
 * workflow. Evidence-case linking, the QualCloud root-cause CAPA link,
 * scope/countries/etc. all happen after creation, on the detail page —
 * this modal only needs product + reason to get a real recall on
 * record quickly, matching how urgently a recall needs to be logged in
 * the real world. `mode: 'mock'` is Stage 10.7's own drill mechanism —
 * the exact same lifecycle, excluded from real metrics/dashboards.
 */
export function NewRecallModal({
  onClose,
  onCreated,
  defaultMode = 'real',
}: {
  onClose: () => void
  onCreated: (recallId: string) => void
  defaultMode?: 'real' | 'mock'
}) {
  const [product, setProduct] = useState<Product | null>(null)
  const [reason, setReason] = useState('')
  const [recallClass, setRecallClass] = useState('')
  const [mode, setMode] = useState<'real' | 'mock'>(defaultMode)
  const [type, setType] = useState<'voluntary' | 'directed' | ''>('')
  const [level, setLevel] = useState<'wholesale' | 'retail_facility' | 'patient' | ''>('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canCreate = Boolean(product) && reason.trim().length > 0 && !creating

  const handleCreate = async () => {
    if (!product) return
    setCreating(true)
    setError(null)
    try {
      const recall = await createRecall({
        productId: product.id,
        reason: reason.trim(),
        recallClass: recallClass.trim() || undefined,
        mode,
        type: type || undefined,
        level: level || undefined,
      })
      onCreated(recall.id)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not report this recall.'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal title={defaultMode === 'mock' ? 'Schedule a Mock Recall Drill' : 'Report a Product Recall'} onClose={onClose} maxWidth="max-w-2xl">
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

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className={inputClass}>
              <option value="">—</option>
              <option value="voluntary">Voluntary</option>
              <option value="directed">Directed (regulator-mandated)</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Level</label>
            <select value={level} onChange={(e) => setLevel(e.target.value as typeof level)} className={inputClass}>
              <option value="">—</option>
              <option value="wholesale">Wholesale</option>
              <option value="retail_facility">Retail/Facility</option>
              <option value="patient">Patient</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className={inputClass}>
              <option value="real">Real recall</option>
              <option value="mock">Drill (mock)</option>
            </select>
          </div>
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
