'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Building2,
  CheckCircle2,
  Clock,
  Database,
  FileWarning,
  Loader2,
  PauseCircle,
  RefreshCw,
  Server,
  Zap,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { getErrorMessage } from '@/lib/api/client'
import {
  getDashboardOverview,
  getRegulatoryCoverage,
  getSystemHealth,
  runDeadlineScan,
  type DashboardOverview,
  type RegulatoryCoverageRow,
  type SystemHealth,
} from '@/lib/api/platform-dashboard'

/** Real-usage content, 11 Sep 2026 ("more colors on the dashboards") — the icon chip now carries a real hue from the same `--chart-*` tokens `ReportingDashboardPanel` uses, instead of every tile reading as the same flat gray-on-white regardless of what it's showing. `warn`/`ok` stay true semantic status colors, reserved for a genuine alert/success state — `accent` is the new decorative default for a tile with nothing to alert on. */
function StatTile({
  label,
  value,
  icon: Icon,
  tone = 'accent',
}: {
  label: string
  value: string | number
  icon: typeof Building2
  tone?: 'accent' | 'warn' | 'ok' | 'purple' | 'gold'
}) {
  const valueToneClass = tone === 'warn' ? 'text-status-warning' : tone === 'ok' ? 'text-status-success' : 'text-[var(--text)]'
  const chipClass =
    tone === 'warn'
      ? 'bg-status-warning/15 text-status-warning'
      : tone === 'ok'
        ? 'bg-status-success/15 text-status-success'
        : tone === 'purple'
          ? 'bg-chart-4/15 text-chart-4'
          : tone === 'gold'
            ? 'bg-chart-2/15 text-chart-2'
            : 'bg-chart-1/10 text-chart-1'
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-[var(--text-muted)]">{label}</p>
        <span className={`flex h-6 w-6 items-center justify-center rounded-full ${chipClass}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className={`text-2xl font-display font-semibold tabular-nums ${valueToneClass}`}>{value}</p>
    </div>
  )
}

function SectionCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="p-5 border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold text-[var(--text)]">{title}</h2>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

const HealthBadge = ({ status }: { status: string }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
      status === 'up' ? 'bg-status-success/10 text-status-success' : 'bg-status-error/10 text-status-error'
    }`}
  >
    {status === 'up' ? <CheckCircle2 className="h-3 w-3" /> : <FileWarning className="h-3 w-3" />}
    {status === 'up' ? 'Operational' : 'Down'}
  </span>
)

const QueueRow = ({ label, depth }: { label: string; depth: { waiting: number; active: number; delayed: number; failed: number } }) => (
  <div className="flex items-center justify-between py-2 text-sm">
    <span className="text-[var(--text)]">{label}</span>
    <div className="flex items-center gap-4 font-mono text-xs">
      <span className="text-[var(--text-muted)]">waiting {depth.waiting}</span>
      <span className="text-[var(--text-muted)]">delayed {depth.delayed}</span>
      <span className={depth.failed > 0 ? 'text-status-error font-semibold' : 'text-[var(--text-muted)]'}>failed {depth.failed}</span>
    </div>
  </div>
)

export default function PlatformDashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [coverage, setCoverage] = useState<RegulatoryCoverageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [o, h, c] = await Promise.all([getDashboardOverview(), getSystemHealth(), getRegulatoryCoverage()])
      setOverview(o)
      setHealth(h)
      setCoverage(c)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load the platform dashboard.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleScan = async () => {
    setScanning(true)
    setScanResult(null)
    try {
      const result = await runDeadlineScan()
      setScanResult(`Scan complete: ${result.breached} breached, ${result.t24} approaching (24h), ${result.t72} approaching (72h).`)
      const h = await getSystemHealth()
      setHealth(h)
    } catch (err) {
      setScanResult(getErrorMessage(err, 'Deadline scan failed.'))
    } finally {
      setScanning(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-[var(--text-muted)]">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading dashboard…
      </div>
    )
  }

  const approved = overview?.registrationsByStatus.approved ?? 0
  const pending = (overview?.registrationsByStatus.pending_verification ?? 0) + (overview?.registrationsByStatus.under_review ?? 0)
  const rejected = overview?.registrationsByStatus.rejected ?? 0

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <PageHeader title="Platform Dashboard" description="Business overview, system health, and regulatory coverage — at a glance" />

      {error && <div className="p-3 rounded-lg bg-status-error/10 border border-status-error text-status-error text-sm">{error}</div>}

      {/* A. Business Overview */}
      <SectionCard title="Business Overview" description="Tenant growth and the registration pipeline">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile label="Total companies" value={overview?.totalCompanies ?? 0} icon={Building2} tone="gold" />
          <StatTile label="Active" value={overview?.activeCompanies ?? 0} icon={CheckCircle2} tone="ok" />
          <StatTile label="Suspended" value={overview?.suspendedCompanies ?? 0} icon={PauseCircle} tone={overview && overview.suspendedCompanies > 0 ? 'warn' : 'accent'} />
          <StatTile
            label="Median approval time"
            value={overview?.medianApprovalHours === null || overview?.medianApprovalHours === undefined ? '—' : `${overview.medianApprovalHours.toFixed(1)}h`}
            icon={Clock}
          />
        </div>
        <div className="mt-5 flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-[var(--surface-raised)] overflow-hidden flex">
            {approved + pending + rejected > 0 && (
              <>
                <div className="h-full bg-status-success" style={{ width: `${(approved / (approved + pending + rejected)) * 100}%` }} />
                <div className="h-full bg-status-warning" style={{ width: `${(pending / (approved + pending + rejected)) * 100}%` }} />
                <div className="h-full bg-status-error" style={{ width: `${(rejected / (approved + pending + rejected)) * 100}%` }} />
              </>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-status-success" /> {approved} approved</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-status-warning" /> {pending} pending / in review</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-status-error" /> {rejected} rejected</span>
        </div>
      </SectionCard>

      {/* B. System Health */}
      <SectionCard title="System Health" description="Infrastructure status and background job queues">
        <div className="flex items-center gap-6 mb-5">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-[var(--text-muted)]" />
            <span className="text-sm text-[var(--text)]">Postgres</span>
            {health && <HealthBadge status={health.database.status} />}
          </div>
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-[var(--text-muted)]" />
            <span className="text-sm text-[var(--text)]">Redis</span>
            {health && <HealthBadge status={health.redis.status} />}
          </div>
        </div>

        <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
          {health && (
            <>
              <QueueRow label="Deadline escalation queue" depth={health.queues.deadlineEscalation} />
              <QueueRow label="Notification email queue" depth={health.queues.notificationEmail} />
            </>
          )}
        </div>

        <div className="mt-5 pt-5 border-t border-[var(--border)] flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--text)]">Force deadline check</p>
            <p className="text-xs text-[var(--text-muted)]">Runs the same scan the hourly job runs — escalates overdue tasks and sends real notifications/emails immediately, across every company.</p>
          </div>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium disabled:opacity-50 flex-shrink-0"
          >
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Run now
          </button>
        </div>
        {scanResult && <p className="mt-3 text-xs text-[var(--text-muted)]">{scanResult}</p>}
      </SectionCard>

      {/* C. Regulatory Coverage Tracker */}
      <SectionCard title="Regulatory Coverage" description="How complete each authority's configuration is, out of 6 report types">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--text-muted)] uppercase tracking-wide">
                <th className="pb-2 font-medium">Authority</th>
                <th className="pb-2 font-medium">Country</th>
                <th className="pb-2 font-medium text-center">Reporting rules</th>
                <th className="pb-2 font-medium text-center">Form schemas</th>
                <th className="pb-2 font-medium text-center">Submission formats</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {coverage.map((row) => {
                const cell = (n: number) => {
                  const pct = row.totalReportTypes > 0 ? n / row.totalReportTypes : 0
                  const cls = pct === 0 ? 'text-[var(--text-muted)]' : pct < 1 ? 'text-status-warning' : 'text-status-success'
                  return <span className={`font-mono text-xs font-medium ${cls}`}>{n}/{row.totalReportTypes}</span>
                }
                return (
                  <tr key={row.authorityId}>
                    <td className="py-2.5">
                      <span className="font-medium text-[var(--text)]">{row.authorityName}</span>
                      <span className="ml-2 text-[11px] text-[var(--text-muted)] font-mono">{row.authorityCode}</span>
                    </td>
                    <td className="py-2.5 text-[var(--text-muted)]">{row.countryName}</td>
                    <td className="py-2.5 text-center">{cell(row.reportTypesWithActiveRule)}</td>
                    <td className="py-2.5 text-center">{cell(row.reportTypesWithActiveFormSchema)}</td>
                    <td className="py-2.5 text-center">{cell(row.reportTypesWithActiveSubmissionFormat)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <a href="/country-rules" className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--primary)] hover:underline">
          <RefreshCw className="h-3.5 w-3.5" /> Close gaps in Country Rules
        </a>
      </SectionCard>
    </div>
  )
}
