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
      setError(getErrorMessage(err, 'Could not load recall countries.'))
    } finally {
      setLoading(false)
    }
  }, [recallId])

  useEffect(() => {
    void load()
  }, [load])

  const addCountry = async () => {
    if (!countryId) return
    setAdding(true)
    setError(null)
    try {
      const added = await addRecallCountry(recallId, { countryId })
      const name = marketName.get(countryId) ?? 'That country'
      setCountryId('')
      setNotice(
        added.ruleSetId
          ? `${name} added. Its recall deadlines follow the signed-off rule-set.`
          : `${name} added. No recall rule-set is signed off for this country yet, so no deadline can be calculated. The recall still records the country.`,
      )
      await load()
      onChanged?.()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not add this country.'))
    } finally {
      setAdding(false)
    }
  }

  return (
    <CollapsibleSection title="Countries & Requirements" icon={<Globe2 className="h-4 w-4 text-safemeds-teal" />} badge={<span className="text-xs text-muted-foreground">({countries.length})</span>}>
      <p className="mb-3 text-xs text-muted-foreground">
        Pick the countries this recall must reach. Only your company&apos;s operating markets are listed.
      </p>
      {error && <p className="mb-2 text-sm text-status-error">{error}</p>}
      {notice && <p className="mb-2 text-sm text-status-success">{notice}</p>}
      {canManage && (
        <div className="mb-4 flex gap-2">
          <select value={countryId} onChange={(e) => setCountryId(e.target.value)} className={inputClass}>
            <option value="">{markets.length ? 'Choose a country' : 'No operating markets yet'}</option>
            {markets.map((m) => (
              <option key={m.countryId} value={m.countryId}>
                {m.country.name} ({m.country.isoCode})
              </option>
            ))}
          </select>
          <button onClick={addCountry} disabled={adding || !countryId} className={btnPrimary}>
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add country
          </button>
        </div>
      )}
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : countries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No countries added yet — this recall is currently single-jurisdiction only.</p>
      ) : (
        <div className="space-y-3">
          {countries.map((c) => (
            <div key={c.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{marketName.get(c.countryId) ?? 'Country'}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{RECALL_COUNTRY_STATUS_LABELS[c.status] ?? c.status}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.ruleSetId ? `Rule-set version ${c.ruleSetVersion}` : 'No recall rule-set is signed off for this country yet, so no deadline is calculated.'}
              </p>
              <ul className="mt-2 space-y-1">
                {(requirementsByCountry[c.id] ?? []).map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-xs">
                    <span className="text-foreground">Obligation {r.recallRuleId.slice(0, 8)}</span>
                    <span className={r.status === 'deadline_pending' ? 'text-status-warning' : r.status === 'complete' ? 'text-status-success' : 'text-muted-foreground'}>
                      {r.status === 'deadline_pending' ? 'Deadline pending (per rule-set)' : r.dueAt ? `Due ${formatDate(r.dueAt)}` : r.status}
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
    if (orgName.trim().length < 2) return setError('Enter the organisation name.')
    if (!contactEmail.trim() && !contactPhone.trim()) return setError('Enter at least an email address or a phone number so the recall can reach them.')
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
      setError(getErrorMessage(err, 'Could not create this stakeholder.'))
      setSaving(false)
    }
  }

  return (
    <Modal title="New stakeholder" onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-3">
        <div>
          <label className={labelClass}>Organisation name</label>
          <input className={inputClass} value={orgName} onChange={(e) => setOrgName(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Type</label>
            <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
              {Object.entries(STAKEHOLDER_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Country</label>
            <select className={inputClass} value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">Choose a country (optional)</option>
              {markets.map((m) => (
                <option key={m.countryId} value={m.country.name}>
                  {m.country.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>Contact person</label>
          <input className={inputClass} value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Contact email</label>
            <input className={inputClass} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Contact phone</label>
            <input className={inputClass} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </div>
        </div>
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className={btnSecondary}>Cancel</button>
          <button onClick={submit} disabled={saving} className={btnPrimary}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create stakeholder
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
        <option value="">{stakeholders.length ? 'Choose a stakeholder' : 'No stakeholders yet'}</option>
        {stakeholders.map((s) => (
          <option key={s.id} value={s.id}>
            {s.orgName} · {STAKEHOLDER_TYPE_LABELS[s.type] ?? s.type}
          </option>
        ))}
      </select>
      {canCreate && (
        <button type="button" onClick={() => setCreating(true)} className={btnSecondary}>
          <Users className="h-3.5 w-3.5" /> New
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
      setError(getErrorMessage(err, 'Could not load the product and batch scope.'))
    } finally {
      setLoading(false)
    }
  }, [recallId])

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
    if (workingRows.some((r) => r.batchId === batchId)) return setError('That batch is already in the scope.')
    setError(null)
    setRows([...workingRows, { key: `${batchId}-${Date.now()}`, productId, batchId }])
    setBatchId('')
  }

  const saveDraft = async () => {
    setError(null)
    if (workingRows.length === 0) return setError('Add at least one product batch to the scope before saving.')
    setBusy(true)
    try {
      await createRecallScopeVersion(recallId, {
        reason: 'Scope updated from the recall screen',
        items: workingRows.map((r) => ({ productId: r.productId, batchId: r.batchId })),
      })
      setRows([])
      setNotice('Scope draft saved. Freeze it when the list is complete.')
      await load()
      onChanged?.()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save the scope.'))
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
      setNotice('Scope frozen. The product and batch list is now locked for this recall.')
      await load()
      onChanged?.()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not freeze the scope.'))
    } finally {
      setBusy(false)
    }
  }

  const checklist = [
    { ok: workingRows.length > 0, text: 'At least one product batch is in the scope' },
    { ok: !!latest && latest.status === 'draft' && rows.length === 0, text: 'The scope draft is saved (no unsaved changes)' },
    { ok: canFreeze, text: 'You hold the scope-approval permission (quality.approve_recall_scope)' },
  ]
  const canFreezeNow = !frozen && !!latest && rows.length === 0 && workingRows.length > 0 && canFreeze

  return (
    <CollapsibleSection title="Product & Batch Scope" icon={<Layers className="h-4 w-4 text-safemeds-teal" />} badge={<span className="text-xs text-muted-foreground">({frozen ? 'frozen' : 'draft'})</span>}>
      <p className="mb-3 text-xs text-muted-foreground">
        Choose the products and batches this recall covers. <strong>Freezing locks the exact product/batch list before approval</strong>: once frozen, the list
        cannot be changed, so approval and distribution records always refer to the same scope.
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
                <option value="">Choose a product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.brandName} {p.strength}
                  </option>
                ))}
              </select>
              <select className={inputClass} value={batchId} onChange={(e) => setBatchId(e.target.value)} disabled={!productId}>
                <option value="">{productId ? 'Choose a batch' : 'Choose a product first'}</option>
                {batchesForProduct.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batchNumber} · expires {formatDate(b.expiresOn)} · size {b.batchSize ?? '—'}
                  </option>
                ))}
              </select>
              <button onClick={addRow} disabled={!batchId} className={btnSecondary}>
                <Plus className="h-3.5 w-3.5" /> Add batch
              </button>
            </div>
          )}

          <div className="rounded-lg border border-border">
            {workingRows.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">No products or batches in the scope yet.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {workingRows.map((r) => (
                  <li key={r.key} className="flex items-center justify-between p-3">
                    <span className="text-foreground">
                      {productName(r.productId)} · <span className="text-muted-foreground">{batchLabel(r.batchId)}</span>
                    </span>
                    {!frozen && canManage && (
                      <button className="text-xs text-status-error hover:underline" onClick={() => setRows(workingRows.filter((x) => x.key !== r.key))}>
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!frozen && canManage && (
            <div className="rounded-lg border border-border p-3">
              <p className="mb-2 text-xs font-medium text-foreground">Before you freeze</p>
              <ul className="mb-3 space-y-1 text-xs">
                {checklist.map((c) => (
                  <li key={c.text} className={c.ok ? 'text-status-success' : 'text-muted-foreground'}>
                    {c.ok ? '✓' : '○'} {c.text}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <button onClick={saveDraft} disabled={busy || rows.length === 0} className={btnSecondary}>
                  Save scope draft
                </button>
                {canFreeze && (
                  <button onClick={freeze} disabled={busy || !canFreezeNow} className={btnPrimary}>
                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Freeze scope
                  </button>
                )}
              </div>
            </div>
          )}
          {frozen && (
            <p className="text-xs text-status-success">
              Scope v{latest?.version} is frozen{latest?.approvedAt ? ` on ${formatDate(latest.approvedAt)}` : ''}. It cannot be changed.
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

const DISTRIBUTION_COLUMNS: { name: string; required: boolean; meaning: string }[] = [
  { name: 'toOrgName', required: true, meaning: 'The stakeholder that received the product. Use the exact organisation name. A new name creates a stakeholder.' },
  { name: 'batchNumber', required: true, meaning: 'The batch number as printed on the pack (not an internal ID). It must be in this recall’s frozen scope.' },
  { name: 'qtyUnits', required: true, meaning: 'How many individual units were sent.' },
  { name: 'qtyPacks', required: false, meaning: 'How many packs or cartons, if you count in packs.' },
  { name: 'date', required: true, meaning: 'The delivery date, in the form YYYY-MM-DD.' },
  { name: 'invoiceNo', required: false, meaning: 'The invoice number for the delivery, to trace it later.' },
]

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
      setError(getErrorMessage(err, 'Could not load distribution records.'))
    } finally {
      setLoading(false)
    }
  }, [recallId])

  useEffect(() => {
    void load()
  }, [load, stakeholderRefresh])

  const frozenScopeExists = scopeBatches.length > 0

  const submitManual = async () => {
    setError(null)
    if (!batchId || !toOrgId || !qtyUnits || !date) return setError('Choose a batch, a recipient, the quantity and the date.')
    setBusy(true)
    try {
      const created = await createRecallDistributionRecord(recallId, {
        batchId,
        toOrgId,
        qtyUnits: Number(qtyUnits),
        date,
      })
      setNotice(created.warning ?? 'Distribution record added.')
      setQtyUnits('')
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not add this distribution record.'))
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
      setError(getErrorMessage(err, 'Could not import this file.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <CollapsibleSection title="Distribution Records" icon={<Truck className="h-4 w-4 text-safemeds-teal" />} badge={<span className="text-xs text-muted-foreground">({records.length})</span>}>
      <div className="space-y-4">
        {error && <p className="text-sm text-status-error">{error}</p>}
        {notice && <p className="text-sm text-status-success">{notice}</p>}

        <div className="rounded-lg border border-border p-3">
          <p className="text-sm font-medium text-foreground">Import from a spreadsheet</p>
          <p className="mb-2 text-xs text-muted-foreground">
            Download the template, fill one row per delivery, then upload it. Batch numbers are matched against this recall&apos;s frozen scope. A row with an
            unknown batch number is reported, and the rest still import.
          </p>
          <div className="mb-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-1 pr-3 font-medium">Column</th>
                  <th className="pb-1 pr-3 font-medium">Required</th>
                  <th className="pb-1 font-medium">What to enter</th>
                </tr>
              </thead>
              <tbody>
                {DISTRIBUTION_COLUMNS.map((c) => (
                  <tr key={c.name} className="border-t border-border align-top">
                    <td className="py-1 pr-3 font-mono text-foreground">{c.name}</td>
                    <td className="py-1 pr-3">{c.required ? 'Yes' : 'No'}</td>
                    <td className="py-1 text-muted-foreground">{c.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mb-2 font-mono text-[11px] text-muted-foreground">
            {DISTRIBUTION_CSV_HEADERS.join(',')}
            <br />
            {DISTRIBUTION_CSV_EXAMPLE.join(',')} <span className="font-sans">← example row</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={downloadDistributionTemplate} className={btnSecondary}>
              Download CSV template
            </button>
            {canManage && (
              <label className={`${btnPrimary} cursor-pointer`}>
                Upload distribution file
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  disabled={busy || !frozenScopeExists}
                  onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
                />
              </label>
            )}
            {!frozenScopeExists && <span className="text-xs text-muted-foreground">Freeze the scope first. Uploads are checked against it.</span>}
          </div>
          {importJob && (
            <div className="mt-3 rounded-lg bg-muted/50 p-3 text-xs">
              <p className="text-foreground">
                {importJob.validRows} of {importJob.rows} row(s) imported. {importJob.errorRows > 0 ? `${importJob.errorRows} row(s) need attention:` : 'No errors.'}
              </p>
              {importJob.errors && importJob.errors.length > 0 && (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-status-error">
                  {importJob.errors.map((e) => (
                    <li key={`${e.row}-${e.message}`}>
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {canManage && (
          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-sm font-medium text-foreground">Add one delivery by hand</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Batch (from the frozen scope)</label>
                <select className={inputClass} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                  <option value="">{frozenScopeExists ? 'Choose a batch' : 'Freeze the scope first'}</option>
                  {scopeBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batchNumber}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Recipient</label>
                <StakeholderPicker value={toOrgId} onChange={setToOrgId} canCreate={canManage} refreshKey={stakeholderRefresh} />
              </div>
              <div>
                <label className={labelClass}>Units sent</label>
                <input className={inputClass} type="number" value={qtyUnits} onChange={(e) => setQtyUnits(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Delivery date</label>
                <input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <button onClick={submitManual} disabled={busy} className={`${btnPrimary} mt-3`}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Add delivery
            </button>
          </div>
        )}

        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : records.length === 0 ? (
          <p className="text-sm text-muted-foreground">No distribution records yet.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {records.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded border border-border px-3 py-2">
                <span className="text-foreground">
                  {stakeholderNames[r.toOrgId] ?? 'Recipient'} · {scopeBatches.find((b) => b.id === r.batchId)?.batchNumber ?? 'batch'} · {r.qtyUnits} units
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
      setError(getErrorMessage(err, 'Could not load portal links.'))
    } finally {
      setLoading(false)
    }
  }, [recallId])

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
      setNotice('Portal link created. Copy it now; it is shown once.')
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create the portal link.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <CollapsibleSection title="Stakeholder Portal Access" icon={<ShieldCheck className="h-4 w-4 text-safemeds-teal" />} badge={<span className="text-xs text-muted-foreground">({links.length})</span>}>
      <p className="mb-3 text-xs text-muted-foreground">
        A stakeholder confirms receipt, counts stock and reports their customers through a private link. They need no SafeMeds account.
      </p>
      {error && <p className="mb-2 text-sm text-status-error">{error}</p>}
      {notice && <p className="mb-2 text-sm text-status-success">{notice}</p>}
      {canManage && (
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="min-w-[16rem] flex-1">
            <StakeholderPicker value={stakeholderId} onChange={setStakeholderId} canCreate={canManage} />
          </div>
          <button onClick={create} disabled={busy || !stakeholderId} className={btnPrimary}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create portal link
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
        <p className="text-sm text-muted-foreground">No portal links yet.</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {links.map((l) => (
            <li key={l.id} className="flex items-center justify-between">
              <span className="text-foreground">{l.stakeholder.orgName}</span>
              <span className="text-muted-foreground">{l.revoked ? 'Revoked' : `Expires ${formatDate(l.expiresAt)}`}</span>
            </li>
          ))}
        </ul>
      )}
    </CollapsibleSection>
  )
}

export function RecallReconciliationSection({ recallId }: { recallId: string }) {
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
      setError(getErrorMessage(err, 'Could not load reconciliation.'))
    } finally {
      setLoading(false)
    }
  }, [recallId])

  useEffect(() => {
    void load()
  }, [load])

  const recalc = async (recallCountryId: string) => {
    setBusy(recallCountryId)
    try {
      const snapshot = await calculateRecallReconciliation(recallCountryId)
      setSnapshots((prev) => ({ ...prev, [recallCountryId]: snapshot }))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not calculate reconciliation.'))
    } finally {
      setBusy(null)
    }
  }

  if (countries.length === 0 && !loading) return null

  return (
    <CollapsibleSection title="Reconciliation" icon={<ShieldCheck className="h-4 w-4 text-safemeds-teal" />}>
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
                      {busy === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Recalculate
                    </button>
                  )}
                </div>
                {snap ? (
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
                    {([
                      ['Distributed', snap.distributed],
                      ['Recovered', snap.recovered],
                      ['Quarantined', snap.quarantined],
                      ['Accounted', snap.accounted],
                      ['Outstanding', snap.outstanding],
                      ['Destroyed', snap.destroyed],
                    ] as const).map(([label, value]) => (
                      <div key={label} className="rounded-lg bg-muted/40 p-2">
                        <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
                        <p className="font-mono text-sm font-semibold text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">No snapshot calculated yet.</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </CollapsibleSection>
  )
}
