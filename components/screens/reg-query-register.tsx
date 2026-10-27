'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, MessageSquareText, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { getErrorMessage } from '@/lib/api/client'
import { getAllCountries, type Country } from '@/lib/api/countries'
import { listProducts, type Product } from '@/lib/api/master-data'
import {
  listRegQueryRegister,
  type RegQueryRegisterRow,
  type RegQueryStatus,
} from '@/lib/api/reg-dossiers'
import { listUsers, type TenantUser } from '@/lib/api/users'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

const inputClass = 'rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'

const STATUS_LABEL_KEYS: Record<RegQueryStatus, MessageKey> = {
  open: 'regQueryPanel.statusOpen',
  in_progress: 'regQueryPanel.statusInProgress',
  responded: 'regQueryPanel.statusResponded',
  closed: 'regQueryPanel.statusClosed',
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

/**
 * CEO feedback, 30 Sep 2026 — "Register view: all queries across
 * products and markets, filterable by market, product, owner and
 * status, with overdue queries highlighted." A distinct, cross-dossier
 * screen — the dossier detail page's own Correspondence Log panel
 * (`RegQueryPanel`) stays scoped to one dossier at a time.
 */
export function RegQueryRegisterScreen() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canView = has('regulatory.view_all')

  const [rows, setRows] = useState<RegQueryRegisterRow[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [users, setUsers] = useState<TenantUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const [productId, setProductId] = useState('')
  const [countryId, setCountryId] = useState('')
  const [ownerUserId, setOwnerUserId] = useState('')
  // Real-usage request, 1 Oct 2026 — a dashboard "Open Regulator
  // Queries" stat tile now links here as `?status=open`; this screen
  // needs to actually honor that on load, not just show everything.
  const searchParams = useSearchParams()
  const initialStatus = searchParams.get('status')
  const [status, setStatus] = useState<RegQueryStatus | ''>(
    initialStatus && initialStatus in STATUS_LABEL_KEYS ? (initialStatus as RegQueryStatus) : '',
  )
  const [overdueOnly, setOverdueOnly] = useState(false)

  useEffect(() => {
    listProducts({ limit: 100 }).then((r) => setProducts(r.rows)).catch(() => undefined)
    getAllCountries().then(setCountries).catch(() => undefined)
    listUsers({ limit: 100 }).then((r) => setUsers(r.users)).catch(() => undefined)
  }, [])

  const load = useCallback(() => {
    if (!canView) return
    setLoading(true)
    setError(null)
    listRegQueryRegister({
      page,
      limit,
      productId: productId || undefined,
      countryId: countryId || undefined,
      ownerUserId: ownerUserId || undefined,
      status: status || undefined,
      overdueOnly: overdueOnly || undefined,
    })
      .then(({ data, meta }) => {
        setRows(data)
        setTotalPages(meta?.totalPages ?? 1)
        setTotalCount(meta?.total ?? data.length)
      })
      .catch((err) => setError(getErrorMessage(err, t('regQueryRegister.couldNotLoad'))))
      .finally(() => setLoading(false))
  }, [canView, page, limit, productId, countryId, ownerUserId, status, overdueOnly, t])

  useEffect(load, [load])

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">{t('regQueryRegister.title')}</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{t('regQueryRegister.noPermission')}</p>
        </div>
      </div>
    )
  }

  const columns: DataTableColumn<RegQueryRegisterRow>[] = [
    {
      key: 'queryText',
      label: t('regQueryRegister.colQuery'),
      render: (value: string, row) => (
        <Link href={`/reg-dossiers/${row.regDossierId}`} className="text-sm font-medium text-safemeds-teal hover:underline line-clamp-1">
          {value}
        </Link>
      ),
    },
    { key: 'productBrandName', label: t('regQueryRegister.colProduct') },
    { key: 'countryName', label: t('regQueryRegister.colMarket') },
    {
      key: 'status',
      label: t('regQueryRegister.colStatus'),
      render: (value: RegQueryStatus, row) =>
        row.isOverdue ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-status-error/10 px-2 py-0.5 text-xs font-medium text-status-error">
            <AlertTriangle className="h-3 w-3" /> {t('regQueryRegister.overdue')}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">{t(STATUS_LABEL_KEYS[value])}</span>
        ),
    },
    { key: 'responseDueDate', label: t('regQueryRegister.colDue'), render: (value: string | null) => formatDate(value) },
    { key: 'ownerName', label: t('regQueryRegister.colOwner'), render: (value: string | null) => value ?? '—' },
    { key: 'receivedDate', label: t('regQueryRegister.colReceived'), render: (value: string) => formatDate(value) },
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <div className="flex items-center gap-3">
          <MessageSquareText className="h-6 w-6 text-safemeds-teal" />
          <h1 className="text-3xl font-display font-bold text-foreground">{t('regQueryRegister.title')}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('regQueryRegister.subtitle')}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('regQueryRegister.marketLabel')}</label>
          <select value={countryId} onChange={(e) => { setCountryId(e.target.value); setPage(1) }} className={inputClass}>
            <option value="">{t('regQueryRegister.allMarkets')}</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('regQueryRegister.productLabel')}</label>
          <select value={productId} onChange={(e) => { setProductId(e.target.value); setPage(1) }} className={inputClass}>
            <option value="">{t('regQueryRegister.allProducts')}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.brandName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('regQueryRegister.ownerLabel')}</label>
          <select value={ownerUserId} onChange={(e) => { setOwnerUserId(e.target.value); setPage(1) }} className={inputClass}>
            <option value="">{t('regQueryRegister.allOwners')}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.fullName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('regQueryRegister.statusLabel')}</label>
          <select value={status} onChange={(e) => { setStatus(e.target.value as RegQueryStatus | ''); setPage(1) }} className={inputClass}>
            <option value="">{t('regQueryRegister.allStatuses')}</option>
            {Object.entries(STATUS_LABEL_KEYS).map(([key, labelKey]) => (
              <option key={key} value={key}>{t(labelKey)}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => { setOverdueOnly(e.target.checked); setPage(1) }}
            className="h-4 w-4 rounded border-input"
          />
          {t('regQueryRegister.overdueOnly')}
        </label>
      </div>

      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <DataTableV2
        data={rows}
        columns={columns}
        loading={loading}
        searchable={false}
        filterable={false}
        exportable={false}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={setPage}
        rowsPerPage={limit}
        onRowsPerPageChange={(n) => { setLimit(n); setPage(1) }}
      />
    </div>
  )
}
