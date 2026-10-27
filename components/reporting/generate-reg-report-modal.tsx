'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { generatePortfolioStatusReport, generateUpcomingRenewalsReport, generateDossierTurnaroundReport } from '@/lib/api/reg-reporting'
import { GeneratedReport } from '@/lib/api/reports'
import { Modal } from '@/components/ui/modal'
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

const inputClass = 'w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm'
const labelClass = 'block text-xs font-medium text-[var(--text-muted)] mb-1'

const REPORT_KINDS = [
  { value: 'portfolio_status', labelKey: 'generateRegReport.portfolioStatusLabel', descriptionKey: 'generateRegReport.portfolioStatusDescription' },
  { value: 'upcoming_renewals', labelKey: 'generateRegReport.upcomingRenewalsLabel', descriptionKey: 'generateRegReport.upcomingRenewalsDescription' },
  { value: 'dossier_turnaround', labelKey: 'generateRegReport.dossierTurnaroundLabel', descriptionKey: 'generateRegReport.dossierTurnaroundDescription' },
] as const satisfies readonly { value: string; labelKey: MessageKey; descriptionKey: MessageKey }[]

interface Props {
  onClose: () => void
  onGenerated: (report: GeneratedReport) => void
}

/** RegCloud (Phase 12) Stage 17 — one combined modal for the three RegCloud report generators, all real .xlsx exports reusing `GeneratedReport`. */
export function GenerateRegReportModal({ onClose, onGenerated }: Props) {
  const { t } = useTranslation()
  const [kind, setKind] = useState<(typeof REPORT_KINDS)[number]['value']>('portfolio_status')
  const [withinDays, setWithinDays] = useState('90')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const report =
        kind === 'portfolio_status'
          ? await generatePortfolioStatusReport()
          : kind === 'upcoming_renewals'
            ? await generateUpcomingRenewalsReport(withinDays ? Number(withinDays) : undefined)
            : await generateDossierTurnaroundReport()
      onGenerated(report)
    } catch (err) {
      setError(getErrorMessage(err, t('generateRegReport.couldNotGenerate')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={t('generateRegReport.title')} onClose={onClose}>
      <div className="space-y-3">
        <div className="space-y-1.5">
          {REPORT_KINDS.map((k) => (
            <label
              key={k.value}
              className={`flex items-start gap-2 rounded-lg border p-3 text-sm cursor-pointer ${kind === k.value ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-[var(--border)]'}`}
            >
              <input type="radio" name="reg-report-kind" checked={kind === k.value} onChange={() => setKind(k.value)} className="mt-1" />
              <div>
                <p className="font-medium text-[var(--text)]">{t(k.labelKey)}</p>
                <p className="text-xs text-[var(--text-muted)]">{t(k.descriptionKey)}</p>
              </div>
            </label>
          ))}
        </div>

        {kind === 'upcoming_renewals' && (
          <div>
            <label className={labelClass}>{t('generateRegReport.withinDaysLabel')}</label>
            <input type="number" min={1} value={withinDays} onChange={(e) => setWithinDays(e.target.value)} className={inputClass} />
          </div>
        )}

        {error && <p className="text-xs text-status-error">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text)]">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--primary)] text-white text-xs font-medium disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t('generateRegReport.generate')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
