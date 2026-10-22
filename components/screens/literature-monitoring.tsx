'use client'

import { useCallback, useEffect, useState } from 'react'
import { BookOpen, Info, Loader2, Plus, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { LITERATURE_MONITORING_CURRENCY_WINDOW_DAYS, LiteratureMonitoringRun, listLiteratureRuns, logLiteratureRun } from '@/lib/api/literature-monitoring'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { useTranslation } from '@/lib/i18n/use-translation'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString()
}

function daysSince(value: string): number {
  return Math.floor((Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * VigiCloud Stage 19 — the literature-monitoring log. Always a manually
 * logged screening event, never an automated search — a staff member
 * does their own search (PubMed, a journal, etc.) outside this system
 * and records what they did here afterward. Exists to satisfy Stage
 * 16.2's audit-readiness requirement row 12: companies must *prove*
 * they do literature searches.
 */
export function LiteratureMonitoringScreen() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canManage = has('pv.manage_literature_monitoring')

  const [runs, setRuns] = useState<LiteratureMonitoringRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showLog, setShowLog] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listLiteratureRuns({ page: 1, limit: 50 })
      .then((res) => setRuns(res.runs))
      .catch((err) => setError(getErrorMessage(err, t('literatureMonitoring.errorLoad'))))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  useEffect(() => {
    if (!canManage) return
    load()
  }, [load, canManage])

  if (!canManage) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">{t('literatureMonitoring.title')}</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{t('literatureMonitoring.noPermission')}</p>
        </div>
      </div>
    )
  }

  const mostRecent = runs[0]
  const overdue = !mostRecent || daysSince(mostRecent.runAt) > LITERATURE_MONITORING_CURRENCY_WINDOW_DAYS

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-safemeds-teal" />
            <h1 className="text-3xl font-display font-bold text-foreground">{t('literatureMonitoring.title')}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t('literatureMonitoring.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowLog(true)}
          className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors"
        >
          <Plus className="h-4 w-4" /> {t('literatureMonitoring.logARun')}
        </button>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 p-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-info" />
        <p>
          <strong className="text-foreground">{t('literatureMonitoring.whatThisIsLabel')}</strong> {t('literatureMonitoring.whatThisIsBody')}
        </p>
      </div>

      {overdue && (
        <div className="rounded-lg border border-status-warning/40 bg-status-warning/10 p-3 text-sm text-status-warning">
          {mostRecent
            ? t('literatureMonitoring.overdueWithLastRun', { days: daysSince(mostRecent.runAt), windowDays: LITERATURE_MONITORING_CURRENCY_WINDOW_DAYS })
            : t('literatureMonitoring.neverLogged')}
        </div>
      )}
      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : runs.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{t('literatureMonitoring.noRunsYet')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">{t('literatureMonitoring.columnDate')}</th>
                <th className="p-3">{t('literatureMonitoring.columnMethod')}</th>
                <th className="p-3">{t('literatureMonitoring.columnSearchTerms')}</th>
                <th className="p-3">{t('literatureMonitoring.columnHits')}</th>
                <th className="p-3">{t('literatureMonitoring.columnSummary')}</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="p-3 text-foreground whitespace-nowrap">{formatDate(r.runAt)}</td>
                  <td className="p-3 text-foreground">{r.method}</td>
                  <td className="p-3 text-muted-foreground">{r.searchTerms}</td>
                  <td className="p-3 text-foreground">{r.hitsCount}</td>
                  <td className="p-3 text-muted-foreground max-w-xs truncate" title={r.hitsSummary ?? undefined}>
                    {r.hitsSummary || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showLog && (
        <LogRunModal
          onClose={() => setShowLog(false)}
          onLogged={() => {
            setShowLog(false)
            setNotice(t('literatureMonitoring.runLogged'))
            load()
          }}
        />
      )}
    </div>
  )
}

function LogRunModal({ onClose, onLogged }: { onClose: () => void; onLogged: () => void }) {
  const { t } = useTranslation()
  const [runAt, setRunAt] = useState(new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState('PubMed manual search')
  const [searchTerms, setSearchTerms] = useState('')
  const [hitsCount, setHitsCount] = useState('0')
  const [hitsSummary, setHitsSummary] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = method.trim().length > 0 && searchTerms.trim().length > 0 && Number.isInteger(Number(hitsCount)) && Number(hitsCount) >= 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await logLiteratureRun({ runAt, method: method.trim(), searchTerms: searchTerms.trim(), hitsCount: Number(hitsCount), hitsSummary: hitsSummary.trim() || undefined })
      onLogged()
    } catch (err) {
      setError(getErrorMessage(err, t('literatureMonitoring.errorLogRun')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">{t('literatureMonitoring.logRunModalTitle')}</h2>

        <div>
          <label className={labelClass}>{t('literatureMonitoring.dateRequired')}</label>
          <input type="date" value={runAt} onChange={(e) => setRunAt(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>{t('literatureMonitoring.methodRequired')}</label>
          <input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="PubMed manual search" className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>{t('literatureMonitoring.searchTermsRequired')}</label>
          <input value={searchTerms} onChange={(e) => setSearchTerms(e.target.value)} placeholder="e.g. paracetamol AND hepatotoxicity" className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>{t('literatureMonitoring.hitsFoundRequired')}</label>
          <input type="number" min={0} value={hitsCount} onChange={(e) => setHitsCount(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>{t('literatureMonitoring.summaryLabel')}</label>
          <textarea value={hitsSummary} onChange={(e) => setHitsSummary(e.target.value)} rows={3} placeholder={t('literatureMonitoring.summaryPlaceholder')} className={inputClass} />
        </div>

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('literatureMonitoring.logRun')}
          </button>
        </div>
      </div>
    </div>
  )
}
