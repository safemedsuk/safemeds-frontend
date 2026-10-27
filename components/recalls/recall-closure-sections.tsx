'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, ClipboardCheck, FileArchive, Loader2, Plus, ShieldAlert, XCircle } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  checkRecallClosureReadiness,
  computeMockRecallReadiness,
  exportMockRecallReadiness,
  generateRecallCompliancePack,
  listRecallCompliancePacks,
  listRecallEvidence,
  MockRecallReadiness,
  openRecallInvestigationCapa,
  RecallClosureGateResult,
  RecallCompliancePack,
  RecallEvidenceRow,
} from '@/lib/api/recall-stage10'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { useTranslation } from '@/lib/i18n/use-translation'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const btnPrimary = 'flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-2 text-xs font-medium text-white disabled:opacity-50'

function formatDate(v: string | null): string {
  return v ? new Date(v).toLocaleString() : '—'
}

/** 10.6 — the real 8-gate closure check, plus opening the recall-investigation CAPA it looks for (Gate 6). */
export function RecallClosureReadinessSection({ recallId, onChanged }: { recallId: string; onChanged?: () => void }) {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canOpenCapa = has('quality.manage_capa')
  const [result, setResult] = useState<RecallClosureGateResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showCapaForm, setShowCapaForm] = useState(false)
  const [capaTitle, setCapaTitle] = useState('')
  const [capaAction, setCapaAction] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setResult(await checkRecallClosureReadiness(recallId))
    } catch (err) {
      setError(getErrorMessage(err, t('recallClosure.errorCheckReadiness')))
    } finally {
      setLoading(false)
    }
  }, [recallId, t])

  useEffect(() => {
    void load()
  }, [load])

  const openCapa = async () => {
    if (!capaTitle.trim() || !capaAction.trim()) return
    setBusy(true)
    try {
      await openRecallInvestigationCapa(recallId, { title: capaTitle.trim(), correctiveAction: capaAction.trim() })
      setNotice(t('recallClosure.capaOpenedNotice'))
      setShowCapaForm(false)
      setCapaTitle('')
      setCapaAction('')
      await load()
      onChanged?.()
    } catch (err) {
      setError(getErrorMessage(err, t('recallClosure.errorOpenCapa')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <CollapsibleSection
      title={t('recallClosure.closureReadinessTitle')}
      icon={<ClipboardCheck className="h-4 w-4 text-safemeds-teal" />}
      badge={
        result ? (
          <span className={`rounded-full px-2 py-0.5 text-xs ${result.allClear ? 'bg-status-success/10 text-status-success' : 'bg-status-warning/10 text-status-warning'}`}>
            {result.allClear ? t('recallClosure.readyToClose') : t('recallClosure.gatesOpen', { count: String(result.gates.filter((g) => !g.passed).length) })}
          </span>
        ) : undefined
      }
      defaultOpen
    >
      {error && <p className="mb-2 text-sm text-status-error">{error}</p>}
      {notice && <p className="mb-2 text-sm text-status-success">{notice}</p>}
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : result ? (
        <ul className="space-y-1.5">
          {result.gates.map((g) => (
            <li key={g.gate} className="flex items-start gap-2 text-sm">
              {g.passed ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-status-success" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-status-warning" />
              )}
              <div>
                <span className="text-foreground">
                  {t('recallClosure.gateLabel', { number: String(g.gate), name: g.name })}
                </span>
                {!g.passed && g.reason && <p className="text-xs text-muted-foreground">{g.reason}</p>}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {canOpenCapa && result && !result.gates.find((g) => g.gate === 6)?.passed && (
        <div className="mt-4 border-t border-border pt-4">
          {!showCapaForm ? (
            <button onClick={() => setShowCapaForm(true)} className={btnPrimary}>
              <Plus className="h-3.5 w-3.5" /> {t('recallClosure.openRootCauseCapa')}
            </button>
          ) : (
            <div className="space-y-2">
              <input value={capaTitle} onChange={(e) => setCapaTitle(e.target.value)} placeholder={t('recallClosure.capaTitlePlaceholder')} className={inputClass} />
              <textarea value={capaAction} onChange={(e) => setCapaAction(e.target.value)} placeholder={t('recallClosure.correctiveActionPlaceholder')} rows={2} className={inputClass} />
              <div className="flex gap-2">
                <button onClick={openCapa} disabled={busy} className={btnPrimary}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {t('recallClosure.openCapa')}
                </button>
                <button onClick={() => setShowCapaForm(false)} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted">
                  {t('recallClosure.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </CollapsibleSection>
  )
}

/** 10.6 — the compliance pack (21-section PDF) and the evidence register. */
export function RecallCompliancePackSection({ recallId }: { recallId: string }) {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canManage = has('quality.manage_recalls')
  const [packs, setPacks] = useState<RecallCompliancePack[]>([])
  const [evidence, setEvidence] = useState<RecallEvidenceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [generating, setGenerating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [packsResult, evidenceResult] = await Promise.all([listRecallCompliancePacks(recallId), listRecallEvidence(recallId)])
      setPacks(packsResult)
      setEvidence(evidenceResult)
    } catch (err) {
      setError(getErrorMessage(err, t('recallClosure.errorLoadCompliancePack')))
    } finally {
      setLoading(false)
    }
  }, [recallId, t])

  useEffect(() => {
    void load()
  }, [load])

  const generate = async () => {
    setGenerating(true)
    try {
      await generateRecallCompliancePack(recallId)
      setNotice(t('recallClosure.compliancePackGeneratedNotice'))
      await load()
    } catch (err) {
      setError(getErrorMessage(err, t('recallClosure.errorGenerateCompliancePack')))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <CollapsibleSection title={t('recallClosure.compliancePackTitle')} icon={<FileArchive className="h-4 w-4 text-safemeds-teal" />}>
      {error && <p className="mb-2 text-sm text-status-error">{error}</p>}
      {notice && <p className="mb-2 text-sm text-status-success">{notice}</p>}
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {t('recallClosure.compliancePackIntro')}
            </p>
            {canManage && (
              <button onClick={generate} disabled={generating} className={btnPrimary}>
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} {t('recallClosure.generate')}
              </button>
            )}
          </div>
          {packs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('recallClosure.noCompliancePackYet')}</p>
          ) : (
            <ul className="mb-4 divide-y divide-border">
              {packs.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-foreground">{p.title}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="mb-2 text-xs font-semibold text-foreground">{t('recallClosure.evidenceRegister', { count: String(evidence.length) })}</h3>
          {evidence.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('recallClosure.noEvidenceYet')}</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left font-medium">{t('recallClosure.columnDocument')}</th>
                  <th className="text-left font-medium">{t('recallClosure.columnLinkedTo')}</th>
                  <th className="text-left font-medium">{t('recallClosure.columnSha256')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {evidence.map((e) => (
                  <tr key={e.documentId}>
                    <td className="py-1.5">{e.title}</td>
                    <td className="py-1.5">{e.linkedTo}</td>
                    <td className="max-w-[160px] truncate py-1.5 font-mono" title={e.sha256 ?? undefined}>
                      {e.sha256 ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </CollapsibleSection>
  )
}

/** 10.7 — mock-recall readiness scoring, shown only on a drill (mode: mock). */
export function MockRecallReadinessSection({ recallId }: { recallId: string }) {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canManage = has('quality.manage_recalls')
  const [result, setResult] = useState<MockRecallReadiness | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setResult(await computeMockRecallReadiness(recallId))
    } catch (err) {
      setError(getErrorMessage(err, t('recallClosure.errorComputeReadiness')))
    } finally {
      setLoading(false)
    }
  }, [recallId, t])

  useEffect(() => {
    void load()
  }, [load])

  const exportReport = async () => {
    setExporting(true)
    try {
      await exportMockRecallReadiness(recallId)
      setNotice(t('recallClosure.readinessReportExportedNotice'))
    } catch (err) {
      setError(getErrorMessage(err, t('recallClosure.errorExportReadiness')))
    } finally {
      setExporting(false)
    }
  }

  return (
    <CollapsibleSection title={t('recallClosure.mockRecallReadinessTitle')} icon={<ShieldAlert className="h-4 w-4 text-status-warning" />} defaultOpen>
      {error && <p className="mb-2 text-sm text-status-error">{error}</p>}
      {notice && <p className="mb-2 text-sm text-status-success">{notice}</p>}
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : result ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([
              [t('recallClosure.stakeholdersNotified'), result.totalStakeholdersNotified],
              [t('recallClosure.ackedWithin24h'), `${result.acknowledgedWithin24hPercent.toFixed(0)}%`],
              [t('recallClosure.stockTraced'), `${result.stockTracedPercent.toFixed(0)}%`],
              [t('recallClosure.downstreamListsReceived'), result.downstreamListsReceivedCount],
            ] as const).map(([label, value]) => (
              <div key={label} className="rounded-lg bg-muted/40 p-2 text-center">
                <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
                <p className="font-mono text-sm font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>
          {result.medianTimeToAcknowledgeHours !== null && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t('recallClosure.medianTimeToAcknowledge', { hours: result.medianTimeToAcknowledgeHours.toFixed(1) })}
            </p>
          )}
          {result.gaps.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold text-status-warning">{t('recallClosure.gaps')}</p>
              <ul className="space-y-1 text-xs text-foreground">
                {result.gaps.map((g, i) => (
                  <li key={i}>• {g}</li>
                ))}
              </ul>
            </div>
          )}
          {canManage && (
            <button onClick={exportReport} disabled={exporting} className={`${btnPrimary} mt-4`}>
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {t('recallClosure.exportForInspectionFile')}
            </button>
          )}
        </>
      ) : null}
    </CollapsibleSection>
  )
}
