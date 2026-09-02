'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { BenefitRiskSummary, getBenefitRiskSummary } from '@/lib/api/benefit-risk'
import { Product, listProducts } from '@/lib/api/master-data'
import { Modal } from '@/components/ui/modal'

const inputClass = 'w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm'
const labelClass = 'block text-xs font-medium text-[var(--text-muted)] mb-1'

function BreakdownTable({ title, breakdown }: { title: string; breakdown: Record<string, number> }) {
  const entries = Object.entries(breakdown)
  const total = entries.reduce((sum, [, v]) => sum + v, 0)
  if (total === 0) {
    return (
      <div>
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">No data.</p>
      </div>
    )
  }
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-foreground">{title}</p>
      <ul className="space-y-0.5">
        {entries
          .filter(([, v]) => v > 0)
          .map(([key, value]) => (
            <li key={key} className="flex justify-between text-xs text-muted-foreground">
              <span className="capitalize">{key.replace(/_/g, ' ')}</span>
              <span className="font-mono text-foreground">{value}</span>
            </li>
          ))}
      </ul>
    </div>
  )
}

interface Props {
  onClose: () => void
}

/** VigiCloud Stage 18 — "a data view, not a separate workflow." Standalone access to the exact same aggregation `PeriodicReportService` embeds in a generated PSUR/PBRER. */
export function BenefitRiskModal({ onClose }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [productId, setProductId] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [summary, setSummary] = useState<BenefitRiskSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listProducts({ limit: 100 })
      .then(({ rows }) => setProducts(rows))
      .catch(() => setProducts([]))
  }, [])

  const load = async () => {
    if (!productId) return
    setLoading(true)
    setError(null)
    try {
      setSummary(await getBenefitRiskSummary(productId, periodStart || undefined, periodEnd || undefined))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load benefit-risk data.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Benefit-Risk View" onClose={onClose} maxWidth="max-w-xl">
      <div className="space-y-3">
        <div>
          <label className={labelClass}>Product</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
            <option value="">Select a product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brandName}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Period start (optional)</label>
            <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Period end (optional)</label>
            <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={inputClass} />
          </div>
        </div>

        <button
          onClick={load}
          disabled={!productId || loading}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Load Summary
        </button>

        {error && <p className="text-xs text-status-error">{error}</p>}

        {summary && (
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm font-semibold text-foreground">{summary.caseCount} case(s) with this product as a suspect, cumulative{summary.periodStart ? ` within the selected period` : ''}.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <BreakdownTable title="Seriousness" breakdown={summary.seriousnessBreakdown} />
              <BreakdownTable title="Expectedness / Listedness" breakdown={summary.expectednessBreakdown} />
              <BreakdownTable title="Adverse Event Outcome" breakdown={summary.adverseEventOutcomeBreakdown} />
              <BreakdownTable title="Causality (WHO-UMC)" breakdown={summary.causalityBreakdown} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
