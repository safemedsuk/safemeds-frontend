'use client'

import { useCallback, useEffect, useState } from 'react'
import { Link2, Loader2, Search, Sparkles, Unlink } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'
import { getErrorMessage } from '@/lib/api/client'
import { listCompanies, type CompanySummary } from '@/lib/api/entitlements'
import {
  linkDistributorTenant,
  listPlatformDistributors,
  suggestTenantMatches,
  type PlatformDistributorSummary,
  type TenantMatchSuggestion,
} from '@/lib/api/distributor-linking'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'

/**
 * testing-todo 15.1 — real-usage feedback: "let's build this maybe even
 * automatically such that it can be done by the platform admins," scoped
 * to the case both sides are real SafeMeds tenants. A distributor that
 * will never be a tenant simply stays unlinked here forever — nothing on
 * this screen forces a link, it only ever makes the tenant-to-tenant case
 * fast when it applies.
 */
export function DistributorLinkingAdmin() {
  const [distributors, setDistributors] = useState<PlatformDistributorSummary[]>([])
  const [showLinkedToo, setShowLinkedToo] = useState(false)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [linking, setLinking] = useState<PlatformDistributorSummary | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listPlatformDistributors({ q: q || undefined, unlinkedOnly: !showLinkedToo, page, limit: 25 })
      .then((r) => {
        setDistributors(r.distributors)
        setTotalPages(r.totalPages)
        setTotal(r.total)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load distributors.')))
      .finally(() => setLoading(false))
  }, [q, showLinkedToo, page])

  useEffect(() => {
    load()
  }, [load])

  const handleUnlink = async (distributor: PlatformDistributorSummary) => {
    setError(null)
    try {
      await linkDistributorTenant(distributor.id, null)
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not unlink this distributor.'))
    }
  }

  const columns: DataTableColumn<PlatformDistributorSummary>[] = [
    { key: 'name', label: 'Distributor' },
    { key: 'ownerCompanyName', label: 'Belongs to (manufacturer tenant)' },
    {
      key: 'distributorCompanyId',
      label: 'Linked tenant',
      render: (_v, row) =>
        row.distributorCompanyId ? (
          <span className="text-status-success">{row.distributorCompanyName}</span>
        ) : (
          <span className="text-muted-foreground">Not linked</span>
        ),
    },
    {
      key: 'id',
      label: '',
      render: (_v, row) =>
        row.distributorCompanyId ? (
          <button onClick={() => handleUnlink(row)} className="flex items-center gap-1.5 text-xs font-medium text-status-error hover:underline">
            <Unlink className="h-3.5 w-3.5" /> Unlink
          </button>
        ) : (
          <button onClick={() => setLinking(row)} className="flex items-center gap-1.5 text-xs font-medium text-safemeds-teal hover:underline">
            <Link2 className="h-3.5 w-3.5" /> Link to tenant…
          </button>
        ),
    },
  ]

  return (
    <div className="min-h-screen bg-[var(--bg)] p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <PageHeader
          title="Distributor Linking"
          description="Confirm a distributor is itself a real SafeMeds tenant, enabling the cross-tenant reconciliation summary. A distributor with no matching tenant stays unlinked — that's the normal, expected state."
          breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Distributor Linking' }]}
        />

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => {
                setPage(1)
                setQ(e.target.value)
              }}
              placeholder="Search distributor name…"
              className={`${inputClass} pl-8`}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={showLinkedToo}
              onChange={(e) => {
                setPage(1)
                setShowLinkedToo(e.target.checked)
              }}
            />
            Show already-linked too
          </label>
        </div>

        {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : distributors.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            {showLinkedToo ? 'No distributors found.' : 'No unlinked distributors — everything real-tenant-linkable is already linked.'}
          </div>
        ) : (
          <DataTableV2<PlatformDistributorSummary>
            data={distributors}
            columns={columns}
            searchable={false}
            exportable={false}
            showDensityToggle={false}
            page={page}
            totalPages={totalPages}
            totalCount={total}
            onPageChange={setPage}
          />
        )}

        {linking && (
          <LinkDistributorModal
            distributor={linking}
            onClose={() => setLinking(null)}
            onLinked={() => {
              setLinking(null)
              load()
            }}
          />
        )}
      </div>
    </div>
  )
}

function LinkDistributorModal({
  distributor,
  onClose,
  onLinked,
}: {
  distributor: PlatformDistributorSummary
  onClose: () => void
  onLinked: () => void
}) {
  const [suggestions, setSuggestions] = useState<TenantMatchSuggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(true)
  const [manualQuery, setManualQuery] = useState('')
  const [manualResults, setManualResults] = useState<CompanySummary[]>([])
  const [searching, setSearching] = useState(false)
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    suggestTenantMatches(distributor.id)
      .then(setSuggestions)
      .catch((err) => setError(getErrorMessage(err, 'Could not load match suggestions.')))
      .finally(() => setLoadingSuggestions(false))
  }, [distributor.id])

  useEffect(() => {
    if (!manualQuery.trim()) {
      setManualResults([])
      return
    }
    setSearching(true)
    const handle = setTimeout(() => {
      listCompanies(manualQuery.trim(), 1)
        .then((r) => setManualResults(r.companies.filter((c) => c.id !== distributor.ownerCompanyId)))
        .catch((err) => setError(getErrorMessage(err, 'Could not search companies.')))
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(handle)
  }, [manualQuery, distributor.ownerCompanyId])

  const handleLink = async (companyId: string) => {
    setLinkingId(companyId)
    setError(null)
    try {
      await linkDistributorTenant(distributor.id, companyId)
      onLinked()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not link this distributor.'))
      setLinkingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4 max-h-[85vh] overflow-y-auto">
        <div>
          <h2 className="font-display font-bold text-lg text-foreground">Link &quot;{distributor.name}&quot;</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Owned by {distributor.ownerCompanyName}. Confirm the real SafeMeds tenant this distributor is, if one exists.
          </p>
        </div>

        {error && <p className="text-sm text-status-error">{error}</p>}

        {loadingSuggestions ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking for a matching tenant…
          </div>
        ) : suggestions.length > 0 ? (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Suggested match
            </p>
            <div className="space-y-2">
              {suggestions.map((s) => (
                <button
                  key={s.companyId}
                  onClick={() => handleLink(s.companyId)}
                  disabled={linkingId !== null}
                  className="flex w-full items-center justify-between rounded-lg border border-safemeds-teal/40 bg-safemeds-teal/5 px-3 py-2.5 text-left text-sm hover:bg-safemeds-teal/10 disabled:opacity-50"
                >
                  <span className="font-medium text-foreground">{s.companyName}</span>
                  {linkingId === s.companyId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4 text-safemeds-teal" />}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No same-named tenant found automatically — search below if you know it&apos;s a real tenant under a different name.</p>
        )}

        <div className="pt-2 border-t border-border">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Or search for a company</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={manualQuery} onChange={(e) => setManualQuery(e.target.value)} placeholder="Company name…" className={`${inputClass} pl-8`} />
          </div>
          {searching && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </div>
          )}
          {manualResults.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {manualResults.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleLink(c.id)}
                  disabled={linkingId !== null}
                  className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                >
                  <span className="text-foreground">
                    {c.name} <span className="text-xs text-muted-foreground">— {c.homeCountryName}</span>
                  </span>
                  {linkingId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4 text-muted-foreground" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={onClose} className="w-full rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
          Cancel
        </button>
      </div>
    </div>
  )
}
