'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowRight, Clock, CheckCircle2, Loader2, Users, User as UserIcon, Inbox, Undo2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { getErrorMessage } from '@/lib/api/client'
import { listTasks, claimTask, releaseTask, getTaskSummary, taskRecordHref, type Task, type TaskSummary, type TaskUrgency } from '@/lib/api/tasks'
import { useAuthStore } from '@/lib/store/auth-store'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

type Scope = 'me' | 'role' | 'all'

const URGENCY_META: Record<TaskUrgency, { labelKey: MessageKey; className: string; icon: typeof AlertCircle }> = {
  overdue: { labelKey: 'tasks.inbox.urgencyOverdue', className: 'bg-status-error/10 text-status-error border-status-error/30', icon: AlertCircle },
  due_soon: { labelKey: 'tasks.inbox.urgencyDueSoon', className: 'bg-status-warning/10 text-status-warning border-status-warning/30', icon: Clock },
  normal: { labelKey: 'tasks.inbox.urgencyNormal', className: 'bg-[var(--surface-raised)] text-[var(--text-muted)] border-[var(--border)]', icon: CheckCircle2 },
}

function UrgencyBadge({ urgency }: { urgency: TaskUrgency }) {
  const { t } = useTranslation()
  const meta = URGENCY_META[urgency]
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap ${meta.className}`}>
      <Icon className="h-3 w-3" />
      {t(meta.labelKey)}
    </span>
  )
}

function formatRecordType(recordType: string): string {
  return recordType.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

const KNOWN_RECORD_TYPES = [
  'pv_case',
  'signal',
  'clinical_trial_annual_renewal',
  'product_list_review',
  'audit_requirement_reminder',
  'literature_monitoring_reminder',
  'phone_reachability_reminder',
  'sdea_renewal',
  'training_record',
]

export function TaskInbox() {
  const { t } = useTranslation()
  const router = useRouter()
  const currentUserId = useAuthStore((state) => state.currentUser?.id)
  const currentUserRoleKeys = useAuthStore((state) => state.currentUser?.roleKeys ?? [])
  const [scope, setScope] = useState<Scope>('me')
  const [recordType, setRecordType] = useState<string>('all')
  const [tasks, setTasks] = useState<Task[]>([])
  const [summary, setSummary] = useState<TaskSummary>({ me: 0, role: 0 })
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  const load = useCallback(async (currentScope: Scope, currentRecordType: string, currentPage: number, currentLimit: number) => {
    setLoading(true)
    setError(null)
    try {
      const [{ rows, meta }, summaryData] = await Promise.all([
        listTasks({ scope: currentScope, recordType: currentRecordType === 'all' ? undefined : currentRecordType, page: currentPage, limit: currentLimit }),
        getTaskSummary(),
      ])
      setTasks(rows)
      setTotalPages(meta.totalPages)
      setTotalCount(meta.total)
      setSummary(summaryData)
    } catch (err) {
      setError(getErrorMessage(err, t('tasks.inbox.errorLoad')))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load(scope, recordType, page, limit)
  }, [scope, recordType, page, limit, load])

  const handleScopeChange = (next: Scope) => {
    setScope(next)
    setPage(1)
  }

  const handleRecordTypeChange = (next: string) => {
    setRecordType(next)
    setPage(1)
  }

  const handleRowsPerPageChange = (n: number) => {
    setLimit(n)
    setPage(1)
  }

  const handleClaim = async (task: Task) => {
    setActingId(task.id)
    setError(null)
    try {
      await claimTask(task.id)
      await load(scope, recordType, page, limit)
    } catch (err) {
      setError(getErrorMessage(err, t('tasks.inbox.errorClaim')))
    } finally {
      setActingId(null)
    }
  }

  const handleRelease = async (task: Task) => {
    setActingId(task.id)
    setError(null)
    try {
      await releaseTask(task.id)
      await load(scope, recordType, page, limit)
    } catch (err) {
      setError(getErrorMessage(err, t('tasks.inbox.errorRelease')))
    } finally {
      setActingId(null)
    }
  }

  const goToRecord = (task: Task) => {
    const href = taskRecordHref(task.recordType, task.recordId)
    if (href) router.push(href)
  }

  const overdueCount = tasks.filter((t) => t.urgency === 'overdue').length
  const dueSoonCount = tasks.filter((t) => t.urgency === 'due_soon').length

  const columns: DataTableColumn<Task>[] = [
    { key: 'urgency', label: t('tasks.inbox.columnUrgency'), render: (value: TaskUrgency) => <UrgencyBadge urgency={value} /> },
    { key: 'title', label: t('tasks.inbox.columnTask'), sortable: true },
    {
      key: 'recordType',
      label: t('tasks.inbox.columnRecordType'),
      render: (value: string) => <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{formatRecordType(value)}</span>,
    },
    {
      key: 'status',
      label: t('tasks.inbox.columnAssignment'),
      render: (_value: string, row: Task) =>
        row.status === 'claimed'
          ? row.claimedBy === currentUserId
            ? t('tasks.inbox.claimedByYou')
            : t('tasks.inbox.claimedByTeammate')
          : row.assignedRoleKey
            ? t('tasks.inbox.openQueue', { role: row.assignedRoleKey.replace(/_/g, ' ').toLowerCase() })
            : t('tasks.inbox.assignedDirectly'),
    },
    {
      key: 'createdAt',
      label: t('tasks.inbox.columnCreated'),
      sortable: true,
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      key: 'id',
      label: t('tasks.inbox.columnActions'),
      render: (_value: string, row: Task) => {
        const href = taskRecordHref(row.recordType, row.recordId)
        const canClaimThis = row.assignedRoleKey ? currentUserRoleKeys.includes(row.assignedRoleKey) : true
        const roleLower = row.assignedRoleKey?.replace(/_/g, ' ').toLowerCase() ?? ''
        return (
          <div className="flex items-center gap-2 flex-shrink-0">
            {row.status === 'open' && row.assignedRoleKey && canClaimThis && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleClaim(row)
                }}
                disabled={actingId === row.id}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--primary)] text-white disabled:opacity-50 flex items-center gap-1.5"
              >
                {actingId === row.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t('tasks.inbox.claim')}
              </button>
            )}
            {row.status === 'open' && row.assignedRoleKey && !canClaimThis && (
              <span
                title={t('tasks.inbox.requiresRoleTooltip', { role: roleLower })}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--surface-raised)] text-[var(--text-muted)] cursor-not-allowed whitespace-nowrap"
              >
                {t('tasks.inbox.needsRole', { role: roleLower })}
              </span>
            )}
            {row.status === 'claimed' && row.claimedBy === currentUserId && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleRelease(row)
                }}
                disabled={actingId === row.id}
                title={t('tasks.inbox.releaseTooltip')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-raised)] disabled:opacity-50"
              >
                {actingId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                {t('tasks.inbox.release')}
              </button>
            )}
            {href && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  goToRecord(row)
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-raised)]"
              >
                {t('tasks.inbox.open')} <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="min-h-screen bg-[var(--bg)] p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <PageHeader title={t('tasks.inbox.title')} description={t('tasks.inbox.subtitle')} breadcrumb={[{ label: t('tasks.inbox.title') }]} />

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-2xl font-display font-semibold text-[var(--text)]">{summary.me}</p>
            <p className="text-xs text-[var(--text-muted)]">{t('tasks.inbox.assignedToYou')}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-2xl font-display font-semibold text-[var(--text)]">{summary.role}</p>
            <p className="text-xs text-[var(--text-muted)]">{t('tasks.inbox.openInRoleQueues')}</p>
          </div>
          <div className={`rounded-xl border p-4 ${overdueCount > 0 ? 'border-status-error/30 bg-status-error/5' : 'border-[var(--border)] bg-[var(--surface)]'}`}>
            <p className={`text-2xl font-display font-semibold ${overdueCount > 0 ? 'text-status-error' : 'text-[var(--text)]'}`}>{overdueCount}</p>
            <p className="text-xs text-[var(--text-muted)]">
              {t('tasks.inbox.overdueOnPage')}
              {dueSoonCount > 0 ? t('tasks.inbox.dueSoonSuffix', { count: dueSoonCount }) : ''}
            </p>
          </div>
        </div>

        {/* Scope tabs + record-type filter */}
        <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] flex-wrap">
          <div className="flex items-center gap-2">
            {([
              { key: 'me' as const, label: t('tasks.inbox.tabAssignedToMe'), icon: UserIcon },
              { key: 'role' as const, label: t('tasks.inbox.tabMyRoleQueues'), icon: Users },
              { key: 'all' as const, label: t('tasks.inbox.tabAll'), icon: Inbox },
            ]).map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => handleScopeChange(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    scope === tab.key ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              )
            })}
          </div>
          <label className="flex items-center gap-1.5 pb-2 text-xs text-[var(--text-muted)]">
            {t('tasks.inbox.recordTypeLabel')}
            <select
              value={recordType}
              onChange={(e) => handleRecordTypeChange(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text)]"
            >
              <option value="all">{t('tasks.inbox.allTypes')}</option>
              {KNOWN_RECORD_TYPES.map((rt) => (
                <option key={rt} value={rt}>
                  {formatRecordType(rt)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <div className="p-3 rounded-lg bg-status-error/10 border border-status-error text-status-error text-sm">{error}</div>}

        {!loading && tasks.length === 0 ? (
          <div className="py-16 text-center">
            <CheckCircle2 className="h-8 w-8 text-[var(--ok)] mx-auto mb-2" />
            <p className="text-sm text-[var(--text-muted)]">
              {scope === 'me' ? t('tasks.inbox.emptyMe') : scope === 'role' ? t('tasks.inbox.emptyRole') : t('tasks.inbox.emptyAll')}
            </p>
          </div>
        ) : (
          <DataTableV2
            data={tasks}
            columns={columns}
            onRowClick={(row) => goToRecord(row)}
            searchable={false}
            exportable={false}
            showDensityToggle={false}
            loading={loading}
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={setPage}
            rowsPerPage={limit}
            onRowsPerPageChange={handleRowsPerPageChange}
            rowsPerPageOptions={[25, 50, 100]}
          />
        )}
      </div>
    </div>
  )
}
