'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileDown, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { getDownloadUrl, listDocuments } from '@/lib/api/documents'
import {
  generateInspectionReadinessPack,
  getInspectionReadiness,
  InspectionReadinessPack,
  InspectionReadinessSnapshot,
  listInspectionReadinessPacks,
} from '@/lib/api/inspection-readiness'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { DocumentPreviewModal } from '@/components/ui/document-preview-modal'

function formatDate(value: string): string {
  return new Date(value).toLocaleString()
}

/**
 * QualCloud (Phase 13) Stage 9 — "the single most valuable screen in
 * the platform" (Build Priority doc): a red/amber/green readiness score
 * per checklist section, resolved live against real underlying data,
 * with one-click evidence-pack generation.
 */
export function InspectionReadinessScreen() {
  const { has } = usePermissions()
  const canView = has('quality.view_all')
  const canGenerate = has('quality.manage_capa')

  const [snapshot, setSnapshot] = useState<InspectionReadinessSnapshot | null>(null)
  const [packs, setPacks] = useState<InspectionReadinessPack[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<{ title: string; filename: string; contentType: string; getUrl: () => Promise<string> } | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([getInspectionReadiness(), listInspectionReadinessPacks()])
      .then(([s, p]) => {
        setSnapshot(s)
        setPacks(p)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load inspection readiness.')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      await generateInspectionReadinessPack()
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not generate the readiness pack.'))
    } finally {
      setGenerating(false)
    }
  }

  const previewPack = async (pack: InspectionReadinessPack) => {
    const docs = await listDocuments('inspection_readiness_pack', pack.id)
    const doc = docs[0]
    const latest = doc?.versions[0]
    if (!doc || !latest) return
    setPreviewing({
      title: `Readiness Pack — ${formatDate(pack.generatedAt)}`,
      filename: latest.filename,
      contentType: latest.contentType,
      getUrl: () => getDownloadUrl(doc.id, latest.id),
    })
  }

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">Inspection Readiness</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to view inspection readiness. Contact your System Administrator.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-safemeds-teal" />
            <h1 className="text-3xl font-display font-bold text-foreground">Inspection Readiness</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">If an inspector walked in right now — what is our real state?</p>
        </div>
        {canGenerate && (
          <button onClick={handleGenerate} disabled={generating} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Generate Evidence Pack
          </button>
        )}
      </div>

      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      {loading || !snapshot ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className={`rounded-lg border p-4 ${snapshot.overall === 'ready' ? 'border-status-success bg-status-success/10' : 'border-status-warning bg-status-warning/10'}`}>
            <div className="flex items-center gap-2">
              {snapshot.overall === 'ready' ? <CheckCircle2 className="h-5 w-5 text-status-success" /> : <AlertTriangle className="h-5 w-5 text-status-warning" />}
              <p className={`text-sm font-semibold ${snapshot.overall === 'ready' ? 'text-status-success' : 'text-status-warning'}`}>
                Overall: {snapshot.overall === 'ready' ? 'Ready' : 'Needs Attention'}
              </p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Home market: {snapshot.homeCountryName}
              {!snapshot.authorityConfigured && ' — no regulatory authority is configured for this market yet.'}
            </p>
          </div>

          {snapshot.rows.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center">
              <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No inspection checklist is configured for this market yet. Contact SafeMeds support.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {snapshot.rows.map((row) => (
                <div key={row.sectionKey} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{row.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${row.status === 'ready' ? 'bg-status-success/10 text-status-success' : 'bg-status-error/10 text-status-error'}`}>
                      {row.status === 'ready' ? 'Ready' : 'Needs Attention'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{row.note}</p>
                  {row.guidelineReference && <p className="mt-1 text-xs text-muted-foreground italic">{row.guidelineReference}</p>}
                  {row.unverified && <p className="mt-1 text-xs text-status-warning">Structural placeholder — not yet confirmed against a real guideline citation.</p>}
                </div>
              ))}
            </div>
          )}

          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Evidence Pack History</h3>
            {packs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No evidence pack generated yet.</p>
            ) : (
              <div className="space-y-2">
                {packs.map((pack) => (
                  <button key={pack.id} onClick={() => previewPack(pack)} className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left hover:bg-muted">
                    <span className="text-sm text-foreground">{formatDate(pack.generatedAt)}</span>
                    <span className={`text-xs font-medium ${pack.snapshot.overall === 'ready' ? 'text-status-success' : 'text-status-warning'}`}>
                      {pack.snapshot.overall === 'ready' ? 'Ready' : 'Needs Attention'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {previewing && (
        <DocumentPreviewModal
          title={previewing.title}
          filename={previewing.filename}
          contentType={previewing.contentType}
          getUrl={previewing.getUrl}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  )
}
