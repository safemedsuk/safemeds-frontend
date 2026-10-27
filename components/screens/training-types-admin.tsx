'use client'

import { useEffect, useState } from 'react'
import { GraduationCap, Info, Loader2, Pencil, Plus, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { getAllCountries, type Country } from '@/lib/api/countries'
import { createTrainingType, listTrainingTypes, updateTrainingType, type TrainingType } from '@/lib/api/training-types'
import { Modal } from '@/components/ui/modal'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTranslation } from '@/lib/i18n/use-translation'

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
  const { t } = useTranslation()
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
      .catch((err) => setError(getErrorMessage(err, t('trainingTypesAdmin.errorLoadCountries'))))
  }, [canManage, t])

  const load = (scopeValue: string) => {
    setLoading(true)
    setError(null)
    const countryId = scopeValue === GENERIC_OPTION_VALUE ? undefined : scopeValue
    listTrainingTypes({ countryId, includeInactive: true })
      .then((rows) => setTypes(rows.slice().sort((a, b) => a.sortOrder - b.sortOrder)))
      .catch((err) => setError(getErrorMessage(err, t('trainingTypesAdmin.errorLoadTypes'))))
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
        <h1 className="text-3xl font-display font-bold text-foreground">{t('trainingTypesAdmin.title')}</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{t('trainingTypesAdmin.noPermission')}</p>
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
            <h1 className="text-3xl font-display font-bold text-foreground">{t('trainingTypesAdmin.title')}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t('trainingTypesAdmin.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce"
        >
          <Plus className="h-4 w-4" /> {t('trainingTypesAdmin.addTrainingType')}
        </button>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 p-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-info" />
        <p>
          <strong className="text-foreground">{t('trainingTypesAdmin.infoWhatThisIs')}</strong> {t('trainingTypesAdmin.infoBody')}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <label className={labelClass}>{t('trainingTypesAdmin.scope')}</label>
        <select value={scope} onChange={(e) => setScope(e.target.value)} className={`${inputClass} max-w-sm`}>
          <option value={GENERIC_OPTION_VALUE}>{t('trainingTypesAdmin.genericAllMarkets')}</option>
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
            <p className="text-sm text-muted-foreground">{t('trainingTypesAdmin.noGenericTypes')}</p>
          </div>
        ) : scope !== GENERIC_OPTION_VALUE && scopedTypes.length === 0 ? (
          <div className="p-12 text-center">
            <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{t('trainingTypesAdmin.noScopedTypes')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">{t('trainingTypesAdmin.columnNumber')}</th>
                <th className="p-3">{t('trainingTypesAdmin.columnKey')}</th>
                <th className="p-3">{t('trainingTypesAdmin.columnLabel')}</th>
                <th className="p-3">{t('trainingTypesAdmin.columnScope')}</th>
                <th className="p-3">{t('trainingTypesAdmin.columnActive')}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {(scope === GENERIC_OPTION_VALUE ? genericTypes : scopedTypes).map((row) => (
                <tr key={row.id} className={`border-b border-border last:border-0 ${!row.active ? 'opacity-50' : ''}`}>
                  <td className="p-3 text-muted-foreground">{row.sortOrder}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{row.typeKey}</td>
                  <td className="p-3 text-foreground font-medium">{row.label}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${row.countryId ? 'bg-safemeds-teal/10 text-safemeds-teal' : 'bg-muted text-muted-foreground'}`}>
                      {row.countryId ? t('trainingTypesAdmin.countryScoped') : t('trainingTypesAdmin.generic')}
                    </span>
                  </td>
                  <td className="p-3 text-foreground">{row.active ? t('trainingTypesAdmin.active') : t('trainingTypesAdmin.inactive')}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => setEditing(row)} className="flex items-center gap-1 text-xs font-medium text-safemeds-teal hover:underline">
                      <Pencil className="h-3 w-3" /> {t('trainingTypesAdmin.edit')}
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
  const { t } = useTranslation()
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
      setError(getErrorMessage(err, t('trainingTypesAdmin.errorSave')))
      setBusy(false)
    }
  }

  return (
    <Modal title={t('trainingTypesAdmin.editModalTitle')} onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}

        <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
          <span className="font-mono">{type.typeKey}</span>{' '}
          {t('trainingTypesAdmin.neverEditableNote', { scope: type.countryId ? t('trainingTypesAdmin.countryScoped') : t('trainingTypesAdmin.generic') })}
        </div>

        <div>
          <label className={labelClass}>{t('trainingTypesAdmin.label')}</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t('trainingTypesAdmin.sortOrder')}</label>
            <input type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className={inputClass} />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded border-input" />
              {t('trainingTypesAdmin.active')}
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('pvCaseDetail.saveChanges')}
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
  const { t } = useTranslation()
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
      setError(getErrorMessage(err, t('trainingTypesAdmin.errorCreate')))
      setBusy(false)
    }
  }

  return (
    <Modal title={t('trainingTypesAdmin.createModalTitle')} onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}

        <div>
          <label className={labelClass}>{t('trainingTypesAdmin.scope')}</label>
          <select value={countryId} onChange={(e) => setCountryId(e.target.value)} className={inputClass}>
            <option value="">{t('trainingTypesAdmin.genericAllMarkets')}</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t('trainingTypesAdmin.key')}</label>
          <input value={typeKey} onChange={(e) => setTypeKey(e.target.value)} placeholder={t('trainingTypesAdmin.keyPlaceholder')} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t('trainingTypesAdmin.label')}</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('trainingTypesAdmin.labelPlaceholder')} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t('trainingTypesAdmin.sortOrder')}</label>
          <input type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className={inputClass} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleCreate}
            disabled={!isValid || busy}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('trainingTypesAdmin.createTrainingType')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
