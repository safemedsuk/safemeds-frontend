'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Lock, Loader2, ShieldAlert, Unlock } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { CASE_CHANNEL_LABELS, PvCase, claimDraftCase, confirmDraftCase, listPvCases, releaseDraftCase } from '@/lib/api/pv-cases'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useAuthStore } from '@/lib/store/auth-store'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString()
}

/**
 * VigiCloud Stage 3.3/3.4 — every case created through a channel with no
 * logged-in human actor (public URL, inbound email, WhatsApp) lands here
 * first, flagged `requiresDraftReview: true`, until someone with
 * `pv.triage_case` confirms it — "always lands for human triage," per
 * the Final doc's requirement for system-sourced cases.
 *
 * Real-usage feedback, 19 Aug 2026 — "more people should see, claim it
 * and then work on them... if not, then what's the use of claiming."
 * `pv.triage_case` was widened to more roles (see `rbac.seed-data.ts`),
 * and each case now supports a real claim/release cycle (mirroring the
 * Task Inbox's own claim/release pattern) — a case must be claimed by
 * the acting reviewer before it can be confirmed, and the claimant (or
 * a `pv.view_all` holder) can release it back to the pool.
 */
export function DraftReviewQueue() {
  const router = useRouter()
  const { has } = usePermissions()
  const canTriage = has('pv.triage_case')
  const canOverrideRelease = has('pv.view_all')
  const currentUserId = useAuthStore((state) => state.currentUser?.id)

  const [cases, setCases] = useState<PvCase[]>([])
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingOnId, setActingOnId] = useState<string | null>(null)

  const load = () => {
    if (!canTriage) return
    let cancelled = false
    setLoading(true)
    setError(null)

    listPvCases({ page, limit, requiresDraftReview: true })
      .then(({ cases: rows, meta }) => {
        if (cancelled) return
        setCases(rows)
        setTotalPages(meta.totalPages)
        setTotal(meta.total)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load the draft-review queue.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }

  useEffect(load, [page, limit, canTriage])

  const replaceCase = (updated: PvCase) => {
    setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }

  const handleClaim = async (id: string) => {
    setActingOnId(id)
    setError(null)
    try {
      replaceCase(await claimDraftCase(id))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not claim this case — someone else may have just claimed it.'))
    } finally {
      setActingOnId(null)
    }
  }

  const handleRelease = async (id: string) => {
    setActingOnId(id)
    setError(null)
    try {
      replaceCase(await releaseDraftCase(id))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not release this case.'))
    } finally {
      setActingOnId(null)
    }
  }

  const handleConfirm = async (id: string) => {
    setActingOnId(id)
    setError(null)
    try {
      await confirmDraftCase(id)
      setCases((prev) => prev.filter((c) => c.id !== id))
      setTotal((prev) => Math.max(0, prev - 1))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not confirm this case — claim it first if you have not already.'))
    } finally {
      setActingOnId(null)
    }
  }

  if (!canTriage) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">Draft Review Queue</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to triage draft cases. Contact your System Administrator.</p>
        </div>
      </div>
    )
  }

  const columns: DataTableColumn<PvCase>[] = [
    { key: 'referenceNumber', label: 'Reference', render: (v) => <span className="font-medium text-foreground font-mono text-sm">{v as string}</span> },
    {
      key: 'channel',
      label: 'Source',
      render: (v) => <span className="rounded-full bg-status-info/10 px-2 py-0.5 text-xs font-medium text-status-info">{CASE_CHANNEL_LABELS[v as keyof typeof CASE_CHANNEL_LABELS] ?? (v as string)}</span>,
    },
    { key: 'sourceChannelReference', label: 'Reference (email/WhatsApp)', render: (v) => (v as string | null) || '—' },
    { key: 'createdAt', label: 'Received', render: (v) => formatDate(v as string) },
    {
      key: 'draftClaimedBy',
      label: 'Claim',
      render: (_v, row) =>
        !row.draftClaimedBy ? (
          <span className="text-xs text-muted-foreground">Unclaimed</span>
        ) : row.draftClaimedBy === currentUserId ? (
          <span className="rounded-full bg-status-success/10 px-2 py-0.5 text-xs font-medium text-status-success">Claimed by you</span>
        ) : (
          <span className="rounded-full bg-status-warning/10 px-2 py-0.5 text-xs font-medium text-status-warning">Claimed by another reviewer</span>
        ),
    },
    {
      key: 'id',
      label: 'Actions',
      render: (_v, row) => {
        const busy = actingOnId === row.id
        const claimedByMe = row.draftClaimedBy === currentUserId
        const claimedByOther = Boolean(row.draftClaimedBy) && !claimedByMe

        return (
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {!row.draftClaimedBy && (
              <button
                onClick={() => handleClaim(row.id)}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                Claim
              </button>
            )}
            {(claimedByMe || (claimedByOther && canOverrideRelease)) && (
              <button
                onClick={() => handleRelease(row.id)}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5" />}
                Release
              </button>
            )}
            <button
              onClick={() => handleConfirm(row.id)}
              disabled={busy || !claimedByMe}
              title={!claimedByMe ? 'Claim this case first' : undefined}
              className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Confirm
            </button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Draft Review Queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total} unconfirmed {total === 1 ? 'case' : 'cases'} captured via public URL, email, or WhatsApp — claim one to start reviewing it, then confirm
          once you&apos;re done. Release it if you can&apos;t finish so someone else can pick it up.
        </p>
      </div>

      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error}</div>}

      <DataTableV2
        data={cases}
        columns={columns}
        onRowClick={(row) => router.push(`/pv-cases/${row.id}`)}
        searchable={false}
        exportable={false}
        showDensityToggle={false}
        loading={loading}
        page={page}
        totalPages={totalPages}
        totalCount={total}
        onPageChange={setPage}
        rowsPerPage={limit}
      />

      {!loading && cases.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-status-success/40 mb-3" />
          <p className="text-sm text-muted-foreground">Nothing waiting for review — every system-sourced case has been confirmed.</p>
        </div>
      )}
    </div>
  )
}
