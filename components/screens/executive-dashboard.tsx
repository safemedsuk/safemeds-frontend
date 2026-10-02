'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { ExecutiveDashboard, getExecutiveDashboard } from '@/lib/api/environmental-monitoring-stability'

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString()
}

/**
 * QualCloud (Phase 13) Stage 20 — the Unified Cross-Module Executive
 * Dashboard: a thin composition of RegCloud's own registration/licence
 * risk (already live in `DashboardService.getDashboard()`'s
 * `regulatory` section), QualCloud's own inspection-readiness summary,
 * VigiCloud's own reporting/signal status, and the top 10 soonest-due
 * obligations across every module — each drillable into its own
 * module's own detail screen.
 */
export function ExecutiveDashboardScreen() {
  const [data, setData] = useState<ExecutiveDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getExecutiveDashboard()
      .then(setData)
      .catch((err) => setError(getErrorMessage(err, 'Could not load the executive dashboard.')))
      .finally(() => setLoading(false))
  }, [])

  const dashboard = data?.dashboard as
    | {
        cases?: { totalOpen: number }
        signals?: { open: number }
        deadlines?: { breached: number; approaching24h: number }
        regulatory?: { upcomingRenewals30d: number; openQueries: number }
        qualcloud?: { available: boolean; capasOverdue: number; deviationsOpenBySeverity: { severity: string; count: number }[] }
      }
    | undefined

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Executive Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One unified view across VigiCloud, RegCloud, and QualCloud — drill into any module for detail.
        </p>
      </div>

      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <a href="/pv-cases" className="rounded-lg border border-border bg-card p-5 hover:border-safemeds-teal transition-colors">
              <h2 className="font-semibold text-foreground">VigiCloud</h2>
              <p className="mt-2 text-2xl font-bold text-foreground">{dashboard?.cases?.totalOpen ?? 0}</p>
              <p className="text-xs text-muted-foreground">open PV cases</p>
              <p className="mt-1 text-xs text-status-error">{dashboard?.deadlines?.breached ?? 0} breached deadline(s)</p>
              <p className="mt-1 text-xs text-muted-foreground">{dashboard?.signals?.open ?? 0} open signal(s)</p>
            </a>
            <a href="/reg-dossiers" className="rounded-lg border border-border bg-card p-5 hover:border-safemeds-teal transition-colors">
              <h2 className="font-semibold text-foreground">RegCloud</h2>
              <p className="mt-2 text-2xl font-bold text-foreground">{dashboard?.regulatory?.upcomingRenewals30d ?? 0}</p>
              <p className="text-xs text-muted-foreground">renewals due within 30 days</p>
              <p className="mt-1 text-xs text-muted-foreground">{dashboard?.regulatory?.openQueries ?? 0} open regulator query(ies)</p>
            </a>
            <a href="/quality-capas" className="rounded-lg border border-border bg-card p-5 hover:border-safemeds-teal transition-colors">
              <h2 className="font-semibold text-foreground">QualCloud</h2>
              {dashboard?.qualcloud?.available ? (
                <>
                  <p className="mt-2 text-2xl font-bold text-foreground">{dashboard.qualcloud.capasOverdue}</p>
                  <p className="text-xs text-muted-foreground">overdue CAPAs</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">QualCloud module access not yet on for this company.</p>
              )}
            </a>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="mb-3 font-semibold text-foreground">Readiness Overview</h2>
            <div className="flex gap-4 text-sm">
              <span>VigiCloud: <strong className="text-foreground">{data.readiness.vigicloud.overall}</strong></span>
              <span>QualCloud: <strong className="text-foreground">{data.readiness.qualcloud.overall}</strong></span>
              <span>RegCloud: <strong className="text-foreground">{data.readiness.regulatory.overall}</strong></span>
            </div>
            <a href="/cross-module-readiness" className="mt-2 inline-block text-xs font-medium text-safemeds-teal hover:underline">
              View full readiness breakdown →
            </a>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Top Upcoming Obligations</h2>
              <a href="/obligations-feed" className="text-xs font-medium text-safemeds-teal hover:underline">View all →</a>
            </div>
            {data.topObligations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing due soon.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.topObligations.map((o, idx) => (
                  <li key={idx} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                    <span className="text-foreground">{o.label}</span>
                    <span className={o.overdue ? 'text-status-error' : 'text-muted-foreground'}>{formatDate(o.dueAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
