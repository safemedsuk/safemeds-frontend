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
      .catch((err) => setError(getErrorMessage(err, 'Could not load document numbering.')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const year = loaded?.yearOfPreview ?? new Date().getUTCFullYear()

  const validation = useMemo(() => {
    if (!draft) return { ok: false, messages: [] as string[] }
    const messages: string[] = []
    if (!INITIALS_PATTERN.test(draft.companyInitials.trim())) messages.push('Company initials must be 1 to 10 letters or digits.')
    if (new Set(draft.tokenOrder).size !== 4) messages.push('Each segment must appear exactly once in the company order.')
    const seen = new Map<string, string>()
    for (const t of draft.types) {
      if (t.initials.trim() && !INITIALS_PATTERN.test(t.initials.trim())) {
        messages.push(`${t.label}: initials must be 1 to 10 letters or digits.`)
      }
      const effective = (t.initials.trim() || t.defaultInitials).toUpperCase()
      const clash = seen.get(effective)
      if (clash) messages.push(`${t.label} and ${clash} both use "${effective}". Give each type its own initials.`)
      else seen.set(effective, t.label)
      if (t.ownScheme && new Set(t.tokenOrder).size !== 4) {
        messages.push(`${t.label}: its own order must use each segment exactly once.`)
      }
    }
    return { ok: messages.length === 0, messages }
  }, [draft])

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
        types: draft.types.map((t) => ({
          documentType: t.documentType,
          initials: t.initials.trim() ? t.initials.trim().toUpperCase() : null,
          tokenOrder: t.ownScheme ? t.tokenOrder : null,
          separator: t.ownScheme ? t.separator : null,
        })),
      })
      setLoaded(updated)
      setDraft(toDrafts(updated))
      setNotice('Document numbering saved. New documents use this scheme; numbers already issued are unchanged.')
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save document numbering.'))
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
    return <p className="text-sm text-status-error">{error ?? 'Document numbering is unavailable.'}</p>
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        Controlled documents get a number when they are created. The sequence counts up from 0001 each year for each
        document type. Changing the scheme only changes how new numbers look. Numbers already issued are never rewritten,
        and the sequence never resets or skips mid-year.
      </p>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className={labelClass}>Company initials</label>
          <input
            value={draft.companyInitials}
            disabled={!canManage}
            onChange={(e) => setDraft({ ...draft, companyInitials: e.target.value })}
            placeholder="e.g. WHO"
            className={inputClass}
          />
          {loaded?.companyInitialsIsDefault && <p className="mt-1 text-[11px] text-muted-foreground">Currently derived from the company name.</p>}
        </div>
        <div>
          <label className={labelClass}>Separator</label>
          <select value={draft.separator} disabled={!canManage} onChange={(e) => setDraft({ ...draft, separator: e.target.value as NumberingSeparator })} className={inputClass}>
            {NUMBERING_SEPARATORS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Order preset</label>
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
        <label className={labelClass}>Company order (left to right)</label>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {draft.tokenOrder.map((token, slot) => (
            <select
              key={slot}
              value={token}
              disabled={!canManage}
              onChange={(e) => setDraft({ ...draft, tokenOrder: setOrderSlot(draft.tokenOrder, slot, e.target.value as NumberingToken) })}
              className={inputClass}
            >
              {(Object.keys(NUMBERING_TOKEN_LABELS) as NumberingToken[]).map((t) => (
                <option key={t} value={t}>
                  {NUMBERING_TOKEN_LABELS[t]}
                </option>
              ))}
            </select>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Live preview:{' '}
          <span className="font-mono text-foreground">
            {previewNumber(draft.companyInitials, 'SOP', draft.tokenOrder, draft.separator, year)}
          </span>
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="p-3">Document type</th>
              <th className="p-3">Initials</th>
              <th className="p-3">Scheme</th>
              <th className="p-3">Next number</th>
            </tr>
          </thead>
          <tbody>
            {draft.types.map((t, i) => {
              const order = t.ownScheme ? t.tokenOrder : draft.tokenOrder
              const sep = t.ownScheme ? t.separator : draft.separator
              const preview = previewNumber(draft.companyInitials, t.initials.trim() || t.defaultInitials, order, sep, year)
              return (
                <tr key={t.documentType} className="border-b border-border last:border-0 align-top">
                  <td className="p-3 text-foreground">{t.label}</td>
                  <td className="p-3">
                    <input
                      value={t.initials}
                      disabled={!canManage}
                      placeholder="default"
                      onChange={(e) => updateType(i, { initials: e.target.value })}
                      className={`${inputClass} w-28 uppercase`}
                    />
                  </td>
                  <td className="p-3">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={t.ownScheme}
                        disabled={!canManage}
                        onChange={(e) => updateType(i, { ownScheme: e.target.checked })}
                      />
                      Own scheme
                    </label>
                    {t.ownScheme && (
                      <div className="mt-2 space-y-2">
                        <div className="grid grid-cols-2 gap-1">
                          {t.tokenOrder.map((token, slot) => (
                            <select
                              key={slot}
                              value={token}
                              disabled={!canManage}
                              onChange={(e) => updateType(i, { tokenOrder: setOrderSlot(t.tokenOrder, slot, e.target.value as NumberingToken) })}
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
                        <select value={t.separator} disabled={!canManage} onChange={(e) => updateType(i, { separator: e.target.value as NumberingSeparator })} className={`${inputClass} text-xs`}>
                          {NUMBERING_SEPARATORS.map((s) => (
                            <option key={s} value={s}>
                              Separator {s}
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
            <Hash className="h-3.5 w-3.5" /> {dirty ? 'Unsaved changes' : 'Saved'}
          </span>
          <button
            onClick={() => loaded && setDraft(toDrafts(loaded))}
            disabled={!dirty || saving}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || !validation.ok || saving}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save numbering
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Only company administrators can change document numbering.</p>
      )}
    </div>
  )
}
