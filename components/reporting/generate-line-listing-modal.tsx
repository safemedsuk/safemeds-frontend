'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { getAllCountries, Country } from '@/lib/api/countries'
import { generateLineListing } from '@/lib/api/line-listings'
import { GeneratedReport } from '@/lib/api/reports'
import { Modal } from '@/components/ui/modal'

const inputClass = 'w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm'
const labelClass = 'block text-xs font-medium text-[var(--text-muted)] mb-1'

interface Props {
  onClose: () => void
  onGenerated: (report: GeneratedReport) => void
}

export function GenerateLineListingModal({ onClose, onGenerated }: Props) {
  const [countries, setCountries] = useState<Country[]>([])
  const [countryId, setCountryId] = useState('')
  const [useCustomRange, setUseCustomRange] = useState(false)
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAllCountries()
      .then(setCountries)
      .catch(() => setCountries([]))
  }, [])

  const canSubmit = countryId.length > 0 && (!useCustomRange || (periodStart.length > 0 && periodEnd.length > 0))

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const report = await generateLineListing({ countryId, periodStart: useCustomRange ? periodStart : undefined, periodEnd: useCustomRange ? periodEnd : undefined })
      onGenerated(report)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not generate this line listing.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Generate Line Listing" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Real Excel output of every case for the selected country and period. Leave the period blank to use the country&apos;s own configured reporting cadence.
        </p>

        <div>
          <label className={labelClass}>Country</label>
          <select value={countryId} onChange={(e) => setCountryId(e.target.value)} className={inputClass}>
            <option value="">Select a country…</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-xs text-foreground">
          <input type="checkbox" checked={useCustomRange} onChange={(e) => setUseCustomRange(e.target.checked)} />
          Use a custom date range instead of the configured cadence
        </label>

        {useCustomRange && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Period start</label>
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Period end</label>
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={inputClass} />
            </div>
          </div>
        )}

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
