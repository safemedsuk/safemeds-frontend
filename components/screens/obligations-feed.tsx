'use client'

import { useEffect, useState } from 'react'
import { Loader2, CalendarClock } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { ObligationFeedItem, getObligationsFeed } from '@/lib/api/environmental-monitoring-stability'

const MODULE_LABELS: Record<string, string> = {
  vigicloud: 'VigiCloud',
  regulatory: 'RegCloud',
  qualcloud: 'QualCloud',
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString()
}

/**
 * QualCloud (Phase 13) Stage 20 — Deadlines/Obligations across every
 * module: a single chronological feed over `Deadline` (VigiCloud),
 * `RegDeadline`/`RegPostMarketObligation` (RegCloud), and
 * `Capa.dueDate`/`Equipment.calibrationDueAt`/`maintenanceDueAt`/
 * `TrainingRecord.expiryDate` (QualCloud) — never a second deadline
 * engine, a read-only composition over clocks that already exist.
 */
export function ObligationsFeedScreen() {
  const [rows, setRows] = useState<ObligationFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getObligationsFeed()
      .then(setRows)
      .catch((err) => setError(getErrorMessage(err, 'Could not load the obligations feed.')))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Deadlines &amp; Obligations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every real due date across VigiCloud, RegCloud, and QualCloud, in one chronological list.
        </p>
      </div>

      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarClock className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Nothing due in the next or past 90 days.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">Module</th>
                <th className="p-3">Obligation</th>
                <th className="p-3">Due</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={`${r.recordType}-${r.recordId}-${idx}`} className="border-b border-border last:border-0">
                  <td className="p-3 text-muted-foreground">{MODULE_LABELS[r.module] ?? r.module}</td>
                  <td className="p-3 text-foreground">{r.label}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(r.dueAt)}</td>
                  <td className="p-3">
                    {r.overdue ? (
                      <span className="rounded-full bg-status-error/10 px-2 py-0.5 text-xs font-medium text-status-error">Overdue</span>
                    ) : (
                      <span className="rounded-full bg-status-success/10 px-2 py-0.5 text-xs font-medium text-status-success">Upcoming</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
