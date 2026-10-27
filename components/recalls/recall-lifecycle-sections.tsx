'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Globe2, Layers, Loader2, Plus, ShieldCheck, Truck, Users } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { getCompanyMarkets, CompanyMarket } from '@/lib/api/company'
import { Batch, listBatches, listProducts, Product } from '@/lib/api/master-data'
import {
  addRecallCountry,
  calculateRecallReconciliation,
  createRecallDistributionRecord,
  createRecallPortalLink,
  createRecallScopeVersion,
  createStakeholder,
  freezeRecallScopeVersion,
  importRecallDistributionCsv,
  listRecallCountries,
  listRecallDistributionRecords,
  listRecallPortalLinks,
  listRecallReconciliationSnapshots,
  listRecallRequirements,
  listRecallScopeVersions,
  listStakeholders,
  RECALL_COUNTRY_STATUS_LABELS,
  RecallCountry,
  RecallDistributionRecord,
  RecallImportJob,
  RecallPortalLink,
  RecallReconciliationSnapshot,
  RecallRequirement,
  RecallScopeVersion,
  Stakeholder,
  STAKEHOLDER_TYPE_LABELS,
} from '@/lib/api/recall-stage10'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { Modal } from '@/components/ui/modal'
import { useTranslation } from '@/lib/i18n/use-translation'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'
const btnPrimary = 'flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-2 text-xs font-medium text-white disabled:opacity-50'
const btnSecondary = 'flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50'

function formatDate(v: string | null): string {
  return v ? new Date(v).toLocaleDateString() : '—'
}

/**
 * QualCloud Phase 1 Pass B (item A) — the recall sections as a user works them.
 * Clients pick countries, products, batches and stakeholders from lists. A UUID is
 * never typed. Every list is scoped to the company (its operating markets, its own
 * catalog, its own stakeholders).
 */

/** The company's operating markets as a country picker source (never every seeded country). */
function useOperatingMarkets(): CompanyMarket[] {
  const [markets, setMarkets] = useState<CompanyMarket[]>([])
  useEffect(() => {
    getCompanyMarkets().then(setMarkets).catch(() => setMarkets([]))
  }, [])
  return markets
}

// ───────────────────────────────────────────────────────────── A1 countries

export function RecallCountriesSection({ recallId, onChanged }: { recallId: string; onChanged?: () => void }) {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canManage = has('quality.manage_recalls')
  const markets = useOperatingMarkets()
  const [countries, setCountries] = useState<RecallCountry[]>([])
  const [requirementsByCountry, setRequirementsByCountry] = useState<Record<string, RecallRequirement[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [countryId, setCountryId] = useState('')
  const [adding, setAdding] = useState(false)

  const marketName = useMemo(() => {
    const map = new Map<string, string>()
    markets.forEach((m) => map.set(m.countryId, `${m.country.name} (${m.country.isoCode})`))
    return map
  }, [markets])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await listRecallCountries(recallId)
      setCountries(rows)
      const reqs = await Promise.all(rows.map((c) => listRecallRequirements(c.id)))
      setRequirementsByCountry(Object.fromEntries(rows.map((c, i) => [c.id, reqs[i]])))
    } catch (err) {
      setError(getErrorMessage(err, t('recallLifecycle.errorLoadCountries')))
    } finally {
      setLoading(false)
    }
  }, [recallId, t])

  useEffect(() => {
    void load()
  }, [load])

  const addCountry = async () => {
    if (!countryId) return
    setAdding(true)
    setError(null)
    try {
      const added = await addRecallCountry(recallId, { countryId })
      const name = marketName.get(countryId) ?? t('recallLifecycle.country')
      setCountryId('')
      setNotice(
        added.ruleSetId
          ? t('recallLifecycle.countryAddedWithRuleSet', { name })
          : t('recallLifecycle.countryAddedNoRuleSet', { name }),
      )
      await load()
      onChanged?.()
    } catch (err) {
      setError(getErrorMessage(err, t('recallLifecycle.errorAddCountry')))
    } finally {
      setAdding(false)
    }
  }

  return (
    <CollapsibleSection title={t('recallLifecycle.countriesTitle')} icon={<Globe2 className="h-4 w-4 text-safemeds-teal" />} badge={<span className="text-xs text-muted-foreground">({countries.length})</span>}>
      <p className="mb-3 text-xs text-muted-foreground">
        {t('recallLifecycle.countriesIntro')}
      </p>
      {error && <p className="mb-2 text-sm text-status-error">{error}</p>}
      {notice && <p className="mb-2 text-sm text-status-success">{notice}</p>}
      {canManage && (
        <div className="mb-4 flex gap-2">
          <select value={countryId} onChange={(e) => setCountryId(e.target.value)} className={inputClass}>
            <option value="">{markets.length ? t('recallLifecycle.chooseCountry') : t('recallLifecycle.noOperatingMarkets')}</option>
            {markets.map((m) => (
              <option key={m.countryId} value={m.countryId}>
                {m.country.name} ({m.country.isoCode})
              </option>
            ))}
          </select>
          <button onClick={addCountry} disabled={adding || !countryId} className={btnPrimary}>
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} {t('recallLifecycle.addCountry')}
          </button>
        </div>
      )}
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : countries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('recallLifecycle.noCountriesYet')}</p>
      ) : (
        <div className="space-y-3">
          {countries.map((c) => (
            <div key={c.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{marketName.get(c.countryId) ?? t('recallLifecycle.country')}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{RECALL_COUNTRY_STATUS_LABELS[c.status] ?? c.status}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.ruleSetId ? t('recallLifecycle.ruleSetVersion', { version: String(c.ruleSetVersion) }) : t('recallLifecycle.noRuleSetSignedOff')}
              </p>
              <ul className="mt-2 space-y-1">
                {(requirementsByCountry[c.id] ?? []).map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{t('recallLifecycle.obligation', { id: r.recallRuleId.slice(0, 8) })}</span>
                    <span className={r.status === 'deadline_pending' ? 'text-status-warning' : r.status === 'complete' ? 'text-status-success' : 'text-muted-foreground'}>
                      {r.status === 'deadline_pending' ? t('recallLifecycle.deadlinePending') : r.dueAt ? t('recallLifecycle.due', { date: formatDate(r.dueAt) }) : r.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  )
}

// ───────────────────────────────────────────────────────────── stakeholders (A4)

/** Creates a stakeholder from the recall screen. Country is picked from operating markets, never typed. */
export function NewStakeholderModal({ onClose, onCreated }: { onClose: () => void; onCreated: (s: Stakeholder) => void }) {
  const { t } = useTranslation()
  const markets = useOperatingMarkets()
  const [orgName, setOrgName] = useState('')
  const [type, setType] = useState('distributor')
  const [country, setCountry] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (orgName.trim().length < 2) return setError(t('recallLifecycle.errorOrgNameRequired'))
    if (!contactEmail.trim() && !contactPhone.trim()) return setError(t('recallLifecycle.errorContactRequired'))
    setSaving(true)
    try {
      const created = await createStakeholder({
        orgName: orgName.trim(),
        type,
        ...(country ? { country } : {}),
        ...(contactName.trim() ? { contactName: contactName.trim() } : {}),
        ...(contactEmail.trim() ? { contactEmail: contactEmail.trim() } : {}),
        ...(contactPhone.trim() ? { contactPhone: contactPhone.trim() } : {}),
      })
      onCreated(created)
    } catch (err) {
      setError(getErrorMessage(err, t('recallLifecycle.errorCreateStakeholder')))
      setSaving(false)
    }
  }

  return (
    <Modal title={t('recallLifecycle.newStakeholder')} onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-3">
        <div>
          <label className={labelClass}>{t('recallLifecycle.organisationName')}</label>
          <input className={inputClass} value={orgName} onChange={(e) => setOrgName(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>{t('recallLifecycle.type')}</label>
            <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
              {Object.entries(STAKEHOLDER_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t('recallLifecycle.countryField')}</label>
            <select className={inputClass} value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">{t('recallLifecycle.chooseCountryOptional')}</option>
              {markets.map((m) => (
                <option key={m.countryId} value={m.country.name}>
                  {m.country.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>{t('recallLifecycle.contactPerson')}</label>
          <input className={inputClass} value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>{t('recallLifecycle.contactEmail')}</label>
            <input className={inputClass} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>{t('recallLifecycle.contactPhone')}</label>
            <input className={inputClass} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </div>
        </div>
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className={btnSecondary}>{t('recallLifecycle.cancel')}</button>
          <button onClick={submit} disabled={saving} className={btnPrimary}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {t('recallLifecycle.createStakeholder')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** A dropdown of the company's stakeholders, with an inline "New stakeholder" action. */
export function StakeholderPicker({
  value,
  onChange,
  canCreate,
  refreshKey,
}: {
  value: string
  onChange: (id: string) => void
  canCreate: boolean
  refreshKey?: number
}) {
  const { t } = useTranslation()
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([])
  const [creating, setCreating] = useState(false)
  const load = useCallback(() => {
    listStakeholders({ limit: 100 }).then((page) => setStakeholders(page.rows)).catch(() => setStakeholders([]))
  }, [])
  useEffect(() => {
    load()
  }, [load, refreshKey])
  return (
    <div className="flex gap-2">
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{stakeholders.length ? t('recallLifecycle.chooseStakeholder') : t('recallLifecycle.noStakeholdersYet')}</option>
        {stakeholders.map((s) => (
          <option key={s.id} value={s.id}>
            {s.orgName} · {STAKEHOLDER_TYPE_LABELS[s.type] ?? s.type}
          </option>
        ))}
      </select>
      {canCreate && (
        <button type="button" onClick={() => setCreating(true)} className={btnSecondary}>
          <Users className="h-3.5 w-3.5" /> {t('recallLifecycle.new')}
        </button>
      )}
      {creating && (
        <NewStakeholderModal
          onClose={() => setCreating(false)}
          onCreated={(s) => {
            setCreating(false)
            setStakeholders((prev) => [s, ...prev])
            onChange(s.id)
          }}
        />
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────── A2 product & batch scope

interface ScopeDraftRow {
  key: string
  productId: string
  batchId: string
}

/** 10.2 — product/batch scope, version-on-write, freeze makes it immutable. */
export function RecallScopeSection({ recallId, onChanged }: { recallId: string; onChanged?: () => void }) {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canManage = has('quality.manage_recalls') || has('quality.approve_recall_scope')
  const canFreeze = has('quality.approve_recall_scope')
  const [versions, setVersions] = useState<RecallScopeVersion[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [rows, setRows] = useState<ScopeDraftRow[]>([])
  const [productId, setProductId] = useState('')
  const [batchId, setBatchId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [scopes, productPage, batchPage] = await Promise.all([
        listRecallScopeVersions(recallId),
        listProducts({ limit: 100 }),
        listBatches({ limit: 100 }),
      ])
      setVersions(scopes)
      setProducts(productPage.rows)
      setBatches(batchPage.rows)
    } catch (err) {
      setError(getErrorMessage(err, t('recallLifecycle.errorLoadScope')))
    } finally {
      setLoading(false)
    }
  }, [recallId, t])

  useEffect(() => {
    void load()
  }, [load])

  const latest = versions[0] ?? null
  const frozen = latest?.status === 'frozen'
  const productName = (id: string) => {
    const p = products.find((x) => x.id === id)
    return p ? `${p.brandName} ${p.strength}` : 'Product'
  }
  const batchLabel = (id: string) => {
    const b = batches.find((x) => x.id === id)
    return b ? `batch ${b.batchNumber}` : 'batch'
  }
  const batchesForProduct = useMemo(() => batches.filter((b) => b.productId === productId), [batches, productId])
  const draftItems = frozen ? [] : (latest?.items ?? [])

  /** The draft is the working list: start from the latest version's items when editing, then add or remove here. */
  const workingRows: ScopeDraftRow[] = rows.length > 0 ? rows : draftItems.map((i) => ({ key: i.id, productId: i.productId, batchId: i.batchId }))

  const addRow = () => {
    if (!productId || !batchId) return
    if (workingRows.some((r) => r.batchId === batchId)) return setError(t('recallLifecycle.errorBatchAlreadyInScope'))
    setError(null)
    setRows([...workingRows, { key: `${batchId}-${Date.now()}`, productId, batchId }])
    setBatchId('')
  }

  const saveDraft = async () => {
    setError(null)
    if (workingRows.length === 0) return setError(t('recallLifecycle.errorAddAtLeastOneBatch'))
    setBusy(true)
    try {
      await createRecallScopeVersion(recallId, {
        reason: 'Scope updated from the recall screen',
        items: workingRows.map((r) => ({ productId: r.productId, batchId: r.batchId })),
      })
      setRows([])
      setNotice(t('recallLifecycle.scopeDraftSavedNotice'))
      await load()
      onChanged?.()
    } catch (err) {
      setError(getErrorMessage(err, t('recallLifecycle.errorSaveScope')))
    } finally {
      setBusy(false)
    }
  }

  const freeze = async () => {
    if (!latest) return
    setBusy(true)
    setError(null)
    try {
      await freezeRecallScopeVersion(latest.id)
      setNotice(t('recallLifecycle.scopeFrozenNotice'))
      await load()
      onChanged?.()
    } catch (err) {
      setError(getErrorMessage(err, t('recallLifecycle.errorFreezeScope')))
    } finally {
      setBusy(false)
    }
  }

  const checklist = [
    { ok: workingRows.length > 0, text: t('recallLifecycle.checklistAtLeastOneBatch') },
    { ok: !!latest && latest.status === 'draft' && rows.length === 0, text: t('recallLifecycle.checklistDraftSaved') },
    { ok: canFreeze, text: t('recallLifecycle.checklistApprovalPermission') },
  ]
  const canFreezeNow = !frozen && !!latest && rows.length === 0 && workingRows.length > 0 && canFreeze

  return (
    <CollapsibleSection title={t('recallLifecycle.productBatchScopeTitle')} icon={<Layers className="h-4 w-4 text-safemeds-teal" />} badge={<span className="text-xs text-muted-foreground">({frozen ? t('recallLifecycle.frozen') : t('recallLifecycle.draft')})</span>}>
      <p className="mb-3 text-xs text-muted-foreground">
        {t('recallLifecycle.scopeIntro')} <strong>{t('recallLifecycle.scopeIntroBold')}</strong>{t('recallLifecycle.scopeIntroSuffix')}
      </p>
      {error && <p className="mb-2 text-sm text-status-error">{error}</p>}
      {notice && <p className="mb-2 text-sm text-status-success">{notice}</p>}
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <div className="space-y-4">
          {!frozen && canManage && (
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <select className={inputClass} value={productId} onChange={(e) => { setProductId(e.target.value); setBatchId('') }}>
                <option value="">{t('recallLifecycle.chooseProduct')}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.brandName} {p.strength}
                  </option>
                ))}
              </select>
              <select className={inputClass} value={batchId} onChange={(e) => setBatchId(e.target.value)} disabled={!productId}>
                <option value="">{productId ? t('recallLifecycle.chooseBatch') : t('recallLifecycle.chooseProductFirst')}</option>
                {batchesForProduct.map((b) => (
                  <option key={b.id} value={b.id}>
                    {t('recallLifecycle.batchDetails', { number: b.batchNumber, expires: formatDate(b.expiresOn), size: String(b.batchSize ?? '—') })}
                  </option>
                ))}
              </select>
              <button onClick={addRow} disabled={!batchId} className={btnSecondary}>
                <Plus className="h-3.5 w-3.5" /> {t('recallLifecycle.addBatch')}
              </button>
            </div>
          )}

          <div className="rounded-lg border border-border">
            {workingRows.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">{t('recallLifecycle.noBatchesInScopeYet')}</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {workingRows.map((r) => (
                  <li key={r.key} className="flex items-center justify-between p-3">
                    <span className="text-foreground">
                      {productName(r.productId)} · <span className="text-muted-foreground">{batchLabel(r.batchId)}</span>
                    </span>
                    {!frozen && canManage && (
                      <button className="text-xs text-status-error hover:underline" onClick={() => setRows(workingRows.filter((x) => x.key !== r.key))}>
                        {t('recallLifecycle.remove')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!frozen && canManage && (
            <div className="rounded-lg border border-border p-3">
              <p className="mb-2 text-xs font-medium text-foreground">{t('recallLifecycle.beforeYouFreeze')}</p>
              <ul className="mb-3 space-y-1 text-xs">
                {checklist.map((c) => (
                  <li key={c.text} className={c.ok ? 'text-status-success' : 'text-muted-foreground'}>
                    {c.ok ? '✓' : '○'} {c.text}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <button onClick={saveDraft} disabled={busy || rows.length === 0} className={btnSecondary}>
                  {t('recallLifecycle.saveScopeDraft')}
                </button>
                {canFreeze && (
                  <button onClick={freeze} disabled={busy || !canFreezeNow} className={btnPrimary}>
                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {t('recallLifecycle.freezeScope')}
                  </button>
                )}
              </div>
            </div>
          )}
          {frozen && (
            <p className="text-xs text-status-success">
              {t('recallLifecycle.scopeFrozenStatement', { version: String(latest?.version), date: latest?.approvedAt ? t('recallLifecycle.onDate', { date: formatDate(latest.approvedAt) }) : '' })}
            </p>
          )}
        </div>
      )}
    </CollapsibleSection>
  )
}

// ───────────────────────────────────────────────────────────── A3 distribution

const DISTRIBUTION_CSV_HEADERS = ['toOrgName', 'batchNumber', 'qtyUnits', 'qtyPacks', 'date', 'invoiceNo'] as const
const DISTRIBUTION_CSV_EXAMPLE = ['Coast Pharmacy Ltd', 'B2024-0042', '120', '10', '2026-09-15', 'INV-7781']

function downloadDistributionTemplate() {
  const csv = `${DISTRIBUTION_CSV_HEADERS.join(',')}\n${DISTRIBUTION_CSV_EXAMPLE.join(',')}\n`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'recall-distribution-template.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export function RecallDistributionSection({ recallId }: { recallId: string }) {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canManage = has('quality.manage_recalls') || has('quality.log_recall')
  const [records, setRecords] = useState<RecallDistributionRecord[]>([])
  const [scopeBatches, setScopeBatches] = useState<{ id: string; batchNumber: string }[]>([])
  const [stakeholderNames, setStakeholderNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [importJob, setImportJob] = useState<RecallImportJob | null>(null)
  const [batchId, setBatchId] = useState('')
  const [toOrgId, setToOrgId] = useState('')
  const [qtyUnits, setQtyUnits] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)
  const [stakeholderRefresh, setStakeholderRefresh] = useState(0)

  const DISTRIBUTION_COLUMNS: { name: string; required: boolean; meaning: string }[] = [
    { name: 'toOrgName', required: true, meaning: t('recallLifecycle.meaningToOrgName') },
    { name: 'batchNumber', required: true, meaning: t('recallLifecycle.meaningBatchNumber') },
    { name: 'qtyUnits', required: true, meaning: t('recallLifecycle.meaningQtyUnits') },
    { name: 'qtyPacks', required: false, meaning: t('recallLifecycle.meaningQtyPacks') },
    { name: 'date', required: true, meaning: t('recallLifecycle.meaningDate') },
    { name: 'invoiceNo', required: false, meaning: t('recallLifecycle.meaningInvoiceNo') },
  ]

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rows, scopes, stakeholders] = await Promise.all([
        listRecallDistributionRecords(recallId),
        listRecallScopeVersions(recallId),
        listStakeholders({ limit: 100 }),
      ])
      setRecords(rows)
      const frozenScope = scopes.find((s) => s.status === 'frozen') ?? null
      const batchPage = await listBatches({ limit: 100 })
      const batchNumberById = new Map(batchPage.rows.map((b) => [b.id, b.batchNumber]))
      setScopeBatches(
        (frozenScope?.items ?? []).map((i) => ({ id: i.batchId, batchNumber: batchNumberById.get(i.batchId) ?? 'Batch' })),
      )
      setStakeholderNames(Object.fromEntries(stakeholders.rows.map((s) => [s.id, s.orgName])))
    } catch (err) {
      setError(getErrorMessage(err, t('recallLifecycle.errorLoadDistribution')))
    } finally {
      setLoading(false)
    }
  }, [recallId, t])

  useEffect(() => {
    void load()
  }, [load, stakeholderRefresh])

  const frozenScopeExists = scopeBatches.length > 0

  const submitManual = async () => {
    setError(null)
    if (!batchId || !toOrgId || !qtyUnits || !date) return setError(t('recallLifecycle.errorRequireAllFields'))
    setBusy(true)
    try {
      const created = await createRecallDistributionRecord(recallId, {
        batchId,
        toOrgId,
        qtyUnits: Number(qtyUnits),
        date,
      })
      setNotice(created.warning ?? t('recallLifecycle.distributionRecordAddedNotice'))
      setQtyUnits('')
      await load()
    } catch (err) {
      setError(getErrorMessage(err, t('recallLifecycle.errorAddDistribution')))
    } finally {
      setBusy(false)
    }
  }

  const importFile = async (file: File) => {
    setError(null)
    setBusy(true)
    try {
      const csv = await file.text()
      const job = await importRecallDistributionCsv(recallId, csv)
      setImportJob(job)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, t('recallLifecycle.errorImportFile')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <CollapsibleSection title={t('recallLifecycle.distributionRecordsTitle')} icon={<Truck className="h-4 w-4 text-safemeds-teal" />} badge={<span className="text-xs text-muted-foreground">({records.length})</span>}>
      <div className="space-y-4">
        {error && <p className="text-sm text-status-error">{error}</p>}
        {notice && <p className="text-sm text-status-success">{notice}</p>}

        <div className="rounded-lg border border-border p-3">
          <p className="text-sm font-medium text-foreground">{t('recallLifecycle.importFromSpreadsheet')}</p>
          <p className="mb-2 text-xs text-muted-foreground">
            {t('recallLifecycle.importIntro')}
          </p>
          <div className="mb-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-1 pr-3 font-medium">{t('recallLifecycle.columnColumn')}</th>
                  <th className="pb-1 pr-3 font-medium">{t('recallLifecycle.columnRequired')}</th>
                  <th className="pb-1 font-medium">{t('recallLifecycle.columnWhatToEnter')}</th>
                </tr>
              </thead>
              <tbody>
                {DISTRIBUTION_COLUMNS.map((c) => (
                  <tr key={c.name} className="border-t border-border align-top">
                    <td className="py-1 pr-3 font-mono text-foreground">{c.name}</td>
                    <td className="py-1 pr-3">{c.required ? t('recallLifecycle.yes') : t('recallLifecycle.no')}</td>
                    <td className="py-1 text-muted-foreground">{c.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mb-2 font-mono text-[11px] text-muted-foreground">
            {DISTRIBUTION_CSV_HEADERS.join(',')}
            <br />
            {DISTRIBUTION_CSV_EXAMPLE.join(',')} <span className="font-sans">{t('recallLifecycle.exampleRow')}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={downloadDistributionTemplate} className={btnSecondary}>
              {t('recallLifecycle.downloadCsvTemplate')}
            </button>
            {canManage && (
              <label className={`${btnPrimary} cursor-pointer`}>
                {t('recallLifecycle.uploadDistributionFile')}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  disabled={busy || !frozenScopeExists}
                  onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
                />
              </label>
            )}
            {!frozenScopeExists && <span className="text-xs text-muted-foreground">{t('recallLifecycle.freezeScopeFirst')}</span>}
          </div>
          {importJob && (
            <div className="mt-3 rounded-lg bg-muted/50 p-3 text-xs">
              <p className="text-foreground">
                {t('recallLifecycle.rowsImported', {
                  valid: String(importJob.validRows),
                  total: String(importJob.rows),
                  errorsSummary: importJob.errorRows > 0 ? t('recallLifecycle.rowsNeedAttention', { count: String(importJob.errorRows) }) : t('recallLifecycle.noErrors'),
                })}
              </p>
              {importJob.errors && importJob.errors.length > 0 && (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-status-error">
                  {importJob.errors.map((e) => (
                    <li key={`${e.row}-${e.message}`}>
                      {t('recallLifecycle.rowError', { row: String(e.row), message: e.message })}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {canManage && (
          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-sm font-medium text-foreground">{t('recallLifecycle.addOneDeliveryByHand')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{t('recallLifecycle.batchFromFrozenScope')}</label>
                <select className={inputClass} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                  <option value="">{frozenScopeExists ? t('recallLifecycle.chooseBatch') : t('recallLifecycle.freezeTheScopeFirst')}</option>
                  {scopeBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batchNumber}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t('recallLifecycle.recipient')}</label>
                <StakeholderPicker value={toOrgId} onChange={setToOrgId} canCreate={canManage} refreshKey={stakeholderRefresh} />
              </div>
              <div>
                <label className={labelClass}>{t('recallLifecycle.unitsSent')}</label>
                <input className={inputClass} type="number" value={qtyUnits} onChange={(e) => setQtyUnits(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>{t('recallLifecycle.deliveryDate')}</label>
                <input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <button onClick={submitManual} disabled={busy} className={`${btnPrimary} mt-3`}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {t('recallLifecycle.addDelivery')}
            </button>
          </div>
        )}

        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : records.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('recallLifecycle.noDistributionRecordsYet')}</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {records.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded border border-border px-3 py-2">
                <span className="text-foreground">
                  {t('recallLifecycle.distributionRecordLine', {
                    recipient: stakeholderNames[r.toOrgId] ?? t('recallLifecycle.recipientGeneric'),
                    batch: scopeBatches.find((b) => b.id === r.batchId)?.batchNumber ?? t('recallLifecycle.batchGeneric'),
                    units: String(r.qtyUnits),
                  })}
                </span>
                <span className="text-muted-foreground">{formatDate(r.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CollapsibleSection>
  )
}

// ───────────────────────────────────────────────────────────── A4 stakeholder portal

export function RecallStakeholderPortalSection({ recallId }: { recallId: string }) {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canManage = has('quality.manage_recalls')
  const [links, setLinks] = useState<RecallPortalLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [stakeholderId, setStakeholderId] = useState('')
  const [busy, setBusy] = useState(false)
  const [lastToken, setLastToken] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setLinks(await listRecallPortalLinks(recallId))
    } catch (err) {
      setError(getErrorMessage(err, t('recallLifecycle.errorLoadPortalLinks')))
    } finally {
      setLoading(false)
    }
  }, [recallId, t])

  useEffect(() => {
    void load()
  }, [load])

  const create = async () => {
    if (!stakeholderId) return
    setBusy(true)
    setError(null)
    try {
      const result = await createRecallPortalLink(recallId, { stakeholderId })
      setLastToken((result as unknown as { token?: string }).token ?? null)
      setStakeholderId('')
      setNotice(t('recallLifecycle.portalLinkCreatedNotice'))
      await load()
    } catch (err) {
      setError(getErrorMessage(err, t('recallLifecycle.errorCreatePortalLink')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <CollapsibleSection title={t('recallLifecycle.stakeholderPortalTitle')} icon={<ShieldCheck className="h-4 w-4 text-safemeds-teal" />} badge={<span className="text-xs text-muted-foreground">({links.length})</span>}>
      <p className="mb-3 text-xs text-muted-foreground">
        {t('recallLifecycle.portalIntro')}
      </p>
      {error && <p className="mb-2 text-sm text-status-error">{error}</p>}
      {notice && <p className="mb-2 text-sm text-status-success">{notice}</p>}
      {canManage && (
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="min-w-[16rem] flex-1">
            <StakeholderPicker value={stakeholderId} onChange={setStakeholderId} canCreate={canManage} />
          </div>
          <button onClick={create} disabled={busy || !stakeholderId} className={btnPrimary}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {t('recallLifecycle.createPortalLink')}
          </button>
        </div>
      )}
      {lastToken && (
        <p className="mb-3 break-all rounded bg-muted p-2 font-mono text-xs text-foreground">
          {typeof window !== 'undefined' ? `${window.location.origin}/recall-portal/${lastToken}` : lastToken}
        </p>
      )}
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : links.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('recallLifecycle.noPortalLinksYet')}</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {links.map((l) => (
            <li key={l.id} className="flex items-center justify-between">
              <span className="text-foreground">{l.stakeholder.orgName}</span>
              <span className="text-muted-foreground">{l.revoked ? t('recallLifecycle.revoked') : t('recallLifecycle.expires', { date: formatDate(l.expiresAt) })}</span>
            </li>
          ))}
        </ul>
      )}
    </CollapsibleSection>
  )
}

export function RecallReconciliationSection({ recallId }: { recallId: string }) {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canManage = has('quality.manage_recalls')
  const [countries, setCountries] = useState<RecallCountry[]>([])
  const [snapshots, setSnapshots] = useState<Record<string, RecallReconciliationSnapshot | null>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await listRecallCountries(recallId)
      setCountries(rows)
      const snaps = await Promise.all(rows.map((c) => listRecallReconciliationSnapshots(c.id)))
      setSnapshots(Object.fromEntries(rows.map((c, i) => [c.id, snaps[i][0] ?? null])))
    } catch (err) {
      setError(getErrorMessage(err, t('recallLifecycle.errorLoadReconciliation')))
    } finally {
      setLoading(false)
    }
  }, [recallId, t])

  useEffect(() => {
    void load()
  }, [load])

  const recalc = async (recallCountryId: string) => {
    setBusy(recallCountryId)
    try {
      const snapshot = await calculateRecallReconciliation(recallCountryId)
      setSnapshots((prev) => ({ ...prev, [recallCountryId]: snapshot }))
    } catch (err) {
      setError(getErrorMessage(err, t('recallLifecycle.errorCalculateReconciliation')))
    } finally {
      setBusy(null)
    }
  }

  if (countries.length === 0 && !loading) return null

  return (
    <CollapsibleSection title={t('recallLifecycle.reconciliationTitle')} icon={<ShieldCheck className="h-4 w-4 text-safemeds-teal" />}>
      {error && <p className="mb-2 text-sm text-status-error">{error}</p>}
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <div className="space-y-3">
          {countries.map((c) => {
            const snap = snapshots[c.id]
            return (
              <div key={c.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-foreground">{c.countryId}</span>
                  {canManage && (
                    <button onClick={() => recalc(c.id)} disabled={busy === c.id} className={btnSecondary}>
                      {busy === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {t('recallLifecycle.recalculate')}
                    </button>
                  )}
                </div>
                {snap ? (
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
                    {([
                      [t('recallLifecycle.distributed'), snap.distributed],
                      [t('recallLifecycle.recovered'), snap.recovered],
                      [t('recallLifecycle.quarantined'), snap.quarantined],
                      [t('recallLifecycle.accounted'), snap.accounted],
                      [t('recallLifecycle.outstanding'), snap.outstanding],
                      [t('recallLifecycle.destroyed'), snap.destroyed],
                    ] as const).map(([label, value]) => (
                      <div key={label} className="rounded-lg bg-muted/40 p-2">
                        <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
                        <p className="font-mono text-sm font-semibold text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">{t('recallLifecycle.noSnapshotYet')}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </CollapsibleSection>
  )
}
