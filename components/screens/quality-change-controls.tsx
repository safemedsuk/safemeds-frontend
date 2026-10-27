'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GitCommit, Info, Loader2, Plus, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  CHANGE_CONTROL_SCOPES,
  CHANGE_CONTROL_TYPE_LABELS,
  CHANGE_CONTROL_TYPES,
  ChangeControl,
  createChangeControl,
  listChangeControls,
} from '@/lib/api/change-controls'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const STATUS_LABEL_KEYS: Record<string, MessageKey> = {
  proposed: 'qualityChangeControls.statusProposed',
  impact_assessment: 'qualityChangeControls.statusImpactAssessment',
  approved: 'qualityChangeControls.statusApproved',
  implementing: 'qualityChangeControls.statusImplementing',
  verifying: 'qualityChangeControls.statusVerifying',
  closed: 'qualityChangeControls.statusClosed',
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

/**
 * QualCloud (Phase 13) Stage 4 — the Change Control register: Proposed →
 * Impact Assessment → Approved (cross-functional sign-off) → Implementing
 * → Verifying → Closed, with a real cross-module link into a RegCloud
 * `RegVariation` once a regulatory impact is flagged.
 */
export function QualityChangeControlsScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canViewAll = has('quality.view_all')
  const canLog = has('quality.log_deviation')

  const [changeControls, setChangeControls] = useState<ChangeControl[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showCreate, setShowCreate] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listChangeControls({ page: 1, limit: 50, status: statusFilter || undefined })
      .then((res) => setChangeControls(res.rows))
      .catch((err) => setError(getErrorMessage(err, t('qualityChangeControls.errorLoad'))))
      .finally(() => setLoading(false))
  }, [statusFilter, t])

  useEffect(load, [load])

  if (!canViewAll) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">{t('qualityChangeControls.title')}</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{t('qualityChangeControls.noPermission')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">{t('qualityChangeControls.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('qualityChangeControls.subtitle')}</p>
        </div>
        {canLog && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors">
            <Plus className="h-4 w-4" /> {t('qualityChangeControls.proposeChange')}
          </button>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 p-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-info" />
        <p>{t('qualityChangeControls.infoChangeType')}</p>
      </div>

      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputClass} w-auto`}>
        <option value="">{t('qualityChangeControls.allStatuses')}</option>
        {Object.entries(STATUS_LABEL_KEYS).map(([key, labelKey]) => (
          <option key={key} value={key}>{t(labelKey)}</option>
        ))}
      </select>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : changeControls.length === 0 ? (
          <div className="p-12 text-center">
            <GitCommit className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{t('qualityChangeControls.noChangeControlsYet')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">{t('qualityChangeControls.columnChangeNumber')}</th>
                <th className="p-3">{t('qualityChangeControls.columnTitle')}</th>
                <th className="p-3">{t('qualityChangeControls.columnType')}</th>
                <th className="p-3">{t('qualityChangeControls.columnScope')}</th>
                <th className="p-3">{t('qualityChangeControls.columnCreated')}</th>
                <th className="p-3">{t('qualityChangeControls.columnStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {changeControls.map((c) => (
                <tr key={c.id} onClick={() => router.push(`/quality-change-controls/${c.id}`)} className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50">
                  <td className="p-3 text-foreground font-mono text-xs">{c.changeNumber}</td>
                  <td className="p-3 text-foreground font-medium">{c.title}</td>
                  <td className="p-3 text-muted-foreground text-xs capitalize">{c.changeType.replace(/_/g, ' ')}</td>
                  <td className="p-3 text-muted-foreground text-xs capitalize">{c.scope}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(c.createdAt)}</td>
                  <td className="p-3">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">{STATUS_LABEL_KEYS[c.status] ? t(STATUS_LABEL_KEYS[c.status]) : c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateChangeControlModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false)
            setNotice(t('qualityChangeControls.proposedNotice'))
            load()
            router.push(`/quality-change-controls/${id}`)
          }}
        />
      )}
    </div>
  )
}

function CreateChangeControlModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [changeType, setChangeType] = useState<string>('minor')
  const [scope, setScope] = useState<string>('process')
  const [changeDescription, setChangeDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = title.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      const created = await createChangeControl({
        title: title.trim(),
        changeType,
        scope,
        changeDescription: changeDescription.trim() || undefined,
      })
      onCreated(created.id)
    } catch (err) {
      setError(getErrorMessage(err, t('qualityChangeControls.errorCreate')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 space-y-4 my-8">
        <h2 className="font-display font-bold text-lg text-foreground">{t('qualityChangeControls.proposeAChangeTitle')}</h2>

        <div>
          <label className={labelClass}>{t('qualityChangeControls.titleField')}</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('qualityChangeControls.titlePlaceholder')} className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t('qualityChangeControls.changeType')}</label>
            <select value={changeType} onChange={(e) => setChangeType(e.target.value)} className={inputClass}>
              {CHANGE_CONTROL_TYPES.map((ty) => (
                <option key={ty} value={ty}>{CHANGE_CONTROL_TYPE_LABELS[ty]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t('qualityChangeControls.scope')}</label>
            <select value={scope} onChange={(e) => setScope(e.target.value)} className={inputClass}>
              {CHANGE_CONTROL_SCOPES.map((s) => (
                <option key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>{t('qualityChangeControls.changeDescription')}</label>
          <textarea value={changeDescription} onChange={(e) => setChangeDescription(e.target.value)} rows={3} className={inputClass} placeholder={t('qualityChangeControls.changeDescriptionPlaceholder')} />
        </div>

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('qualityChangeControls.propose')}
          </button>
        </div>
      </div>
    </div>
  )
}
