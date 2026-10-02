'use client'

import { useCallback, useEffect, useState } from 'react'
import { Globe2, Layers, Loader2, Plus, ShieldCheck, Truck } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  addRecallCountry,
  calculateRecallReconciliation,
  createRecallDistributionRecord,
  createRecallPortalLink,
  createRecallScopeVersion,
  freezeRecallScopeVersion,
  listRecallCountries,
  listRecallDistributionRecords,
  listRecallPortalLinks,
  listRecallReconciliationSnapshots,
  listRecallRequirements,
  listRecallScopeVersions,
  RECALL_COUNTRY_STATUS_LABELS,
  RecallCountry,
  RecallDistributionRecord,
  RecallPortalLink,
  RecallReconciliationSnapshot,
  RecallRequirement,
  RecallScopeVersion,
} from '@/lib/api/recall-stage10'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { CollapsibleSection } from '@/components/ui/collapsible-section'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const btnPrimary = 'flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-2 text-xs font-medium text-white disabled:opacity-50'
const btnSecondary = 'flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50'

function formatDate(v: string | null): string {
  return v ? new Date(v).toLocaleDateString() : '—'
}

/** 10.2 — per-country sub-lifecycle, adding a country resolves the live rule-set and evaluates real requirements. */
export function RecallCountriesSection({ recallId, onChanged }: { recallId: string; onChanged?: () => void }) {
  const { has } = usePermissions()
  const canManage = has('quality.manage_recalls')
  const [countries, setCountries] = useState<RecallCountry[]>([])
  const [requirementsByCountry, setRequirementsByCountry] = useState<Record<string, RecallRequirement[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [countryIdInput, setCountryIdInput] = useState('')
  const [adding, setAdding] = useState(false)

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
    if (!countryIdInput.trim()) return
    setAdding(true)
    try {
      await addRecallCountry(recallId, { countryId: countryIdInput.trim() })
      setCountryIdInput('')
      setNotice('Country added — requirements evaluated against the live rule-set.')
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
      {error && <p className="mb-2 text-sm text-status-error">{error}</p>}
      {notice && <p className="mb-2 text-sm text-status-success">{notice}</p>}
      {canManage && (
        <div className="mb-4 flex gap-2">
          <input value={countryIdInput} onChange={(e) => setCountryIdInput(e.target.value)} placeholder="Country ID (UUID)" className={inputClass} />
          <button onClick={addCountry} disabled={adding} className={btnPrimary}>
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
                <span className="font-mono text-xs text-foreground">{c.countryId}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{RECALL_COUNTRY_STATUS_LABELS[c.status] ?? c.status}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Rule-set version: {c.ruleSetVersion ?? 'per rule-set (none live yet)'}
              </p>
              <ul className="mt-2 space-y-1">
                {(requirementsByCountry[c.id] ?? []).map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-xs">
                    <span className="text-foreground">Rule {r.recallRuleId.slice(0, 8)}…</span>
                    <span className={r.status === 'deadline_pending' ? 'text-status-warning' : r.status === 'complete' ? 'text-status-success' : 'text-muted-foreground'}>
                      {r.status === 'deadline_pending' ? 'Per rule-set (deadline pending)' : r.dueAt ? `Due ${formatDate(r.dueAt)}` : r.status}
                    </span>
                  </li>
                ))}
                {(requirementsByCountry[c.id] ?? []).length === 0 && <li className="text-xs text-muted-foreground">No obligations resolved yet (no live rule-set for this country/authority).</li>}
              </ul>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  )
}

/** 10.2 — product/batch scope, version-on-write, freeze makes it immutable. */
export function RecallScopeSection({ recallId, onChanged }: { recallId: string; onChanged?: () => void }) {
  const { has } = usePermissions()
  const canEdit = has('quality.manage_recalls')
  const canApprove = has('quality.approve_recall_scope')
  const [versions, setVersions] = useState<RecallScopeVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [productId, setProductId] = useState('')
  const [batchId, setBatchId] = useState('')
  const [batchSize, setBatchSize] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setVersions(await listRecallScopeVersions(recallId))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load scope versions.'))
    } finally {
      setLoading(false)
    }
  }, [recallId])

  useEffect(() => {
    void load()
  }, [load])

  const createDraft = async () => {
    if (!productId.trim() || !batchId.trim()) return
    setBusy(true)
    try {
      await createRecallScopeVersion(recallId, {
        items: [{ productId: productId.trim(), batchId: batchId.trim(), batchSize: batchSize ? Number(batchSize) : undefined }],
      })
      setProductId('')
      setBatchId('')
      setBatchSize('')
      setNotice('New draft scope version created.')
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create a scope version.'))
    } finally {
      setBusy(false)
    }
  }

  const freeze = async (id: string) => {
    setBusy(true)
    try {
      await freezeRecallScopeVersion(id)
      setNotice('Scope version frozen — now immutable.')
      await load()
      onChanged?.()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not freeze this scope version.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <CollapsibleSection title="Product & Batch Scope" icon={<Layers className="h-4 w-4 text-safemeds-teal" />} badge={<span className="text-xs text-muted-foreground">({versions.length} version{versions.length === 1 ? '' : 's'})</span>}>
      {error && <p className="mb-2 text-sm text-status-error">{error}</p>}
      {notice && <p className="mb-2 text-sm text-status-success">{notice}</p>}
      {canEdit && (
        <div className="mb-4 grid gap-2 sm:grid-cols-4">
          <input value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="Product ID" className={inputClass} />
          <input value={batchId} onChange={(e) => setBatchId(e.target.value)} placeholder="Batch ID" className={inputClass} />
          <input value={batchSize} onChange={(e) => setBatchSize(e.target.value)} placeholder="Batch size" type="number" className={inputClass} />
          <button onClick={createDraft} disabled={busy} className={btnPrimary}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} New draft
          </button>
        </div>
      )}
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No scope version yet — a frozen scope is required before this recall can be approved.</p>
      ) : (
        <div className="space-y-2">
          {versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
              <div>
                <span className="font-medium text-foreground">Version {v.version}</span>
                <span className="ml-2 text-xs text-muted-foreground">{v.items.length} item{v.items.length === 1 ? '' : 's'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs ${v.status === 'frozen' ? 'bg-status-success/10 text-status-success' : v.status === 'superseded' ? 'bg-muted text-muted-foreground' : 'bg-status-warning/10 text-status-warning'}`}>
                  {v.status}
                </span>
                {v.status === 'draft' && canApprove && (
                  <button onClick={() => freeze(v.id)} disabled={busy} className={btnSecondary}>
                    Freeze
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  )
}

/** 10.3 — distribution records, matching the manual entry half of the spec (CSV import handled on a dedicated screen). */
export function RecallDistributionSection({ recallId }: { recallId: string }) {
  const { has } = usePermissions()
  const canManage = has('quality.manage_recalls')
  const [records, setRecords] = useState<RecallDistributionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [batchId, setBatchId] = useState('')
  const [toOrgId, setToOrgId] = useState('')
  const [qtyUnits, setQtyUnits] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRecords(await listRecallDistributionRecords(recallId))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load distribution records.'))
    } finally {
      setLoading(false)
    }
  }, [recallId])

  useEffect(() => {
    void load()
  }, [load])

  const create = async () => {
    if (!batchId.trim() || !toOrgId.trim() || !qtyUnits) return
    setBusy(true)
    try {
      const created = await createRecallDistributionRecord(recallId, { batchId: batchId.trim(), toOrgId: toOrgId.trim(), qtyUnits: Number(qtyUnits), date })
      if (created.warning) setNotice(created.warning)
      else setNotice('Distribution record recorded.')
      setBatchId('')
      setToOrgId('')
      setQtyUnits('')
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not record this distribution.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <CollapsibleSection title="Distribution Records" icon={<Truck className="h-4 w-4 text-safemeds-teal" />} badge={<span className="text-xs text-muted-foreground">({records.length})</span>}>
      {error && <p className="mb-2 text-sm text-status-error">{error}</p>}
      {notice && <p className="mb-2 text-sm text-status-warning">{notice}</p>}
      {canManage && (
        <div className="mb-4 grid gap-2 sm:grid-cols-5">
          <input value={batchId} onChange={(e) => setBatchId(e.target.value)} placeholder="Batch ID" className={inputClass} />
          <input value={toOrgId} onChange={(e) => setToOrgId(e.target.value)} placeholder="Recipient stakeholder ID" className={inputClass} />
          <input value={qtyUnits} onChange={(e) => setQtyUnits(e.target.value)} placeholder="Qty (units)" type="number" className={inputClass} />
          <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className={inputClass} />
          <button onClick={create} disabled={busy} className={btnPrimary}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Record
          </button>
        </div>
      )}
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : records.length === 0 ? (
        <p className="text-sm text-muted-foreground">No distribution recorded yet.</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="text-left font-medium">Date</th>
              <th className="text-left font-medium">Batch</th>
              <th className="text-left font-medium">Qty (units)</th>
              <th className="text-left font-medium">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {records.map((r) => (
              <tr key={r.id}>
                <td className="py-1.5">{formatDate(r.date)}</td>
                <td className="py-1.5 font-mono">{r.batchId.slice(0, 8)}…</td>
                <td className="py-1.5">{r.qtyUnits}</td>
                <td className="py-1.5 capitalize">{r.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </CollapsibleSection>
  )
}

/** 10.4 — a stakeholder-facing token link; the actual public portal page lives at /recall-portal/[token]. */
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
    if (!stakeholderId.trim()) return
    setBusy(true)
    try {
      const result = await createRecallPortalLink(recallId, { stakeholderId: stakeholderId.trim() })
      setLastToken(result.token)
      setStakeholderId('')
      setNotice('Portal link created — copy the token below and share it (once) with the stakeholder.')
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create a portal link.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <CollapsibleSection title="Stakeholder Portal Access" icon={<ShieldCheck className="h-4 w-4 text-safemeds-teal" />} badge={<span className="text-xs text-muted-foreground">({links.length})</span>}>
      {error && <p className="mb-2 text-sm text-status-error">{error}</p>}
      {notice && <p className="mb-2 text-sm text-status-success">{notice}</p>}
      {lastToken && (
        <div className="mb-3 rounded-lg border border-status-warning bg-status-warning/10 p-3">
          <p className="text-xs font-medium text-status-warning">Token (shown once — copy it now):</p>
          <p className="mt-1 break-all font-mono text-xs text-foreground">{lastToken}</p>
        </div>
      )}
      {canManage && (
        <div className="mb-4 flex gap-2">
          <input value={stakeholderId} onChange={(e) => setStakeholderId(e.target.value)} placeholder="Stakeholder ID" className={inputClass} />
          <button onClick={create} disabled={busy} className={btnPrimary}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create link
          </button>
        </div>
      )}
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : links.length === 0 ? (
        <p className="text-sm text-muted-foreground">No stakeholder has been granted portal access yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {links.map((l) => (
            <li key={l.id} className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-foreground">{l.stakeholder.orgName}</span>
              <span className={l.revoked ? 'text-status-error' : 'text-muted-foreground'}>
                {l.revoked ? 'Revoked' : `Expires ${formatDate(l.expiresAt)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </CollapsibleSection>
  )
}

/** 10.5 — the mass-balance reconciliation view, per country. */
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
