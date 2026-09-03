'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Bell, Construction, Loader2, PackageSearch, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { ProductComplianceRow, ReportingDashboard, getReportingDashboard } from '@/lib/api/reporting-dashboard'
import { Notification, listNotifications } from '@/lib/api/notifications'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { ReportingDashboardPanel } from '@/components/reporting/dashboard-panel'

const CASE_STAGE_PALETTE = ['#0C5446', '#27B89C', '#B08900', '#8B5CF6', '#DC5F5F', '#5B7079']

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

function timeAgo(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/** A dependency-free SVG donut chart — matching `StageBar`'s own "no charting library needed" precedent for a single proportional breakdown. */
function CaseStatusDonut({ byState }: { byState: { stateKey: string; count: number }[] }) {
  const total = byState.reduce((sum, s) => sum + s.count, 0)
  if (total === 0) {
    return <p className="text-sm text-muted-foreground">No open cases right now.</p>
  }

  const radius = 60
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="flex items-center gap-6">
      <svg width={150} height={150} viewBox="0 0 150 150" className="flex-shrink-0">
        {/* Segments only, rotated -90deg (via a <g>, not the whole SVG) so they start at 12 o'clock — the center total text below stays unrotated. */}
        <g transform="rotate(-90 75 75)">
          <circle cx="75" cy="75" r={radius} fill="none" stroke="var(--muted)" strokeWidth={18} />
          {byState.map((s, i) => {
            const fraction = s.count / total
            const dash = fraction * circumference
            const el = (
              <circle
                key={s.stateKey}
                cx="75"
                cy="75"
                r={radius}
                fill="none"
                stroke={CASE_STAGE_PALETTE[i % CASE_STAGE_PALETTE.length]}
                strokeWidth={18}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              />
            )
            offset += dash
            return el
          })}
        </g>
        <text x="75" y="75" textAnchor="middle" dominantBaseline="middle" fill="var(--foreground)" fontSize="28" fontWeight="700">
          {total}
        </text>
      </svg>
      <div className="space-y-1.5">
        {byState.map((s, i) => (
          <div key={s.stateKey} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CASE_STAGE_PALETTE[i % CASE_STAGE_PALETTE.length] }} />
            <span className="capitalize text-foreground">{s.stateKey.replace(/_/g, ' ')}</span>
            <span className="text-muted-foreground">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProductComplianceTable({ rows }: { rows: ProductComplianceRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No products in the catalog yet.</p>
  }
  const atRisk = rows.filter((r) => r.overdueDeadlines > 0 || r.registrationExpiringSoon || r.registrationStatus === 'expired' || r.openQueries > 0)
  const ordered = [...atRisk, ...rows.filter((r) => !atRisk.includes(r))]

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="py-1.5 pr-4">Product</th>
            <th className="py-1.5 pr-4">Open Cases</th>
            <th className="py-1.5 pr-4">Overdue Deadlines</th>
            <th className="py-1.5 pr-4">Registration</th>
            <th className="py-1.5 pr-4">Open Queries</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((r) => {
            const flagged = r.overdueDeadlines > 0 || r.registrationExpiringSoon || r.registrationStatus === 'expired' || r.openQueries > 0
            return (
              <tr key={r.productId} className="border-b border-border/50">
                <td className="py-1.5 pr-4 font-medium text-foreground">{r.brandName}</td>
                <td className="py-1.5 pr-4 text-foreground">{r.openCases}</td>
                <td className={`py-1.5 pr-4 ${r.overdueDeadlines > 0 ? 'font-semibold text-status-error' : 'text-foreground'}`}>{r.overdueDeadlines}</td>
                <td className={`py-1.5 pr-4 ${r.registrationStatus === 'expired' ? 'text-status-error' : r.registrationExpiringSoon ? 'text-status-warning' : 'text-foreground'}`}>
                  {r.registrationStatus ? `${r.registrationStatus} · exp. ${formatDate(r.registrationExpiresOn)}` : 'Not registered'}
                </td>
                <td className={`py-1.5 pr-4 ${r.openQueries > 0 ? 'font-semibold text-status-warning' : 'text-foreground'}`}>{r.openQueries}</td>
                {flagged && <td className="py-1.5"><AlertTriangle className="h-3.5 w-3.5 text-status-warning" /></td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Real-usage request, 11 Sep 2026 — "The unified, real-time view across
 * Regulatory, Quality and PV, every product's live compliance status,
 * what's at risk, what's overdue, in one screen. Add the graphs and
 * notifications the current dashboards are missing, then build the
 * RegCloud and QualCloud dashboards." Reuses `ReportingDashboardPanel`
 * verbatim for the base VigiCloud+RegCloud stat tiles/stage bar (already
 * built, Stage 18 + RegCloud Stage 17) rather than duplicating it, and
 * adds what was genuinely missing: a real case-status donut chart, a
 * live per-product compliance rollup, a notifications feed, and an
 * honest QualCloud "coming soon" section — confirmed with the user as
 * the real scope boundary for this pass (QualCloud has no schema yet).
 */
export function MasterDashboard() {
  const router = useRouter()
  const { has } = usePermissions()

  const [dashboard, setDashboard] = useState<ReportingDashboard | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([getReportingDashboard(), listNotifications({ unreadOnly: true })])
      .then(([d, n]) => {
        if (cancelled) return
        setDashboard(d)
        setNotifications(n.rows.slice(0, 6))
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load the master dashboard.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Master Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">The unified, real-time view across Pharmacovigilance and Regulatory — every product's live compliance status, what's at risk, what's overdue.</p>
      </div>

      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error}</div>}

      {dashboard && (
        <>
          <ReportingDashboardPanel />

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-4 lg:col-span-1">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Open Cases by Stage</p>
              <CaseStatusDonut byState={dashboard.cases.byState} />
            </div>

            <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Bell className="h-3.5 w-3.5" />
                Recent Notifications
              </p>
              {notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing unread — you&apos;re caught up.</p>
              ) : (
                <div className="space-y-2">
                  {notifications.map((n) => (
                    <div key={n.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
                        {n.body && <p className="truncate text-xs text-muted-foreground">{n.body}</p>}
                      </div>
                      <span className="flex-shrink-0 whitespace-nowrap text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
                    </div>
                  ))}
                  <button onClick={() => router.push('/tasks')} className="text-xs font-medium text-safemeds-teal hover:underline">
                    View all in Task Inbox →
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <PackageSearch className="h-3.5 w-3.5" />
              Product Compliance — What Needs Attention
            </p>
            <ProductComplianceTable rows={dashboard.productCompliance} />
          </div>

          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
            <Construction className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">QualCloud (Quality) — Coming Soon</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Deviations, CAPAs, and batch release aren&apos;t built yet — this section will fill in once QualCloud exists as its own module.
            </p>
          </div>
        </>
      )}

      {has('reports.view') && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <p>Product compliance is capped to your 50 most recently added products — see Master Data for the full catalog.</p>
        </div>
      )}
    </div>
  )
}
