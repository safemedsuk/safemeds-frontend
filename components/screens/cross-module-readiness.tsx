'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { CrossModuleReadiness, getCrossModuleReadiness } from '@/lib/api/environmental-monitoring-stability'
import { useTranslation } from '@/lib/i18n/use-translation'

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${ok ? 'bg-status-success/10 text-status-success' : 'bg-status-warning/10 text-status-warning'}`}>
      {label}
    </span>
  )
}

/**
 * QualCloud (Phase 13) Stage 20 — the cross-module Inspection/Audit-
 * Readiness view: VigiCloud's PPB PV checklist, QualCloud's own GMP
 * checklist, and an honest RegCloud proxy (its own open-items count —
 * RegCloud has no dedicated checklist concept of its own), all three
 * read live, in one place.
 */
export function CrossModuleReadinessScreen() {
  const { t } = useTranslation()
  const [data, setData] = useState<CrossModuleReadiness | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCrossModuleReadiness()
      .then(setData)
      .catch((err) => setError(getErrorMessage(err, t('crossModuleReadiness.errorLoad'))))
      .finally(() => setLoading(false))
  }, [t])

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">{t('crossModuleReadiness.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('crossModuleReadiness.subtitle')}</p>
      </div>

      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      ) : data ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-semibold text-foreground">{t('crossModuleReadiness.vigicloudTitle')}</h2>
            <div className="mt-3">
              <Pill ok={data.vigicloud.overall === 'green'} label={data.vigicloud.overall.toUpperCase()} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('crossModuleReadiness.mandatoryItemsReady', { ready: String(data.vigicloud.readyCount), total: String(data.vigicloud.totalMandatory) })}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-semibold text-foreground">{t('crossModuleReadiness.qualcloudTitle')}</h2>
            <div className="mt-3">
              <Pill ok={data.qualcloud.overall === 'ready'} label={data.qualcloud.overall === 'ready' ? t('crossModuleReadiness.ready') : t('crossModuleReadiness.needsAttention')} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {data.qualcloud.authorityConfigured ? t('crossModuleReadiness.authorityConfigured') : t('crossModuleReadiness.noAuthorityConfigured')}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-semibold text-foreground">{t('crossModuleReadiness.regcloudTitle')}</h2>
            <div className="mt-3">
              <Pill ok={data.regulatory.overall === 'ready'} label={data.regulatory.overall === 'ready' ? t('crossModuleReadiness.ready') : t('crossModuleReadiness.needsAttention')} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t('crossModuleReadiness.openItemsProxy', { count: String(data.regulatory.openItemCount) })}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
