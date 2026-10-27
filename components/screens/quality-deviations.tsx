'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertOctagon, Info, Loader2, Plus, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  createDeviation,
  DEVIATION_SOURCE_TYPE_LABELS,
  DEVIATION_SOURCE_TYPES,
  Deviation,
  DeviationSeverity,
  listDeviations,
} from '@/lib/api/deviations'
import { listEquipment } from '@/lib/api/quality'
import { listProducts } from '@/lib/api/master-data'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const SEVERITY_STYLES: Record<DeviationSeverity, string> = {
  critical: 'bg-status-error/10 text-status-error',
  major: 'bg-status-warning/10 text-status-warning',
  minor: 'bg-status-info/10 text-status-info',
}

const STATUS_LABEL_KEYS: Record<string, MessageKey> = {
  detected: 'qualityDeviations.statusDetected',
  classifying: 'qualityDeviations.statusClassifying',
  investigating: 'qualityDeviations.statusInvestigating',
  capa_pending: 'qualityDeviations.statusCapaPending',
  closed: 'qualityDeviations.statusClosed',
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

/**
 * QualCloud (Phase 13) Stage 2 — the deviation/non-conformance register:
 * master quality-event lifecycle stages 1-4 (Detect/Raise → Assess &
 * Classify → Investigate/Root Cause → CAPA Pending → Closed), all
 * driven through the generic workflow engine on the detail page — this
 * list is intake + triage-queue visibility only.
 */
export function QualityDeviationsScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canViewAll = has('quality.view_all')
  const canLog = has('quality.log_deviation')

  const [deviations, setDeviations] = useState<Deviation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showCreate, setShowCreate] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listDeviations({ page: 1, limit: 50, status: statusFilter || undefined, severity: severityFilter || undefined })
      .then((res) => setDeviations(res.rows))
      .catch((err) => setError(getErrorMessage(err, t('qualityDeviations.errorLoad'))))
      .finally(() => setLoading(false))
  }, [statusFilter, severityFilter, t])

  useEffect(load, [load])

  if (!canViewAll) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">{t('qualityDeviations.title')}</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{t('qualityDeviations.noPermission')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">{t('qualityDeviations.titleFull')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('qualityDeviations.subtitle')}</p>
        </div>
        {canLog && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors">
            <Plus className="h-4 w-4" /> {t('qualityDeviations.logDeviation')}
          </button>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 p-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-info" />
        <p>{t('qualityDeviations.infoSeverity')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputClass} w-auto`}>
          <option value="">{t('qualityDeviations.allStatuses')}</option>
          {Object.entries(STATUS_LABEL_KEYS).map(([key, labelKey]) => (
            <option key={key} value={key}>{t(labelKey)}</option>
          ))}
        </select>
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className={`${inputClass} w-auto`}>
          <option value="">{t('qualityDeviations.allSeverities')}</option>
          <option value="critical">{t('qualityDeviations.critical')}</option>
          <option value="major">{t('qualityDeviations.major')}</option>
          <option value="minor">{t('qualityDeviations.minor')}</option>
        </select>
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : deviations.length === 0 ? (
          <div className="p-12 text-center">
            <AlertOctagon className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{t('qualityDeviations.noDeviationsYet')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">{t('qualityDeviations.columnDeviationNumber')}</th>
                <th className="p-3">{t('qualityDeviations.columnTitle')}</th>
                <th className="p-3">{t('qualityDeviations.columnSource')}</th>
                <th className="p-3">{t('qualityDeviations.columnDetected')}</th>
                <th className="p-3">{t('qualityDeviations.columnSeverity')}</th>
                <th className="p-3">{t('qualityDeviations.columnStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {deviations.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => router.push(`/quality-deviations/${d.id}`)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                >
                  <td className="p-3 text-foreground font-mono text-xs">{d.deviationNumber}</td>
                  <td className="p-3 text-foreground font-medium">{d.title}</td>
                  <td className="p-3 text-muted-foreground text-xs">{DEVIATION_SOURCE_TYPE_LABELS[d.sourceType as keyof typeof DEVIATION_SOURCE_TYPE_LABELS] ?? d.sourceType}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(d.detectedAt)}</td>
                  <td className="p-3">
                    {d.severity ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${SEVERITY_STYLES[d.severity]}`}>{d.severity}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">{STATUS_LABEL_KEYS[d.status] ? t(STATUS_LABEL_KEYS[d.status]) : d.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateDeviationModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false)
            setNotice(t('qualityDeviations.loggedNotice'))
            load()
            router.push(`/quality-deviations/${id}`)
          }}
        />
      )}
    </div>
  )
}

function CreateDeviationModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sourceType, setSourceType] = useState<string>('self_reported')
  const [detectedAt, setDetectedAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [containmentActions, setContainmentActions] = useState('')
  const [productId, setProductId] = useState('')
  const [equipmentId, setEquipmentId] = useState('')
  const [products, setProducts] = useState<{ id: string; brandName: string }[]>([])
  const [equipment, setEquipment] = useState<{ id: string; name: string }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listProducts({ limit: 100 })
      .then((res) => setProducts(res.rows.map((p) => ({ id: p.id, brandName: p.brandName }))))
      .catch(() => setProducts([]))
    listEquipment({ limit: 100 })
      .then((res) => setEquipment(res.rows.map((e) => ({ id: e.id, name: e.name }))))
      .catch(() => setEquipment([]))
  }, [])

  const isValid = title.trim().length > 0 && detectedAt.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      const created = await createDeviation({
        title: title.trim(),
        description: description.trim() || undefined,
        sourceType,
        detectedAt: new Date(detectedAt).toISOString(),
        containmentActions: containmentActions.trim() || undefined,
        productId: productId || undefined,
        equipmentId: equipmentId || undefined,
      })
      onCreated(created.id)
    } catch (err) {
      setError(getErrorMessage(err, t('qualityDeviations.errorCreate')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 space-y-4 my-8">
        <h2 className="font-display font-bold text-lg text-foreground">{t('qualityDeviations.logDeviationModalTitle')}</h2>

        <div>
          <label className={labelClass}>{t('qualityDeviations.titleField')}</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('qualityDeviations.titlePlaceholder')} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>{t('qualityDeviations.description')}</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} placeholder={t('qualityDeviations.descriptionPlaceholder')} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t('qualityDeviations.source')}</label>
            <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className={inputClass}>
              {DEVIATION_SOURCE_TYPES.map((key) => (
                <option key={key} value={key}>{DEVIATION_SOURCE_TYPE_LABELS[key]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t('qualityDeviations.detectedAt')}</label>
            <input type="datetime-local" value={detectedAt} onChange={(e) => setDetectedAt(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t('qualityDeviations.relatedProduct')}</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
              <option value="">{t('qualityDeviations.none')}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.brandName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t('qualityDeviations.relatedEquipment')}</label>
            <select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} className={inputClass}>
              <option value="">{t('qualityDeviations.none')}</option>
              {equipment.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>{t('qualityDeviations.immediateContainmentActions')}</label>
          <textarea value={containmentActions} onChange={(e) => setContainmentActions(e.target.value)} rows={2} className={inputClass} />
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
            {t('qualityDeviations.logDeviation')}
          </button>
        </div>
      </div>
    </div>
  )
}
