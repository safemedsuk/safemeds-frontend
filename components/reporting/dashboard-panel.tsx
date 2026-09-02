'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarClock, ClipboardList, FileClock, Loader2, MessageSquare, Radar, ShieldAlert } from 'lucide-react'
import { getReportingDashboard, ReportingDashboard } from '@/lib/api/reporting-dashboard'

/**
 * Real-usage content, 11 Sep 2026 ("more colors on the dashboards, and
 * graphs and stuffs") — `--chart-1` through `--chart-5` have existed as
 * real, already-theme-aware tokens in `globals.css` since this app's
 * own v0 export, and were never actually used anywhere. Each card below
 * gets a real, meaningful hue (grouped by category — case/signal work
 * in the teal family, deadline urgency in true semantic warning/danger
 * colors — those stay reserved for genuine alert states, never
 * decorative — and RegCloud's own metrics in the purple/amber pair) so
 * the dashboard reads as several distinct categories at a glance, not
 * one undifferentiated gray wall of numbers.
 */

type Hue = 'teal' | 'gold' | 'purple' | 'amber' | 'slate' | 'warning' | 'danger'

interface CardProps {
  icon: React.ReactNode
  label: string
  value: number
  hue?: Hue
}

const HUE_STYLES: Record<Hue, { chip: string; icon: string; value: string }> = {
  teal: { chip: 'bg-chart-1/10', icon: 'text-chart-1', value: 'text-foreground' },
  gold: { chip: 'bg-chart-2/15', icon: 'text-chart-2', value: 'text-foreground' },
  purple: { chip: 'bg-chart-4/15', icon: 'text-chart-4', value: 'text-foreground' },
  amber: { chip: 'bg-chart-5/15', icon: 'text-chart-5', value: 'text-foreground' },
  slate: { chip: 'bg-chart-3/15', icon: 'text-chart-3', value: 'text-foreground' },
  warning: { chip: 'bg-status-warning/15', icon: 'text-status-warning', value: 'text-status-warning' },
  danger: { chip: 'bg-status-error/15', icon: 'text-status-error', value: 'text-status-error' },
}

function Card({ icon, label, value, hue = 'slate' }: CardProps) {
  const style = HUE_STYLES[hue]
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full ${style.chip} ${style.icon}`}>{icon}</span>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className={`mt-2 text-2xl font-display font-bold ${style.value}`}>{value}</p>
    </div>
  )
}

/** A rotating, stable-by-index palette for a category with no fixed semantic hue of its own (e.g. one bar segment per workflow stage) — cycles through the same 5 chart tokens every dashboard already uses. */
const STAGE_PALETTE = ['bg-chart-1', 'bg-chart-2', 'bg-chart-4', 'bg-chart-5', 'bg-chart-3']
const STAGE_TEXT_PALETTE = ['text-chart-1', 'text-chart-2', 'text-chart-4', 'text-chart-5', 'text-chart-3']

/** A real, dependency-free horizontal stacked bar — each workflow stage's own share of the total, proportionally, colored consistently with its pill below. No charting library needed for a single stacked proportion bar. */
function StageBar({ stages }: { stages: { stage: string; count: number }[] }) {
  const total = stages.reduce((sum, s) => sum + s.count, 0)
  if (total === 0) return null

  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
      {stages.map((s, i) => {
        const pct = (s.count / total) * 100
        if (pct === 0) return null
        return <div key={s.stage} className={`${STAGE_PALETTE[i % STAGE_PALETTE.length]} h-full`} style={{ width: `${pct}%` }} title={`${s.stage.replace(/_/g, ' ')}: ${s.count}`} />
      })}
    </div>
  )
}

/**
 * VigiCloud Stage 18 — one flexible dashboard, not several role-exclusive
 * screens: every section here is always fetched, and it's simply true
 * that a QPPV cares more about the signals/deadlines cards while
 * Regulatory Affairs cares more about the periodic-reports/line-listings
 * cards — no permission-based hiding needed, since everyone with
 * `reports.view` legitimately benefits from seeing the whole picture.
 */
export function ReportingDashboardPanel() {
  const [dashboard, setDashboard] = useState<ReportingDashboard | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getReportingDashboard()
      .then((d) => {
        if (!cancelled) setDashboard(d)
      })
      .catch(() => {
        // Best-effort — the reports list below still works even if the dashboard summary fails to load.
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
      <div className="flex items-center justify-center rounded-lg border border-border bg-card p-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!dashboard) return null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card icon={<ClipboardList className="h-3.5 w-3.5" />} label="Open Cases" value={dashboard.cases.totalOpen} hue="teal" />
        <Card icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Deadlines Breached" value={dashboard.deadlines.breached} hue={dashboard.deadlines.breached > 0 ? 'danger' : 'slate'} />
        <Card icon={<FileClock className="h-3.5 w-3.5" />} label="Due Within 72h" value={dashboard.deadlines.approaching72h} hue={dashboard.deadlines.approaching72h > 0 ? 'warning' : 'slate'} />
        <Card icon={<Radar className="h-3.5 w-3.5" />} label="Open Signals" value={dashboard.signals.open} hue="gold" />
        <Card icon={<ShieldAlert className="h-3.5 w-3.5" />} label="Safety Alerts Open" value={dashboard.safetyAlertsOpen} hue={dashboard.safetyAlertsOpen > 0 ? 'warning' : 'slate'} />
        <Card icon={<ClipboardList className="h-3.5 w-3.5" />} label="RMP Renewals Due" value={dashboard.rmpRenewalsDue} hue={dashboard.rmpRenewalsDue > 0 ? 'warning' : 'slate'} />
      </div>
      {(dashboard.periodicReportsDue > 0 || dashboard.lineListingsDue > 0) && (
        <div className="rounded-lg border border-status-warning/30 bg-status-warning/5 p-3 text-sm text-foreground">
          {dashboard.periodicReportsDue > 0 && <span className="mr-4">{dashboard.periodicReportsDue} periodic report(s) due within 30 days.</span>}
          {dashboard.lineListingsDue > 0 && <span>{dashboard.lineListingsDue} line listing(s) due within 30 days.</span>}
        </div>
      )}

      {/* RegCloud (Phase 12) Stage 17 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card icon={<CalendarClock className="h-3.5 w-3.5" />} label="Renewals Due (30d)" value={dashboard.regulatory.upcomingRenewals30d} hue={dashboard.regulatory.upcomingRenewals30d > 0 ? 'warning' : 'purple'} />
        <Card icon={<CalendarClock className="h-3.5 w-3.5" />} label="Renewals Due (90d)" value={dashboard.regulatory.upcomingRenewals90d} hue={dashboard.regulatory.upcomingRenewals90d > 0 ? 'warning' : 'purple'} />
        <Card icon={<MessageSquare className="h-3.5 w-3.5" />} label="Open Regulator Queries" value={dashboard.regulatory.openQueries} hue={dashboard.regulatory.openQueries > 0 ? 'warning' : 'amber'} />
      </div>
      {dashboard.regulatory.dossiersByStage.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dossiers by Stage</p>
          <StageBar stages={dashboard.regulatory.dossiersByStage} />
          <div className="mt-2 flex flex-wrap gap-2">
            {dashboard.regulatory.dossiersByStage.map((s, i) => (
              <span key={s.stage} className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                <span className={`h-1.5 w-1.5 rounded-full ${STAGE_PALETTE[i % STAGE_PALETTE.length]}`} />
                <span className={STAGE_TEXT_PALETTE[i % STAGE_TEXT_PALETTE.length]}>{s.stage.replace(/_/g, ' ')}</span>
                <span className="text-muted-foreground">{s.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
