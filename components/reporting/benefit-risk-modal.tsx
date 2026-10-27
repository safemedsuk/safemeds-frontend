'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { BenefitRiskSummary, getBenefitRiskSummary } from '@/lib/api/benefit-risk'
import { Product, listProducts } from '@/lib/api/master-data'
import { Modal } from '@/components/ui/modal'
import { useTranslation } from '@/lib/i18n/use-translation'

const inputClass = 'w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm'
const labelClass = 'block text-xs font-medium text-[var(--text-muted)] mb-1'

function BreakdownTable({ title, breakdown, noDataLabel }: { title: string; breakdown: Record<string, number>; noDataLabel: string }) {
  const entries = Object.entries(breakdown)
  const total = entries.reduce((sum, [, v]) => sum + v, 0)
  if (total === 0) {
    return (
      <div>
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{noDataLabel}</p>
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
  const { t } = useTranslation()
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
      setError(getErrorMessage(err, t('benefitRisk.errorLoad')))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title={t('benefitRisk.title')} onClose={onClose} maxWidth="max-w-xl">
      <div className="space-y-3">
        <div>
          <label className={labelClass}>{t('benefitRisk.product')}</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
            <option value="">{t('benefitRisk.selectProductEllipsis')}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brandName}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t('benefitRisk.periodStartOptional')}</label>
            <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t('benefitRisk.periodEndOptional')}</label>
            <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={inputClass} />
          </div>
        </div>

        <button
          onClick={load}
          disabled={!productId || loading}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t('benefitRisk.loadSummary')}
        </button>

        {error && <p className="text-xs text-status-error">{error}</p>}

        {summary && (
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm font-semibold text-foreground">
              {t(summary.periodStart ? 'benefitRisk.caseCountSummaryWithPeriod' : 'benefitRisk.caseCountSummaryNoPeriod', { count: String(summary.caseCount) })}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <BreakdownTable title={t('pvCaseDetail.seriousness')} breakdown={summary.seriousnessBreakdown} noDataLabel={t('benefitRisk.noData')} />
              <BreakdownTable title={t('pvCaseDetail.sectionExpectedness')} breakdown={summary.expectednessBreakdown} noDataLabel={t('benefitRisk.noData')} />
              <BreakdownTable title={t('benefitRisk.adverseEventOutcome')} breakdown={summary.adverseEventOutcomeBreakdown} noDataLabel={t('benefitRisk.noData')} />
              <BreakdownTable title={t('benefitRisk.causalityWhoUmc')} breakdown={summary.causalityBreakdown} noDataLabel={t('benefitRisk.noData')} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
