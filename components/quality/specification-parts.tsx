'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { Product } from '@/lib/api/master-data'
import { createSpecification, Specification, SpecificationParameterInput } from '@/lib/api/quality'

export const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
export const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

/** Product-linked types. Raw materials, packaging and APIs are materials and link to a supplier instead. */
export const PRODUCT_REQUIRED_TYPES = ['finished_product', 'in_process'] as const

export function productLabel(p: Product): string {
  return `${p.brandName} — ${p.genericName} ${p.strength}`
}

/**
 * Phase 2 Pass C — create a specification. A finished-product or in-process
 * specification must be linked to a product from the master catalogue, chosen
 * from a picker (never typed as an ID). `defaultProductId` pre-links it when
 * opened from a product view.
 */
export function CreateSpecificationModal({
  products,
  defaultProductId,
  onClose,
  onCreated,
}: {
  products: Product[]
  defaultProductId?: string
  onClose: () => void
  onCreated: (spec: Specification) => void
}) {
  const [specificationNumber, setSpecificationNumber] = useState('')
  const [title, setTitle] = useState('')
  const [specificationType, setSpecificationType] = useState('finished_product')
  const [productId, setProductId] = useState(defaultProductId ?? '')
  const [parameters, setParameters] = useState<SpecificationParameterInput[]>([{ parameterName: '' }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const productRequired = (PRODUCT_REQUIRED_TYPES as readonly string[]).includes(specificationType)
  const isValid =
    specificationNumber.trim().length > 0 && title.trim().length > 0 && (!productRequired || productId.length > 0)

  const updateParameter = (index: number, patch: Partial<SpecificationParameterInput>) => {
    setParameters((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      const created = await createSpecification({
        specificationNumber: specificationNumber.trim(),
        title: title.trim(),
        specificationType,
        ...(productId ? { productId } : {}),
        parameters: parameters.filter((p) => p.parameterName.trim().length > 0),
      })
      onCreated(created)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this specification.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 space-y-4 my-8">
        <h2 className="font-display font-bold text-lg text-foreground">New Specification</h2>

        <div>
          <label className={labelClass}>Specification Number *</label>
          <input value={specificationNumber} onChange={(e) => setSpecificationNumber(e.target.value)} placeholder="e.g. SPEC-001" className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Paracetamol 500mg Tablets" className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Specification Type *</label>
          <select value={specificationType} onChange={(e) => setSpecificationType(e.target.value)} className={inputClass}>
            <option value="finished_product">Finished Product</option>
            <option value="raw_material">Raw Material</option>
            <option value="api">API</option>
            <option value="packaging">Packaging</option>
            <option value="in_process">In-Process</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Product {productRequired ? '*' : '(optional)'}</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
            <option value="">{productRequired ? 'Choose a product from the catalogue…' : 'Not linked to a product'}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {productLabel(p)}
              </option>
            ))}
          </select>
          {products.length === 0 && (
            <p className="mt-1 text-[11px] text-muted-foreground">No products in the catalogue yet. Add one under Master Data first.</p>
          )}
        </div>

        <div>
          <label className={labelClass}>Test Parameters</label>
          <div className="space-y-2">
            {parameters.map((p, i) => (
              <div key={i} className="grid grid-cols-4 gap-2">
                <input placeholder="Parameter" value={p.parameterName} onChange={(e) => updateParameter(i, { parameterName: e.target.value })} className={inputClass} />
                <input placeholder="Lower" value={p.lowerLimit ?? ''} onChange={(e) => updateParameter(i, { lowerLimit: e.target.value })} className={inputClass} />
                <input placeholder="Upper" value={p.upperLimit ?? ''} onChange={(e) => updateParameter(i, { upperLimit: e.target.value })} className={inputClass} />
                <input placeholder="Unit" value={p.unit ?? ''} onChange={(e) => updateParameter(i, { unit: e.target.value })} className={inputClass} />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setParameters((prev) => [...prev, { parameterName: '' }])}
            className="mt-2 text-xs text-safemeds-teal hover:underline"
          >
            + Add another parameter
          </button>
        </div>

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
            Create Draft
          </button>
        </div>
      </div>
    </div>
  )
}

/** The parameter table shown under a specification (limits, method, unit). */
export function SpecificationParameterTable({ spec }: { spec: Specification }) {
  if (spec.parameters.length === 0) {
    return <p className="mt-2 text-xs text-muted-foreground">No parameters recorded.</p>
  }
  return (
    <table className="mt-3 w-full text-xs">
      <thead>
        <tr className="text-left text-muted-foreground">
          <th className="py-1 pr-3">Parameter</th>
          <th className="py-1 pr-3">Test Method</th>
          <th className="py-1 pr-3">Lower</th>
          <th className="py-1 pr-3">Upper</th>
          <th className="py-1">Unit</th>
        </tr>
      </thead>
      <tbody>
        {spec.parameters.map((p) => (
          <tr key={p.id} className="text-foreground">
            <td className="py-1 pr-3">{p.parameterName}</td>
            <td className="py-1 pr-3 text-muted-foreground">{p.testMethod ?? '—'}</td>
            <td className="py-1 pr-3">{p.lowerLimit ?? '—'}</td>
            <td className="py-1 pr-3">{p.upperLimit ?? '—'}</td>
            <td className="py-1">{p.unit ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
