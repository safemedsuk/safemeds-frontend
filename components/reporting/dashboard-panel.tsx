'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, CalendarClock, ClipboardList, FileClock, Loader2, MessageSquare, Radar, ShieldAlert } from 'lucide-react'
import { getReportingDashboard, ReportingDashboard, RegOpenItem } from '@/lib/api/reporting-dashboard'
import { useTranslation } from '@/lib/i18n/use-translation'

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
  /** Real-usage request, 1 Oct 2026 — a stat tile should link to the real underlying list, pre-filtered to match what it's counting, not just be a dead-end number. Omitted entirely for a tile with no single corresponding filtered list (e.g. a "this month" activity count). */
  href?: string
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

function Card({ icon, label, value, hue = 'slate', href }: CardProps) {
  const style = HUE_STYLES[hue]
  const content = (
    <>
      <div className="flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full ${style.chip} ${style.icon}`}>{icon}</span>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className={`mt-2 text-2xl font-display font-bold ${style.value}`}>{value}</p>
    </>
  )
  if (href) {
    return (
      <Link href={href} className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-[var(--primary)] hover:bg-muted/50">
        {content}
      </Link>
    )
  }
  return <div className="rounded-lg border border-border bg-card p-4">{content}</div>
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
 * testing-correction-explanation.md §4.2 — "Registrations by Status,"
 * a real donut chart. The exact same dependency-free SVG technique
 * `master-dashboard.tsx`'s own `CaseStatusDonut` already established
 * (segments rotated via a `<g>`, never the whole `<svg>`, so the center
 * total `<text>` stays unrotated) — copied rather than imported, since
 * that component is scoped to case-state labels/palette specifically.
 */
function StatusDonut({ byStatus }: { byStatus: { status: string; count: number }[] }) {
  const { t } = useTranslation()
  const total = byStatus.reduce((sum, s) => sum + s.count, 0)
  if (total === 0) {
    return <p className="text-sm text-muted-foreground">{t('dashboard.panel.noRegistrationsYet')}</p>
  }

  const radius = 55
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="flex items-center gap-6">
      <svg width={140} height={140} viewBox="0 0 140 140" className="flex-shrink-0">
        <g transform="rotate(-90 70 70)">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--muted)" strokeWidth={16} />
          {byStatus.map((s, i) => {
            const fraction = s.count / total
            const dash = fraction * circumference
            const el = (
              <circle
                key={s.status}
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                className={STAGE_PALETTE[i % STAGE_PALETTE.length].replace('bg-', 'stroke-')}
                strokeWidth={16}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              />
            )
            offset += dash
            return el
          })}
        </g>
        <text x="70" y="70" textAnchor="middle" dominantBaseline="middle" fill="var(--foreground)" fontSize="24" fontWeight="700">
          {total}
        </text>
      </svg>
      <div className="space-y-1.5">
        {byStatus.map((s, i) => (
          <div key={s.status} className="flex items-center gap-2 text-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${STAGE_PALETTE[i % STAGE_PALETTE.length]}`} />
            <span className="capitalize text-foreground">{s.status}</span>
            <span className="text-muted-foreground">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const KIND_LABEL_KEYS: Record<'registration' | 'variation' | 'renewal', 'dashboard.panel.registrations' | 'dashboard.panel.variations' | 'dashboard.panel.renewals'> = {
  registration: 'dashboard.panel.registrations',
  variation: 'dashboard.panel.variations',
  renewal: 'dashboard.panel.renewals',
}

/** testing-correction-explanation.md §4.2 — "Dossiers in Flight by Kind": one `StageBar` per kind (Registration/Variation/Renewal), each with its own real stage breakdown — clearer than one combined chart, and reuses `StageBar` exactly as-is. */
function DossiersByKindSection({ rows }: { rows: { kind: 'registration' | 'variation' | 'renewal'; stage: string; count: number }[] }) {
  const { t } = useTranslation()
  const kinds: ('registration' | 'variation' | 'renewal')[] = ['registration', 'variation', 'renewal']
  const anyRows = rows.length > 0
  if (!anyRows) return null

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('dashboard.panel.dossiersInFlightByKind')}</p>
      {kinds.map((kind) => {
        const stages = rows.filter((r) => r.kind === kind).map((r) => ({ stage: r.stage, count: r.count }))
        const total = stages.reduce((sum, s) => sum + s.count, 0)
        if (total === 0) return null
        return (
          <div key={kind} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">{t(KIND_LABEL_KEYS[kind])}</span>
              <span className="text-muted-foreground">{total}</span>
            </div>
            <StageBar stages={stages} />
            <div className="flex flex-wrap gap-2">
              {stages.map((s, i) => (
                <span key={s.stage} className="flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                  <span className={`h-1.5 w-1.5 rounded-full ${STAGE_PALETTE[i % STAGE_PALETTE.length]}`} />
                  <span className={STAGE_TEXT_PALETTE[i % STAGE_TEXT_PALETTE.length]}>{s.stage.replace(/_/g, ' ')}</span>
                  <span className="text-muted-foreground">{s.count}</span>
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function hrefForOpenItem(item: RegOpenItem): string {
  return item.recordType === 'reg_dossier' ? `/reg-dossiers/${item.recordId}` : `/registrations/${item.recordId}`
}

/**
 * testing-correction-explanation.md §4.2 — "Open Items Needing Action
 * Right Now": a single ranked list across all four categories, each row
 * clickable straight to its own record. Deliberately flat, not grouped
 * into four sub-lists — the point is one place to scan everything that
 * needs a human's attention, in the order it was resolved server-side
 * (each category is itself already ordered by urgency).
 */
function OpenItemsSection({ openItems }: { openItems: ReportingDashboard['regulatory']['openItems'] }) {
  const { t } = useTranslation()
  const router = useRouter()
  const rows: { item: RegOpenItem; hue: string }[] = [
    ...openItems.overduePostMarketObligations.map((item) => ({ item, hue: 'text-status-error' })),
    ...openItems.longOpenQueries.map((item) => ({ item, hue: 'text-status-warning' })),
    ...openItems.registrationsExpiringSoonWithNoRenewalStarted.map((item) => ({ item, hue: 'text-status-warning' })),
    ...openItems.retentionsDueNotLogged.map((item) => ({ item, hue: 'text-status-warning' })),
  ]

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{t('dashboard.panel.openItemsNeedingAction')}</p>
        <p className="text-sm text-muted-foreground">{t('dashboard.panel.nothingNeedsAction')}</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t('dashboard.panel.openItemsNeedingActionCount', { count: rows.length })}</p>
      <ul className="divide-y divide-border">
        {rows.map(({ item, hue }, i) => (
          <li key={`${item.recordType}-${item.recordId}-${i}`}>
            <button
              onClick={() => router.push(hrefForOpenItem(item))}
              className="flex w-full items-center gap-2 py-2 text-left text-sm hover:bg-muted/50 rounded-md px-1 -mx-1"
            >
              <AlertTriangle className={`h-3.5 w-3.5 flex-shrink-0 ${hue}`} />
              <span className="text-foreground">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** testing-correction-explanation.md §4.2 — "This Month's Activity": a simple count strip, reusing the existing `Card` component's own hue system. */
function ThisMonthActivitySection({ activity }: { activity: ReportingDashboard['regulatory']['thisMonthActivity'] }) {
  const { t } = useTranslation()
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('dashboard.panel.thisMonthActivity')}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card icon={<FileClock className="h-3.5 w-3.5" />} label={t('dashboard.panel.dossiersSubmitted')} value={activity.dossiersSubmitted} hue="purple" />
        <Card icon={<ClipboardList className="h-3.5 w-3.5" />} label={t('dashboard.panel.approvalsReceived')} value={activity.approvalsReceived} hue="teal" />
        <Card icon={<MessageSquare className="h-3.5 w-3.5" />} label={t('dashboard.panel.queriesLogged')} value={activity.queriesLogged} hue="amber" />
        <Card icon={<ShieldAlert className="h-3.5 w-3.5" />} label={t('dashboard.panel.retentionsCertified')} value={activity.retentionsCertified} hue="gold" />
      </div>
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
  const { t } = useTranslation()
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
        {/* "Open" here means "not in a terminal workflow state" — PV Cases has no single matching list-screen status value (its own filter is per-stage, e.g. intake/triage/...), so this links to the unfiltered list rather than a query string that would silently match nothing. */}
        <Card icon={<ClipboardList className="h-3.5 w-3.5" />} label={t('dashboard.panel.openCases')} value={dashboard.cases.totalOpen} hue="teal" href="/pv-cases" />
        <Card icon={<AlertTriangle className="h-3.5 w-3.5" />} label={t('dashboard.panel.deadlinesBreached')} value={dashboard.deadlines.breached} hue={dashboard.deadlines.breached > 0 ? 'danger' : 'slate'} />
        <Card icon={<FileClock className="h-3.5 w-3.5" />} label={t('dashboard.panel.dueWithin72h')} value={dashboard.deadlines.approaching72h} hue={dashboard.deadlines.approaching72h > 0 ? 'warning' : 'slate'} />
        <Card icon={<Radar className="h-3.5 w-3.5" />} label={t('dashboard.panel.openSignals')} value={dashboard.signals.open} hue="gold" />
        <Card icon={<ShieldAlert className="h-3.5 w-3.5" />} label={t('dashboard.panel.safetyAlertsOpen')} value={dashboard.safetyAlertsOpen} hue={dashboard.safetyAlertsOpen > 0 ? 'warning' : 'slate'} href="/safety-alerts?status=open" />
        <Card icon={<ClipboardList className="h-3.5 w-3.5" />} label={t('dashboard.panel.rmpRenewalsDue')} value={dashboard.rmpRenewalsDue} hue={dashboard.rmpRenewalsDue > 0 ? 'warning' : 'slate'} />
      </div>
      {(dashboard.periodicReportsDue > 0 || dashboard.lineListingsDue > 0) && (
        <div className="rounded-lg border border-status-warning/30 bg-status-warning/5 p-3 text-sm text-foreground">
          {dashboard.periodicReportsDue > 0 && <span className="mr-4">{t('dashboard.panel.periodicReportsDueCount', { count: dashboard.periodicReportsDue })}</span>}
          {dashboard.lineListingsDue > 0 && <span>{t('dashboard.panel.lineListingsDueCount', { count: dashboard.lineListingsDue })}</span>}
        </div>
      )}

      {/* RegCloud (Phase 12) Stage 17 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card icon={<CalendarClock className="h-3.5 w-3.5" />} label={t('dashboard.panel.renewalsDue30d')} value={dashboard.regulatory.upcomingRenewals30d} hue={dashboard.regulatory.upcomingRenewals30d > 0 ? 'warning' : 'purple'} />
        <Card icon={<CalendarClock className="h-3.5 w-3.5" />} label={t('dashboard.panel.renewalsDue90d')} value={dashboard.regulatory.upcomingRenewals90d} hue={dashboard.regulatory.upcomingRenewals90d > 0 ? 'warning' : 'purple'} />
        <Card icon={<MessageSquare className="h-3.5 w-3.5" />} label={t('dashboard.panel.openRegulatorQueries')} value={dashboard.regulatory.openQueries} hue={dashboard.regulatory.openQueries > 0 ? 'warning' : 'amber'} href="/reg-queries?status=open" />
      </div>
      {dashboard.regulatory.dossiersByStage.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('dashboard.panel.dossiersByStage')}</p>
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

      {/* testing-correction-explanation.md §4.2 — the RegCloud dashboard, properly. */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('dashboard.panel.registrationsByStatus')}</p>
          <StatusDonut byStatus={dashboard.regulatory.registrationsByStatus} />
        </div>
        <DossiersByKindSection rows={dashboard.regulatory.dossiersByKindAndStage} />
      </div>

      <OpenItemsSection openItems={dashboard.regulatory.openItems} />

      <ThisMonthActivitySection activity={dashboard.regulatory.thisMonthActivity} />
    </div>
  )
}
