'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Link2, Loader2, Plus, Search, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { PvCase, listPvCases } from '@/lib/api/pv-cases'
import { getRecall, linkRecallCases, RECALL_STATUS_LABELS, RecallDetail as RecallDetailType } from '@/lib/api/recalls'
import { createRiskAssessment, listRiskAssessments, RiskAssessment } from '@/lib/api/quality'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { WorkflowActionsPanel } from '@/components/pv-cases/workflow-actions-panel'
import { RecordTasksPanel } from '@/components/tasks/record-tasks-panel'
import { DecisionHistoryCard } from '@/components/ui/decision-history-card'
import {
  RecallCountriesSection,
  RecallDistributionSection,
  RecallReconciliationSection,
  RecallScopeSection,
  RecallStakeholderPortalSection,
} from '@/components/recalls/recall-lifecycle-sections'
import {
  MockRecallReadinessSection,
  RecallClosureReadinessSection,
  RecallCompliancePackSection,
} from '@/components/recalls/recall-closure-sections'
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  under_assessment: 'bg-status-warning/10 text-status-warning',
  approved: 'bg-status-info/10 text-status-info',
  notification: 'bg-status-info/10 text-status-info',
  execution: 'bg-status-info/10 text-status-info',
  reconciliation: 'bg-status-info/10 text-status-info',
  closure_pending: 'bg-status-warning/10 text-status-warning',
  closed: 'bg-status-success/10 text-status-success',
  cancelled: 'bg-status-error/10 text-status-error',
}

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '—'
}

interface Props {
  recallId: string
}

/**
 * RegCloud (Phase 12) Stage 14 — Post-Market & Recall (cross-module).
 * RegCloud's own honest slice of a genuinely three-module event — this
 * page shows the regulator-facing lifecycle (via the reused
 * `WorkflowActionsPanel`/`DecisionHistoryCard`, exactly like PV Cases
 * and Signals) plus the two plain FK/lookup links this stage's own
 * design calls for: real PV `Case` rows linked as evidence, and — when
 * one already exists — a QualCloud root-cause CAPA reference. Neither
 * link is a shared workflow instance.
 */
/**
 * QualCloud Phase 1 Pass B (item A6) — says which step comes next and why, in plain language.
 * Statuses mirror the recall's own lifecycle (RecallWorkflowGuards); the text is guidance, the
 * workflow buttons below are what actually move the recall.
 */
const NEXT_STEP_GUIDANCE_KEYS: Record<string, MessageKey> = {
  draft: 'recallDetail.nextStepDraft',
  under_assessment: 'recallDetail.nextStepUnderAssessment',
  approved: 'recallDetail.nextStepApproved',
  notification: 'recallDetail.nextStepNotification',
  execution: 'recallDetail.nextStepExecution',
  reconciliation: 'recallDetail.nextStepReconciliation',
  closure_pending: 'recallDetail.nextStepClosurePending',
  closed: 'recallDetail.nextStepClosed',
  cancelled: 'recallDetail.nextStepCancelled',
}

function RecallNextStepBanner({ status }: { status: string }) {
  const { t } = useTranslation()
  const key = NEXT_STEP_GUIDANCE_KEYS[status]
  if (!key) return null
  return <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">{t(key)}</div>
}

const RISK_LEVEL_STYLES: Record<string, string> = {
  low: 'bg-status-success/10 text-status-success',
  medium: 'bg-status-warning/10 text-status-warning',
  high: 'bg-status-error/10 text-status-error',
}

/**
 * Real-usage item (7 Oct 2026) — approval ("under_assessment → approved")
 * is blocked until a risk assessment exists for this recall
 * (`RecallWorkflowGuards`), but the Risk Register (Controlled Documents)
 * had no way to create one already linked. This section shows what's
 * already linked and lets a user open one directly against this recall.
 */
function RecallRiskAssessmentSection({
  recallId,
  recallRef,
  productName,
}: {
  recallId: string
  recallRef: string | null
  productName: string
}) {
  const { t } = useTranslation()
  const [risks, setRisks] = useState<RiskAssessment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(() => {
    listRiskAssessments({ sourceRecordType: 'recall', sourceRecordId: recallId, limit: 10 })
      .then((page) => setRisks(page.rows))
      .catch((err) => setError(getErrorMessage(err, t('recallDetail.errorLoadRisk'))))
  }, [recallId, t])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('recallDetail.riskAssessment')}</p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" /> {t('recallDetail.newRiskAssessment')}
        </button>
      </div>
      {error && <p className="text-xs text-status-error">{error}</p>}
      {risks === null ? (
        <p className="text-xs text-muted-foreground">{t('recallDetail.loading')}</p>
      ) : risks.length === 0 ? (
        <div className="flex items-start gap-2 text-xs text-status-warning">
          <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <p>{t('recallDetail.noRiskLinkedYet')}</p>
        </div>
      ) : (
        <ul className="space-y-1">
          {risks.map((r) => (
            <li key={r.id} className="flex items-center justify-between text-sm">
              <span className="text-foreground">{r.title}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${RISK_LEVEL_STYLES[r.riskLevel] ?? ''}`}>
                {r.riskLevel} ({r.score})
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-muted-foreground">{t('recallDetail.registerNote')}</p>

      {showCreate && (
        <RecallRiskAssessmentModal
          recallId={recallId}
          defaultTitle={t('recallDetail.riskAssessmentDefaultTitle', { ref: recallRef ?? '', product: productName }).trim()}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function RecallRiskAssessmentModal({
  recallId,
  defaultTitle,
  onClose,
  onCreated,
}: {
  recallId: string
  defaultTitle: string
  onClose: () => void
  onCreated: () => void
}) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(defaultTitle)
  const [severity, setSeverity] = useState(3)
  const [probability, setProbability] = useState(3)
  const [mitigationActions, setMitigationActions] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!title.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await createRiskAssessment({
        title: title.trim(),
        sourceRecordType: 'recall',
        sourceRecordId: recallId,
        severity,
        probability,
        mitigationActions: mitigationActions.trim() || undefined,
      })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, t('recallDetail.errorRecordRisk')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-display font-bold text-base text-foreground">{t('recallDetail.newRiskAssessment')}</h3>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('recallDetail.titleField')}</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('recallDetail.severityField')}</label>
            <input type="number" min={1} max={5} value={severity} onChange={(e) => setSeverity(Number(e.target.value))} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('recallDetail.probabilityField')}</label>
            <input type="number" min={1} max={5} value={probability} onChange={(e) => setProbability(Number(e.target.value))} className={inputClass} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('recallDetail.mitigationActions')}</label>
          <textarea value={mitigationActions} onChange={(e) => setMitigationActions(e.target.value)} rows={2} className={inputClass} />
        </div>
        {error && <p className="text-sm text-status-error">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('recallDetail.record')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function RecallDetail({ recallId }: Props) {
  const router = useRouter()
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canManage = has('regulatory.manage_recalls')

  const [recall, setRecall] = useState<RecallDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()

  // `silent` refreshes must never re-show the spinner — see
  // `pv-case-detail.tsx`'s identical fix for the full reasoning.
  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      setError(null)
      try {
        setRecall(await getRecall(recallId))
      } catch (err) {
        setError(getErrorMessage(err, t('recallDetail.errorLoad')))
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [recallId, t],
  )

  const refresh = useCallback(() => load(true), [load])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !recall) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error ?? t('recallDetail.notFound')}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <button onClick={() => router.push('/recalls')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t('recallDetail.backToRecalls')}
      </button>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-safemeds-teal" />
            <h1 className="text-2xl font-display font-bold text-foreground">{recall.product.brandName}</h1>
            {recall.recallClass && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">{recall.recallClass}</span>}
          </div>
          <p className="mt-2 max-w-2xl text-sm text-foreground">{recall.reason}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap ${STATUS_STYLES[recall.status] ?? 'bg-muted text-muted-foreground'}`}>
          {RECALL_STATUS_LABELS[recall.status] ?? recall.status}
        </span>
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-foreground">{t('recallDetail.detailsHeading')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">{t('recallDetail.reference')}</p>
            <p className="font-mono text-sm text-foreground">{recall.ref ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('recallDetail.mode')}</p>
            <p className="text-sm text-foreground">{recall.mode === 'mock' ? t('recallDetail.modeMock') : t('recallDetail.modeReal')}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('recallDetail.opened')}</p>
            <p className="text-sm text-foreground">{formatDateTime(recall.openedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('recallDetail.closed')}</p>
            <p className="text-sm text-foreground">{formatDateTime(recall.closedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('recallDetail.rootCauseCapa')}</p>
            <p className="text-sm text-foreground">{recall.rootCauseCapaId ? t('recallDetail.linked') : '—'}</p>
          </div>
        </div>
      </div>

      {recall.mode === 'mock' && (
        <div className="rounded-lg border border-status-warning bg-status-warning/10 p-3 text-sm font-medium text-status-warning">
          {t('recallDetail.mockBanner')}
        </div>
      )}

      <RecallNextStepBanner status={recall.status} />

      <WorkflowActionsPanel workflowInstanceId={recall.workflowInstanceId} onTransitioned={refresh} />

      <RecordTasksPanel recordType="recall" recordId={recall.id} />

      {recall.mode === 'mock' && <MockRecallReadinessSection recallId={recall.id} />}

      <RecallClosureReadinessSection recallId={recall.id} onChanged={refresh} />

      <RecallCountriesSection recallId={recall.id} onChanged={refresh} />

      <RecallScopeSection recallId={recall.id} onChanged={refresh} />

      <RecallRiskAssessmentSection recallId={recall.id} recallRef={recall.ref} productName={recall.product.brandName} />

      <RecallDistributionSection recallId={recall.id} />

      <RecallStakeholderPortalSection recallId={recall.id} />

      <RecallReconciliationSection recallId={recall.id} />

      <RecallCompliancePackSection recallId={recall.id} />

      <EvidenceCasesCard recall={recall} canManage={canManage} onLinked={refresh} setNotice={setNotice} setError={setError} />

      <DecisionHistoryCard entries={recall.transitionHistory} resolveLabel={(key) => RECALL_STATUS_LABELS[key] ?? key} />
    </div>
  )
}

function EvidenceCasesCard({
  recall,
  canManage,
  onLinked,
  setNotice,
  setError,
}: {
  recall: RecallDetailType
  canManage: boolean
  onLinked: () => void
  setNotice: (msg: string) => void
  setError: (msg: string | null) => void
}) {
  const router = useRouter()
  const { t } = useTranslation()
  const [showSearch, setShowSearch] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PvCase[]>([])
  const [searching, setSearching] = useState(false)
  const [linking, setLinking] = useState<string | null>(null)

  const linkedIds = new Set(recall.linkedCases.map((c) => c.id))

  const runSearch = async () => {
    setSearching(true)
    try {
      const { cases } = await listPvCases({ search: query.trim() || undefined, limit: 10 })
      setResults(cases)
    } catch (err) {
      setError(getErrorMessage(err, t('recallDetail.errorSearchCases')))
    } finally {
      setSearching(false)
    }
  }

  const link = async (caseId: string) => {
    setLinking(caseId)
    try {
      await linkRecallCases(recall.id, [caseId])
      setNotice(t('recallDetail.caseLinkedNotice'))
      onLinked()
    } catch (err) {
      setError(getErrorMessage(err, t('recallDetail.errorLinkCase')))
    } finally {
      setLinking(null)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t('recallDetail.evidenceCases')}</h2>
          <p className="text-xs text-muted-foreground">{t('recallDetail.linkedCasesCount', { count: String(recall.linkedCases.length) })}</p>
        </div>
        {canManage && (
          <button onClick={() => setShowSearch((s) => !s)} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
            <Link2 className="h-3.5 w-3.5" /> {t('recallDetail.linkACase')}
          </button>
        )}
      </div>

      {showSearch && (
        <div className="mb-3 rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder={t('recallDetail.searchPlaceholder')}
              className={inputClass}
            />
            <button onClick={runSearch} disabled={searching} className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-2 text-xs font-medium text-white disabled:opacity-50">
              {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              {t('recallDetail.search')}
            </button>
          </div>
          {results.length > 0 && (
            <ul className="mt-2 divide-y divide-border">
              {results.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="font-mono text-xs text-foreground">
                    {c.referenceNumber} <span className="text-muted-foreground">({c.status})</span>
                  </span>
                  {linkedIds.has(c.id) ? (
                    <span className="text-xs text-muted-foreground">{t('recallDetail.alreadyLinked')}</span>
                  ) : (
                    <button onClick={() => link(c.id)} disabled={linking === c.id} className="text-xs font-medium text-safemeds-teal hover:underline disabled:opacity-50">
                      {linking === c.id ? t('recallDetail.linking') : t('recallDetail.link')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {recall.linkedCases.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('recallDetail.noCasesLinkedYet')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {recall.linkedCases.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2 text-sm">
              <button onClick={() => router.push(`/pv-cases/${c.id}`)} className="font-mono text-xs text-foreground hover:text-safemeds-teal hover:underline">
                {c.referenceNumber}
              </button>
              <span className="text-xs text-muted-foreground">{c.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
