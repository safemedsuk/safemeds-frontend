'use client'

import { useEffect, useState } from 'react'
import {
  AssignableUser,
  CapaAllocationInput,
  listCapaOwners,
  listRegulatoryApprovers,
  listRootCauseCategories,
  RootCauseCategory,
} from '@/lib/api/capa-allocation'
import { useTranslation } from '@/lib/i18n/use-translation'

export const capaInputClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
export const capaLabelClass = 'block text-xs font-medium text-muted-foreground mb-1'

/** The editable state of one CAPA allocation form — a superset of the wire input, with the optional-parts toggles. */
export interface CapaAllocationDraft {
  rootCause: string
  rootCauseCategory: string
  rootCauseOther: string
  correctiveAction: string
  ownerUserId: string
  correctiveActionDueDate: string
  preventiveAction: string
  preventiveActionDueDate: string
  requiresRegulatoryApproval: boolean
  regulatoryApproverUserId: string
}

export const EMPTY_CAPA_DRAFT: CapaAllocationDraft = {
  rootCause: '',
  rootCauseCategory: '',
  rootCauseOther: '',
  correctiveAction: '',
  ownerUserId: '',
  correctiveActionDueDate: '',
  preventiveAction: '',
  preventiveActionDueDate: '',
  requiresRegulatoryApproval: false,
  regulatoryApproverUserId: '',
}

/** Mirrors the backend's `normalizeAllocation()` rules, so the Open button is only enabled for input the server will accept. */
export function isCapaDraftValid(d: CapaAllocationDraft): boolean {
  if (d.rootCause.trim().length === 0) return false
  if (d.rootCauseCategory === '') return false
  if (d.rootCauseCategory === 'other' && d.rootCauseOther.trim().length === 0) return false
  if (d.correctiveAction.trim().length === 0) return false
  if (d.ownerUserId === '') return false
  if (d.correctiveActionDueDate === '') return false
  if (d.preventiveAction.trim().length > 0 && d.preventiveActionDueDate === '') return false
  if (d.requiresRegulatoryApproval && d.regulatoryApproverUserId === '') return false
  return true
}

export function draftToAllocationInput(d: CapaAllocationDraft): CapaAllocationInput {
  const preventive = d.preventiveAction.trim()
  return {
    rootCause: d.rootCause.trim(),
    rootCauseCategory: d.rootCauseCategory,
    rootCauseOther: d.rootCauseCategory === 'other' ? d.rootCauseOther.trim() : undefined,
    correctiveAction: d.correctiveAction.trim(),
    preventiveAction: preventive || undefined,
    ownerUserId: d.ownerUserId,
    correctiveActionDueDate: d.correctiveActionDueDate,
    preventiveActionDueDate: preventive ? d.preventiveActionDueDate : undefined,
    requiresRegulatoryApproval: d.requiresRegulatoryApproval || undefined,
    regulatoryApproverUserId: d.requiresRegulatoryApproval ? d.regulatoryApproverUserId : undefined,
  }
}

interface Props {
  value: CapaAllocationDraft
  onChange: (next: CapaAllocationDraft) => void
  /** Shown when a CAPA is opened from a specific record (deviation, OOS, complaint, finding). */
  contextNote?: string
}

/**
 * Pass A2 — the single CAPA allocation form every CAPA opener renders:
 * root cause (free text) + curated category (or typed "other"), corrective
 * action with an allocated owner and due date, an optional preventive action
 * with its own due date, and an optional regulatory approver chosen from the
 * people who actually hold the regulatory-approval permission.
 */
export function CapaAllocationFields({ value, onChange, contextNote }: Props) {
  const { t } = useTranslation()
  const [categories, setCategories] = useState<RootCauseCategory[]>([])
  const [owners, setOwners] = useState<AssignableUser[]>([])
  const [approvers, setApprovers] = useState<AssignableUser[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([listRootCauseCategories(), listCapaOwners(), listRegulatoryApprovers()])
      .then(([c, o, a]) => {
        if (cancelled) return
        setCategories(c)
        setOwners(o)
        setApprovers(a)
      })
      .catch(() => {
        if (!cancelled) setLoadError(t('capaAllocationFields.errorLoad'))
      })
    return () => {
      cancelled = true
    }
  }, [t])

  const set = <K extends keyof CapaAllocationDraft>(key: K, v: CapaAllocationDraft[K]) =>
    onChange({ ...value, [key]: v })

  return (
    <div className="space-y-4">
      {contextNote && (
        <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2">{contextNote}</p>
      )}
      {loadError && <p className="text-sm text-status-error">{loadError}</p>}

      <div>
        <label className={capaLabelClass}>{t('capaAllocationFields.rootCause')}</label>
        <textarea
          value={value.rootCause}
          onChange={(e) => set('rootCause', e.target.value)}
          rows={2}
          placeholder={t('capaAllocationFields.rootCausePlaceholder')}
          className={capaInputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={capaLabelClass}>{t('capaAllocationFields.rootCauseCategory')}</label>
          <select
            value={value.rootCauseCategory}
            onChange={(e) => set('rootCauseCategory', e.target.value)}
            className={capaInputClass}
          >
            <option value="">{t('capaAllocationFields.chooseCategory')}</option>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        {value.rootCauseCategory === 'other' && (
          <div>
            <label className={capaLabelClass}>{t('capaAllocationFields.typeCategory')}</label>
            <input
              value={value.rootCauseOther}
              onChange={(e) => set('rootCauseOther', e.target.value)}
              className={capaInputClass}
            />
          </div>
        )}
      </div>

      <div>
        <label className={capaLabelClass}>{t('capaAllocationFields.correctiveAction')}</label>
        <textarea
          value={value.correctiveAction}
          onChange={(e) => set('correctiveAction', e.target.value)}
          rows={2}
          className={capaInputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={capaLabelClass}>{t('capaAllocationFields.owner')}</label>
          <select value={value.ownerUserId} onChange={(e) => set('ownerUserId', e.target.value)} className={capaInputClass}>
            <option value="">{t('capaAllocationFields.chooseOwner')}</option>
            {owners.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
          {owners.length === 0 && (
            <p className="mt-1 text-xs text-status-error">{t('capaAllocationFields.noOwnersError')}</p>
          )}
        </div>
        <div>
          <label className={capaLabelClass}>{t('capaAllocationFields.correctiveActionDueDate')}</label>
          <input
            type="date"
            value={value.correctiveActionDueDate}
            onChange={(e) => set('correctiveActionDueDate', e.target.value)}
            className={capaInputClass}
          />
        </div>
      </div>

      <div>
        <label className={capaLabelClass}>{t('capaAllocationFields.preventiveAction')}</label>
        <textarea
          value={value.preventiveAction}
          onChange={(e) => set('preventiveAction', e.target.value)}
          rows={2}
          className={capaInputClass}
        />
      </div>
      {value.preventiveAction.trim().length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={capaLabelClass}>{t('capaAllocationFields.preventiveActionDueDate')}</label>
            <input
              type="date"
              value={value.preventiveActionDueDate}
              onChange={(e) => set('preventiveActionDueDate', e.target.value)}
              className={capaInputClass}
            />
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border p-3 space-y-3">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={value.requiresRegulatoryApproval}
            onChange={(e) => set('requiresRegulatoryApproval', e.target.checked)}
          />
          {t('capaAllocationFields.needsRegulatoryApproval')}
        </label>
        {value.requiresRegulatoryApproval && (
          <div>
            <label className={capaLabelClass}>{t('capaAllocationFields.regulatoryApprover')}</label>
            <select
              value={value.regulatoryApproverUserId}
              onChange={(e) => set('regulatoryApproverUserId', e.target.value)}
              className={capaInputClass}
            >
              <option value="">{t('capaAllocationFields.chooseApprover')}</option>
              {approvers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </select>
            {approvers.length === 0 && (
              <p className="mt-1 text-xs text-status-error">{t('capaAllocationFields.noApproversError')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
