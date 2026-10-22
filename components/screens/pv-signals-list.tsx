'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Radar, RefreshCw, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { listSignals, scanForSignals, Signal, SIGNAL_STATUS_LABELS, SignalStatus } from '@/lib/api/signals'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'
import { NewSignalModal } from '@/components/pv-cases/new-signal-modal'
import { useTranslation } from '@/lib/i18n/use-translation'

const STATUS_STYLES: Record<SignalStatus, string> = {
  detected: 'bg-status-warning/10 text-status-warning',
  validated: 'bg-status-info/10 text-status-info',
  non_validated: 'bg-muted text-muted-foreground',
  confirmed: 'bg-status-info/10 text-status-info',
  not_confirmed: 'bg-muted text-muted-foreground',
  analysed_prioritised: 'bg-status-info/10 text-status-info',
  assessed: 'bg-status-info/10 text-status-info',
  action_recommended: 'bg-status-success/10 text-status-success',
  refuted: 'bg-muted text-muted-foreground',
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString()
}

/**
 * VigiCloud Stage 17 — Signal Management (GVP Module IX). The backend's
 * `GET /pv/signals` has no pagination (signals are, by design, a small,
 * actively-managed list — nothing like the case/audit volume that
 * justified `DataTableV2`'s own truncated pager), so this screen fetches
 * the full list once and lets `DataTableV2` handle client-side
 * search/sort only.
 */
export function PvSignalsList() {
  const { t } = useTranslation()
  const router = useRouter()
  const { has, hasAny } = usePermissions()
  const canView = hasAny('pv.manage_signals', 'pv.view_all')
  const canManage = has('pv.manage_signals')

  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [scanning, setScanning] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setSignals(await listSignals())
    } catch (err) {
      setError(getErrorMessage(err, t('signals.list.errorLoad')))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (canView) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView])

  const runScan = async () => {
    setScanning(true)
    setError(null)
    try {
      const result = await scanForSignals()
      setNotice(
        result.signalsCreated > 0
          ? result.signalsCreated === 1
            ? t('signals.list.detectedOne')
            : t('signals.list.detectedMany', { count: result.signalsCreated })
          : t('signals.list.noNewPatterns'),
      )
      await load()
    } catch (err) {
      setError(getErrorMessage(err, t('signals.list.errorRunDetection')))
    } finally {
      setScanning(false)
    }
  }

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">{t('signals.list.title')}</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{t('signals.list.noPermission')}</p>
        </div>
      </div>
    )
  }

  const columns: DataTableColumn<Signal>[] = [
    { key: 'title', label: t('signals.list.columnTitle'), render: (v) => <span className="font-medium text-foreground">{v as string}</span> },
    { key: 'productIdentifier', label: t('signals.list.columnProduct') },
    { key: 'batchNumber', label: t('signals.list.columnBatch'), render: (v) => (v as string) || t('signals.list.allBatches') },
    {
      key: 'status',
      label: t('signals.list.columnStatus'),
      render: (v) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLES[v as SignalStatus] ?? 'bg-muted text-muted-foreground'}`}>
          {SIGNAL_STATUS_LABELS[v as SignalStatus] ?? (v as string)}
        </span>
      ),
    },
    {
      key: 'detectionMethod',
      label: t('signals.list.columnDetectedVia'),
      render: (v) => (v === 'pattern_flag' ? t('signals.list.automaticPatternFlag') : t('signals.list.manual')),
    },
    { key: 'strengthOfEvidenceCaseCount', label: t('signals.list.columnCases'), render: (v) => (v === null || v === undefined ? '—' : (v as number)) },
    { key: 'createdAt', label: t('signals.list.columnRaised'), render: (v) => formatDate(v as string) },
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">{t('signals.list.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {signals.length === 1 ? t('signals.list.subtitleOne') : t('signals.list.subtitleMany', { count: signals.length })}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button
              onClick={runScan}
              disabled={scanning}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {t('signals.list.runDetectionNow')}
            </button>
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t('signals.list.raiseSignal')}
            </button>
          </div>
        )}
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error}</div>}

      <DataTableV2
        data={signals}
        columns={columns}
        onRowClick={(row) => router.push(`/pv-signals/${row.id}`)}
        searchable
        filterable={false}
        exportable={false}
        showDensityToggle={false}
        loading={loading}
      />

      {!loading && signals.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Radar className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{t('signals.list.noSignalsYet')}</p>
        </div>
      )}

      {showNew && (
        <NewSignalModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false)
            router.push(`/pv-signals/${id}`)
          }}
        />
      )}
    </div>
  )
}
