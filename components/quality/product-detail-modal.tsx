'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { listRegistrations, Product, ProductRegistration, PRODUCT_CATEGORY_LABELS } from '@/lib/api/master-data'
import { listSpecifications, Specification } from '@/lib/api/quality'
import { CreateSpecificationModal, SpecificationParameterTable } from '@/components/quality/specification-parts'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'

/**
 * Phase 2 Pass C — the product view. Master data, registrations and every
 * specification linked to this product, with its parameters. Creating a
 * specification from here pre-links this product, and the view reloads at
 * once so the new specification appears without a page refresh.
 */
export function ProductDetailModal({
  product,
  products,
  canManage,
  onClose,
}: {
  product: Product
  products: Product[]
  canManage: boolean
  onClose: () => void
}) {
  const [specs, setSpecs] = useState<Specification[]>([])
  const [registrations, setRegistrations] = useState<ProductRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [notice, setNotice] = useTimedMessage()

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      listSpecifications({ productId: product.id, page: 1, limit: 100 }),
      listRegistrations({ productId: product.id, page: 1, limit: 100 }).catch(() => ({ rows: [] as ProductRegistration[] })),
    ])
      .then(([specRes, regRes]) => {
        setSpecs(specRes.rows)
        setRegistrations(regRes.rows)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load this product.')))
      .finally(() => setLoading(false))
  }, [product.id])

  useEffect(load, [load])

  const field = (label: string, value: string | null | undefined) => (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value && value.length > 0 ? value : '—'}</dd>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-lg border border-border bg-card p-6 space-y-6 my-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-xl text-foreground">{product.brandName}</h2>
            <p className="text-sm text-muted-foreground">
              {product.genericName} {product.strength} · {PRODUCT_CATEGORY_LABELS[product.productCategory]}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted">
            Close
          </button>
        </div>

        <section>
          <h3 className="text-sm font-semibold text-foreground mb-2">Master data</h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
            {field('Brand name', product.brandName)}
            {field('Generic name', product.genericName)}
            {field('INN', product.innName)}
            {field('Strength', product.strength)}
            {field('Dosage form', product.dosageForm)}
            {field('Formulation', product.formulation)}
            {field('Route', product.routeOfAdministration)}
            {field('ATC code', product.atcCode)}
            {field('Site of manufacture', product.siteOfManufacture)}
            {field('Pack sizes', product.packSizes.length ? product.packSizes.join(', ') : null)}
            {field('International birth date', product.internationalBirthDate?.slice(0, 10))}
            {field('Status', product.isActive ? 'Active' : 'Deactivated')}
          </dl>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-foreground mb-2">Registrations</h3>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : registrations.length === 0 ? (
            <p className="text-xs text-muted-foreground">No registrations recorded for this product yet.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-3">Authority</th>
                  <th className="py-1 pr-3">Registration number</th>
                  <th className="py-1 pr-3">Status</th>
                  <th className="py-1">Expires</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((r) => (
                  <tr key={r.id} className="text-foreground">
                    <td className="py-1 pr-3">{r.authority.name}</td>
                    <td className="py-1 pr-3 font-mono">{r.registrationNumber}</td>
                    <td className="py-1 pr-3 capitalize">{r.status}</td>
                    <td className="py-1">{r.expiresOn.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">Specifications</h3>
            {canManage && (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce"
              >
                <Plus className="h-3.5 w-3.5" /> New specification for this product
              </button>
            )}
          </div>
          {notice && <div className="mb-2 rounded-lg border border-status-success bg-status-success/10 p-2 text-xs text-status-success">{notice}</div>}
          {error && <div className="mb-2 rounded-lg border border-status-error bg-status-error/10 p-2 text-xs text-status-error">{error}</div>}
          {loading ? null : specs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No specifications linked to this product yet.</p>
          ) : (
            <div className="space-y-4">
              {specs.map((spec) => (
                <div key={spec.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs text-muted-foreground">{spec.specificationNumber}</span>
                      <p className="font-medium text-foreground">{spec.title}</p>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground capitalize">
                      {spec.specificationType.replace(/_/g, ' ')} · v{spec.version} · {spec.status}
                    </span>
                  </div>
                  <SpecificationParameterTable spec={spec} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {showCreate && (
        <CreateSpecificationModal
          products={products}
          defaultProductId={product.id}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            setNotice('Specification created as a draft and linked to this product.')
            load()
          }}
        />
      )}
    </div>
  )
}
