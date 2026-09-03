'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Link2, Loader2, Search } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { PvCase, listPvCases } from '@/lib/api/pv-cases'
import { getRecall, linkRecallCases, RECALL_STATUS_LABELS, RecallDetail as RecallDetailType } from '@/lib/api/recalls'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { WorkflowActionsPanel } from '@/components/pv-cases/workflow-actions-panel'
import { RecordTasksPanel } from '@/components/tasks/record-tasks-panel'
import { DecisionHistoryCard } from '@/components/ui/decision-history-card'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'

const STATUS_STYLES: Record<string, string> = {
  reported: 'bg-status-warning/10 text-status-warning',
  investigating: 'bg-status-warning/10 text-status-warning',
  notified_to_authority: 'bg-status-info/10 text-status-info',
  in_progress: 'bg-status-info/10 text-status-info',
  closed: 'bg-status-success/10 text-status-success',
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
export function RecallDetail({ recallId }: Props) {
  const router = useRouter()
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
        setError(getErrorMessage(err, 'Could not load this recall.'))
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [recallId],
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
        <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error ?? 'Recall not found.'}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <button onClick={() => router.push('/recalls')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Recalls
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
        <h2 className="mb-3 text-sm font-semibold text-foreground">Details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Authority notified at</p>
            <p className="text-sm text-foreground">{formatDateTime(recall.authorityNotifiedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Root-cause CAPA</p>
            <p className="text-sm text-foreground">{recall.rootCauseCapaId ? 'Linked' : '—'}</p>
          </div>
        </div>
      </div>

      <WorkflowActionsPanel workflowInstanceId={recall.workflowInstanceId} onTransitioned={refresh} />

      <RecordTasksPanel recordType="recall" recordId={recall.id} />

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
      setError(getErrorMessage(err, 'Could not search cases.'))
    } finally {
      setSearching(false)
    }
  }

  const link = async (caseId: string) => {
    setLinking(caseId)
    try {
      await linkRecallCases(recall.id, [caseId])
      setNotice('Case linked as evidence.')
      onLinked()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not link this case.'))
    } finally {
      setLinking(null)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Evidence Cases</h2>
          <p className="text-xs text-muted-foreground">{recall.linkedCases.length} linked — a plain lookup link to real PV cases, not a shared workflow.</p>
        </div>
        {canManage && (
          <button onClick={() => setShowSearch((s) => !s)} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
            <Link2 className="h-3.5 w-3.5" /> Link a Case
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
              placeholder="Search by reference number"
              className={inputClass}
            />
            <button onClick={runSearch} disabled={searching} className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-2 text-xs font-medium text-white disabled:opacity-50">
              {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              Search
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
                    <span className="text-xs text-muted-foreground">Already linked</span>
                  ) : (
                    <button onClick={() => link(c.id)} disabled={linking === c.id} className="text-xs font-medium text-safemeds-teal hover:underline disabled:opacity-50">
                      {linking === c.id ? 'Linking…' : 'Link'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {recall.linkedCases.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cases linked yet.</p>
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
