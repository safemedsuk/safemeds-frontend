'use client'

import { useEffect, useState } from 'react'
import { GraduationCap, Info, Loader2, Pencil, Plus, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { getAllCountries, type Country } from '@/lib/api/countries'
import { createTrainingType, listTrainingTypes, updateTrainingType, type TrainingType } from '@/lib/api/training-types'
import { Modal } from '@/components/ui/modal'
import { usePermissions } from '@/lib/hooks/use-permissions'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const GENERIC_OPTION_VALUE = '__generic__'

/**
 * Special Corner SC-8 (Admin Configuration Console — training-type
 * catalog, todo-vigicloud.md 16.6-A) — "PPB Academy" only makes sense
 * for a Kenya-market company; this replaces the training screen's old
 * hardcoded 4-option dropdown with a real, per-country-configurable
 * catalog. Mirrors `AuditChecklistAdmin`'s own shape (Gap 3) closely:
 * pick a scope, see its rows, edit modal, add-new modal.
 */
export function TrainingTypesAdmin() {
  const { has } = usePermissions()
  const canManage = has('platform.config.manage')

  const [countries, setCountries] = useState<Country[]>([])
  const [scope, setScope] = useState<string>(GENERIC_OPTION_VALUE)
  const [types, setTypes] = useState<TrainingType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<TrainingType | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    if (!canManage) return
    getAllCountries()
      .then((rows) => setCountries(rows.sort((a, b) => a.name.localeCompare(b.name))))
      .catch((err) => setError(getErrorMessage(err, 'Could not load countries.')))
  }, [canManage])

  const load = (scopeValue: string) => {
    setLoading(true)
    setError(null)
    const countryId = scopeValue === GENERIC_OPTION_VALUE ? undefined : scopeValue
    listTrainingTypes({ countryId, includeInactive: true })
      .then((rows) => setTypes(rows.slice().sort((a, b) => a.sortOrder - b.sortOrder)))
      .catch((err) => setError(getErrorMessage(err, 'Could not load training types.')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!canManage) return
    load(scope)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, canManage])

  if (!canManage) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">Training Types</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to manage the training-type catalog.</p>
        </div>
      </div>
    )
  }

  const genericTypes = types.filter((t) => t.countryId === null)
  const scopedTypes = types.filter((t) => t.countryId !== null)

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <GraduationCap className="h-6 w-6 text-safemeds-teal" />
            <h1 className="text-3xl font-display font-bold text-foreground">Training Types</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">The catalog every tenant&apos;s Training screen picks a type from — scoped per market where it matters.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce"
        >
          <Plus className="h-4 w-4" /> Add Training Type
        </button>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 p-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-info" />
        <p>
          <strong className="text-foreground">What this is:</strong> a <em>generic</em> type (no country) is available to every tenant,
          everywhere — e.g. &quot;Internal&quot;/&quot;Other&quot;. A <em>country-scoped</em> type (e.g. Kenya&apos;s &quot;PPB
          Academy&quot;) only appears for tenants whose home market matches. Every tenant always sees the generic list plus their own
          market&apos;s scoped list.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <label className={labelClass}>Scope</label>
        <select value={scope} onChange={(e) => setScope(e.target.value)} className={`${inputClass} max-w-sm`}>
          <option value={GENERIC_OPTION_VALUE}>Generic (all markets)</option>
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : scope === GENERIC_OPTION_VALUE && genericTypes.length === 0 ? (
          <div className="p-12 text-center">
            <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No generic training types yet.</p>
          </div>
        ) : scope !== GENERIC_OPTION_VALUE && scopedTypes.length === 0 ? (
          <div className="p-12 text-center">
            <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No training types scoped to this market yet — it still inherits the generic list above.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">#</th>
                <th className="p-3">Key</th>
                <th className="p-3">Label</th>
                <th className="p-3">Scope</th>
                <th className="p-3">Active</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {(scope === GENERIC_OPTION_VALUE ? genericTypes : scopedTypes).map((t) => (
                <tr key={t.id} className={`border-b border-border last:border-0 ${!t.active ? 'opacity-50' : ''}`}>
                  <td className="p-3 text-muted-foreground">{t.sortOrder}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{t.typeKey}</td>
                  <td className="p-3 text-foreground font-medium">{t.label}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${t.countryId ? 'bg-safemeds-teal/10 text-safemeds-teal' : 'bg-muted text-muted-foreground'}`}>
                      {t.countryId ? 'Country-scoped' : 'Generic'}
                    </span>
                  </td>
                  <td className="p-3 text-foreground">{t.active ? 'Active' : 'Inactive'}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => setEditing(t)} className="flex items-center gap-1 text-xs font-medium text-safemeds-teal hover:underline">
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <TrainingTypeEditModal
          type={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load(scope)
          }}
        />
      )}

      {showCreate && (
        <TrainingTypeCreateModal
          countries={countries}
          defaultCountryId={scope === GENERIC_OPTION_VALUE ? '' : scope}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            load(scope)
          }}
        />
      )}
    </div>
  )
}

function TrainingTypeEditModal({ type, onClose, onSaved }: { type: TrainingType; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState(type.label)
  const [sortOrder, setSortOrder] = useState(type.sortOrder)
  const [active, setActive] = useState(type.active)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setBusy(true)
    setError(null)
    try {
      await updateTrainingType(type.id, { label: label.trim(), sortOrder, active })
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save this training type.'))
      setBusy(false)
    }
  }

  return (
    <Modal title="Edit Training Type" onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}

        <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
          <span className="font-mono">{type.typeKey}</span> — {type.countryId ? 'country-scoped' : 'generic'}, never editable here.
        </div>

        <div>
          <label className={labelClass}>Label</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Sort order</label>
            <input type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className={inputClass} />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded border-input" />
              Active
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </button>
        </div>
      </div>
    </Modal>
  )
}

function TrainingTypeCreateModal({
  countries,
  defaultCountryId,
  onClose,
  onCreated,
}: {
  countries: Country[]
  defaultCountryId: string
  onClose: () => void
  onCreated: () => void
}) {
  const [countryId, setCountryId] = useState(defaultCountryId)
  const [typeKey, setTypeKey] = useState('')
  const [label, setLabel] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = typeKey.trim().length > 0 && label.trim().length > 0

  const handleCreate = async () => {
    if (!isValid) return
    setBusy(true)
    setError(null)
    try {
      await createTrainingType({ countryId: countryId || undefined, typeKey: typeKey.trim(), label: label.trim(), sortOrder })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this training type.'))
      setBusy(false)
    }
  }

  return (
    <Modal title="Add a New Training Type" onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}

        <div>
          <label className={labelClass}>Scope</label>
          <select value={countryId} onChange={(e) => setCountryId(e.target.value)} className={inputClass}>
            <option value="">Generic (all markets)</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Key</label>
          <input value={typeKey} onChange={(e) => setTypeKey(e.target.value)} placeholder="e.g. ppb_academy" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Label</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. PPB Academy" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Sort order</label>
          <input type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className={inputClass} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!isValid || busy}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Create training type
          </button>
        </div>
      </div>
    </Modal>
  )
}
