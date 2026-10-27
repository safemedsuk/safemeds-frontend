'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Hash, Loader2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  DocumentNumberingConfig,
  NumberingSeparator,
  NumberingToken,
  NUMBERING_SEPARATORS,
  NUMBERING_TOKEN_LABELS,
  getDocumentNumbering,
  previewNumber,
  saveDocumentNumbering,
} from '@/lib/api/document-numbering'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { useTranslation } from '@/lib/i18n/use-translation'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const PRESETS: { label: string; order: NumberingToken[] }[] = [
  { label: 'COMPANY-TYPE-YYYY-0001', order: ['company', 'type', 'year', 'sequence'] },
  { label: 'YYYY-0001-TYPE-COMPANY', order: ['year', 'sequence', 'type', 'company'] },
]

const INITIALS_PATTERN = /^[A-Za-z0-9]{1,10}$/

interface TypeDraft {
  documentType: string
  label: string
  /** The initials the server derives when the field is left blank. */
  defaultInitials: string
  initials: string
  ownScheme: boolean
  tokenOrder: NumberingToken[]
  separator: NumberingSeparator
}

function toDrafts(config: DocumentNumberingConfig): { companyInitials: string; tokenOrder: NumberingToken[]; separator: NumberingSeparator; types: TypeDraft[] } {
  return {
    companyInitials: config.companyInitials,
    tokenOrder: config.tokenOrder,
    separator: config.separator,
    types: config.types.map((t) => ({
      documentType: t.documentType,
      label: t.label,
      defaultInitials: t.initials,
      initials: t.initialsIsDefault ? '' : t.initials,
      ownScheme: t.ownScheme,
      tokenOrder: t.tokenOrder,
      separator: t.separator,
    })),
  }
}

/**
 * Phase 2 Pass C — per-company document numbering. The company chooses its
 * initials, the order of the four segments, the separator, and per document
 * type either its own initials + scheme or the company default. Every number
 * shown is a live preview; the backend re-validates and audits every save.
 */
export function DocumentNumberingSettings() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canManage = has('company_profile.manage')

  const [loaded, setLoaded] = useState<DocumentNumberingConfig | null>(null)
  const [draft, setDraft] = useState<ReturnType<typeof toDrafts> | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()

  const load = useCallback(() => {
    setLoading(true)
    getDocumentNumbering()
      .then((config) => {
        setLoaded(config)
        setDraft(toDrafts(config))
        setError(null)
      })
      .catch((err) => setError(getErrorMessage(err, t('docNumbering.errorLoad'))))
      .finally(() => setLoading(false))
  }, [t])

  useEffect(load, [load])

  const year = loaded?.yearOfPreview ?? new Date().getUTCFullYear()

  const validation = useMemo(() => {
    if (!draft) return { ok: false, messages: [] as string[] }
    const messages: string[] = []
    if (!INITIALS_PATTERN.test(draft.companyInitials.trim())) messages.push(t('docNumbering.errorInitialsFormat'))
    if (new Set(draft.tokenOrder).size !== 4) messages.push(t('docNumbering.errorEachSegmentOnce'))
    const seen = new Map<string, string>()
    for (const ty of draft.types) {
      if (ty.initials.trim() && !INITIALS_PATTERN.test(ty.initials.trim())) {
        messages.push(t('docNumbering.errorTypeInitialsFormat', { label: ty.label }))
      }
      const effective = (ty.initials.trim() || ty.defaultInitials).toUpperCase()
      const clash = seen.get(effective)
      if (clash) messages.push(t('docNumbering.errorInitialsClash', { label: ty.label, other: clash, initials: effective }))
      else seen.set(effective, ty.label)
      if (ty.ownScheme && new Set(ty.tokenOrder).size !== 4) {
        messages.push(t('docNumbering.errorOwnSchemeOrder', { label: ty.label }))
      }
    }
    return { ok: messages.length === 0, messages }
  }, [draft, t])

  const dirty = useMemo(() => {
    if (!draft || !loaded) return false
    return JSON.stringify(draft) !== JSON.stringify(toDrafts(loaded))
  }, [draft, loaded])

  const updateType = (index: number, patch: Partial<TypeDraft>) =>
    setDraft((prev) => (prev ? { ...prev, types: prev.types.map((t, i) => (i === index ? { ...t, ...patch } : t)) } : prev))

  const setOrderSlot = (list: NumberingToken[], slot: number, value: NumberingToken): NumberingToken[] => {
    const next = [...list]
    next[slot] = value
    return next
  }

  const handleSave = async () => {
    if (!draft || !validation.ok) return
    setSaving(true)
    setError(null)
    try {
      const updated = await saveDocumentNumbering({
        companyInitials: draft.companyInitials.trim().toUpperCase(),
        tokenOrder: draft.tokenOrder,
        separator: draft.separator,
        types: draft.types.map((ty) => ({
          documentType: ty.documentType,
          initials: ty.initials.trim() ? ty.initials.trim().toUpperCase() : null,
          tokenOrder: ty.ownScheme ? ty.tokenOrder : null,
          separator: ty.ownScheme ? ty.separator : null,
        })),
      })
      setLoaded(updated)
      setDraft(toDrafts(updated))
      setNotice(t('docNumbering.savedNotice'))
    } catch (err) {
      setError(getErrorMessage(err, t('docNumbering.errorSave')))
    } finally {
      setSaving(false)
    }
  }

  if (loading && !draft) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!draft) {
    return <p className="text-sm text-status-error">{error ?? t('docNumbering.unavailable')}</p>
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        {t('docNumbering.intro')}
      </p>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className={labelClass}>{t('docNumbering.companyInitials')}</label>
          <input
            value={draft.companyInitials}
            disabled={!canManage}
            onChange={(e) => setDraft({ ...draft, companyInitials: e.target.value })}
            placeholder={t('docNumbering.initialsPlaceholder')}
            className={inputClass}
          />
          {loaded?.companyInitialsIsDefault && <p className="mt-1 text-[11px] text-muted-foreground">{t('docNumbering.currentlyDerived')}</p>}
        </div>
        <div>
          <label className={labelClass}>{t('docNumbering.separator')}</label>
          <select value={draft.separator} disabled={!canManage} onChange={(e) => setDraft({ ...draft, separator: e.target.value as NumberingSeparator })} className={inputClass}>
            {NUMBERING_SEPARATORS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t('docNumbering.orderPreset')}</label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                disabled={!canManage}
                onClick={() => setDraft({ ...draft, tokenOrder: p.order })}
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-50"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className={labelClass}>{t('docNumbering.companyOrder')}</label>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {draft.tokenOrder.map((token, slot) => (
            <select
              key={slot}
              value={token}
              disabled={!canManage}
              onChange={(e) => setDraft({ ...draft, tokenOrder: setOrderSlot(draft.tokenOrder, slot, e.target.value as NumberingToken) })}
              className={inputClass}
            >
              {(Object.keys(NUMBERING_TOKEN_LABELS) as NumberingToken[]).map((tk) => (
                <option key={tk} value={tk}>
                  {NUMBERING_TOKEN_LABELS[tk]}
                </option>
              ))}
            </select>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t('docNumbering.livePreview')}{' '}
          <span className="font-mono text-foreground">
            {previewNumber(draft.companyInitials, 'SOP', draft.tokenOrder, draft.separator, year)}
          </span>
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="p-3">{t('docNumbering.columnDocType')}</th>
              <th className="p-3">{t('docNumbering.columnInitials')}</th>
              <th className="p-3">{t('docNumbering.columnScheme')}</th>
              <th className="p-3">{t('docNumbering.columnNextNumber')}</th>
            </tr>
          </thead>
          <tbody>
            {draft.types.map((ty, i) => {
              const order = ty.ownScheme ? ty.tokenOrder : draft.tokenOrder
              const sep = ty.ownScheme ? ty.separator : draft.separator
              const preview = previewNumber(draft.companyInitials, ty.initials.trim() || ty.defaultInitials, order, sep, year)
              return (
                <tr key={ty.documentType} className="border-b border-border last:border-0 align-top">
                  <td className="p-3 text-foreground">{ty.label}</td>
                  <td className="p-3">
                    <input
                      value={ty.initials}
                      disabled={!canManage}
                      placeholder={t('docNumbering.defaultPlaceholder')}
                      onChange={(e) => updateType(i, { initials: e.target.value })}
                      className={`${inputClass} w-28 uppercase`}
                    />
                  </td>
                  <td className="p-3">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={ty.ownScheme}
                        disabled={!canManage}
                        onChange={(e) => updateType(i, { ownScheme: e.target.checked })}
                      />
                      {t('docNumbering.ownScheme')}
                    </label>
                    {ty.ownScheme && (
                      <div className="mt-2 space-y-2">
                        <div className="grid grid-cols-2 gap-1">
                          {ty.tokenOrder.map((token, slot) => (
                            <select
                              key={slot}
                              value={token}
                              disabled={!canManage}
                              onChange={(e) => updateType(i, { tokenOrder: setOrderSlot(ty.tokenOrder, slot, e.target.value as NumberingToken) })}
                              className={`${inputClass} text-xs`}
                            >
                              {(Object.keys(NUMBERING_TOKEN_LABELS) as NumberingToken[]).map((k) => (
                                <option key={k} value={k}>
                                  {NUMBERING_TOKEN_LABELS[k]}
                                </option>
                              ))}
                            </select>
                          ))}
                        </div>
                        <select value={ty.separator} disabled={!canManage} onChange={(e) => updateType(i, { separator: e.target.value as NumberingSeparator })} className={`${inputClass} text-xs`}>
                          {NUMBERING_SEPARATORS.map((s) => (
                            <option key={s} value={s}>
                              {t('docNumbering.separatorOption', { sep: s })}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </td>
                  <td className="p-3 font-mono text-xs text-foreground">{preview}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {validation.messages.length > 0 && (
        <ul className="space-y-1 text-xs text-status-error">
          {validation.messages.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}

      {canManage ? (
        <div className="flex items-center justify-end gap-3">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Hash className="h-3.5 w-3.5" /> {dirty ? t('docNumbering.unsavedChanges') : t('docNumbering.saved')}
          </span>
          <button
            onClick={() => loaded && setDraft(toDrafts(loaded))}
            disabled={!dirty || saving}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {t('docNumbering.discard')}
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || !validation.ok || saving}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('docNumbering.saveNumbering')}
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t('docNumbering.adminOnlyNote')}</p>
      )}
    </div>
  )
}
