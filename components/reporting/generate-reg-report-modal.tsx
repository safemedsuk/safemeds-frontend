'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { generatePortfolioStatusReport, generateUpcomingRenewalsReport, generateDossierTurnaroundReport } from '@/lib/api/reg-reporting'
import { GeneratedReport } from '@/lib/api/reports'
import { Modal } from '@/components/ui/modal'

const inputClass = 'w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm'
const labelClass = 'block text-xs font-medium text-[var(--text-muted)] mb-1'

const REPORT_KINDS = [
  { value: 'portfolio_status', label: 'Portfolio Status', description: 'A real snapshot of every registration/dossier — product, authority, class, status, registration number, expiry.' },
  { value: 'upcoming_renewals', label: 'Upcoming Renewals', description: 'Every renewal deadline due within a window you choose, reusing the same deadline engine the dashboard reads.' },
  { value: 'dossier_turnaround', label: 'Dossier Turnaround-Time', description: 'Calendar days from planning to approved/rejected, per dossier, computed live from the audit trail.' },
] as const

interface Props {
  onClose: () => void
  onGenerated: (report: GeneratedReport) => void
}

/** RegCloud (Phase 12) Stage 17 — one combined modal for the three RegCloud report generators, all real .xlsx exports reusing `GeneratedReport`. */
export function GenerateRegReportModal({ onClose, onGenerated }: Props) {
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
      setError(getErrorMessage(err, 'Could not generate this report.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Generate a Regulatory Report" onClose={onClose}>
      <div className="space-y-3">
        <div className="space-y-1.5">
          {REPORT_KINDS.map((k) => (
            <label
              key={k.value}
              className={`flex items-start gap-2 rounded-lg border p-3 text-sm cursor-pointer ${kind === k.value ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-[var(--border)]'}`}
            >
              <input type="radio" name="reg-report-kind" checked={kind === k.value} onChange={() => setKind(k.value)} className="mt-1" />
              <div>
                <p className="font-medium text-[var(--text)]">{k.label}</p>
                <p className="text-xs text-[var(--text-muted)]">{k.description}</p>
              </div>
            </label>
          ))}
        </div>

        {kind === 'upcoming_renewals' && (
          <div>
            <label className={labelClass}>Within how many days (default 90)</label>
            <input type="number" min={1} value={withinDays} onChange={(e) => setWithinDays(e.target.value)} className={inputClass} />
          </div>
        )}

        {error && <p className="text-xs text-status-error">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text)]">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
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
