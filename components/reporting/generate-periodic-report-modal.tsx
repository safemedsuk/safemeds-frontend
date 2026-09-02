'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { listClinicalTrials, ClinicalTrial } from '@/lib/api/clinical-trials'
import { Product, listProducts } from '@/lib/api/master-data'
import { AUTO_CADENCE_REPORT_TYPES, generatePeriodicReport, PERIODIC_REPORT_TYPE_LABELS, PeriodicReportTypeKey, PeriodicReportWithSummary } from '@/lib/api/periodic-reports'
import { Modal } from '@/components/ui/modal'

const inputClass = 'w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm'
const labelClass = 'block text-xs font-medium text-[var(--text-muted)] mb-1'

interface Props {
  onClose: () => void
  onGenerated: (report: PeriodicReportWithSummary) => void
}

export function GeneratePeriodicReportModal({ onClose, onGenerated }: Props) {
  const [reportTypeKey, setReportTypeKey] = useState<PeriodicReportTypeKey>('psur')
  const [products, setProducts] = useState<Product[]>([])
  const [trials, setTrials] = useState<ClinicalTrial[]>([])
  const [productId, setProductId] = useState('')
  const [clinicalTrialId, setClinicalTrialId] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [conclusionNote, setConclusionNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isTrialBased = reportTypeKey === 'dsur'
  const isAutoCadence = AUTO_CADENCE_REPORT_TYPES.includes(reportTypeKey)

  useEffect(() => {
    if (isTrialBased) {
      listClinicalTrials({ limit: 100 })
        .then(({ trials }) => setTrials(trials))
        .catch(() => setTrials([]))
    } else {
      listProducts({ limit: 100 })
        .then(({ rows }) => setProducts(rows))
        .catch(() => setProducts([]))
    }
  }, [isTrialBased])

  const needsExplicitPeriod = !isAutoCadence
  const canSubmit = (isTrialBased ? clinicalTrialId.length > 0 : productId.length > 0) && (!needsExplicitPeriod || (periodStart.length > 0 && periodEnd.length > 0))

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const report = await generatePeriodicReport({
        reportTypeKey,
        productId: isTrialBased ? undefined : productId,
        clinicalTrialId: isTrialBased ? clinicalTrialId : undefined,
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
        conclusionNote: conclusionNote.trim() || undefined,
      })
      onGenerated(report)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not generate this report.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Generate Periodic Report" onClose={onClose} maxWidth="max-w-xl">
      <div className="space-y-3">
        <div>
          <label className={labelClass}>Report type</label>
          <select
            value={reportTypeKey}
            onChange={(e) => {
              setReportTypeKey(e.target.value as PeriodicReportTypeKey)
              setProductId('')
              setClinicalTrialId('')
              setPeriodStart('')
              setPeriodEnd('')
            }}
            className={inputClass}
          >
            {Object.entries(PERIODIC_REPORT_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            {isAutoCadence
              ? 'Periodicity and Data Lock Point are computed automatically from GUD/022\'s confirmed EURD cadence — leave the period blank unless overriding it.'
              : 'No confirmed automatic cadence exists for this report type — an explicit period is required.'}
          </p>
        </div>

        {isTrialBased ? (
          <div>
            <label className={labelClass}>Clinical trial</label>
            <select value={clinicalTrialId} onChange={(e) => setClinicalTrialId(e.target.value)} className={inputClass}>
              <option value="">Select a trial…</option>
              {trials.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.trialName} ({t.trialReference})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className={labelClass}>Product</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
              <option value="">Select a product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brandName}
                  {!p.internationalBirthDate && isAutoCadence ? ' — no international birth date set' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {(needsExplicitPeriod || isTrialBased) && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Period start {needsExplicitPeriod && '*'}</label>
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Period end {needsExplicitPeriod && '*'}</label>
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={inputClass} />
            </div>
          </div>
        )}

        <div>
          <label className={labelClass}>Benefit-risk conclusion (optional)</label>
          <textarea value={conclusionNote} onChange={(e) => setConclusionNote(e.target.value)} rows={3} className={inputClass} placeholder="e.g. No new safety signal identified in this period." />
        </div>

        {error && <p className="text-xs text-status-error">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text)]">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--primary)] text-white text-xs font-medium disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Generate
          </button>
        </div>
      </div>
    </Modal>
  )
}
