'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { CrossModuleReadiness, getCrossModuleReadiness } from '@/lib/api/environmental-monitoring-stability'

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
  const [data, setData] = useState<CrossModuleReadiness | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCrossModuleReadiness()
      .then(setData)
      .catch((err) => setError(getErrorMessage(err, 'Could not load the readiness overview.')))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Inspection Readiness — All Modules</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          VigiCloud, QualCloud, and RegCloud&apos;s own readiness signals, composed into one view.
        </p>
      </div>

      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      ) : data ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-semibold text-foreground">VigiCloud — PV Inspection Checklist</h2>
            <div className="mt-3">
              <Pill ok={data.vigicloud.overall === 'green'} label={data.vigicloud.overall.toUpperCase()} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {data.vigicloud.readyCount} / {data.vigicloud.totalMandatory} mandatory items ready
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-semibold text-foreground">QualCloud — GMP Inspection Checklist</h2>
            <div className="mt-3">
              <Pill ok={data.qualcloud.overall === 'ready'} label={data.qualcloud.overall === 'ready' ? 'READY' : 'NEEDS ATTENTION'} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {data.qualcloud.authorityConfigured ? 'Home-country authority configured' : 'No regulatory authority configured for this home country yet'}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-semibold text-foreground">RegCloud — Open Items (proxy)</h2>
            <div className="mt-3">
              <Pill ok={data.regulatory.overall === 'ready'} label={data.regulatory.overall === 'ready' ? 'READY' : 'NEEDS ATTENTION'} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {data.regulatory.openItemCount} open item(s) — RegCloud has no dedicated inspection checklist of its own, this is the closest real concept.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
