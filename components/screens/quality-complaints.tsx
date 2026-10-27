'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Info, Loader2, MessageSquareWarning, Plus, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  COMPLAINT_CHANNEL_LABELS,
  COMPLAINT_CHANNELS,
  COMPLAINT_CLASSIFICATION_LABELS,
  Complaint,
  ResolutionTimeKpi,
  createComplaint,
  getResolutionTimeKpi,
  listComplaints,
} from '@/lib/api/complaints'
import { listProducts } from '@/lib/api/master-data'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const STATUS_LABEL_KEYS: Record<string, MessageKey> = {
  intake: 'qualityComplaints.statusIntake',
  classifying: 'qualityComplaints.statusClassifying',
  investigating: 'qualityComplaints.statusInvestigating',
  resolved: 'qualityComplaints.statusResolved',
}

const CLASSIFICATION_STYLES: Record<string, string> = {
  quality_complaint: 'bg-status-info/10 text-status-info',
  possible_ae: 'bg-status-error/10 text-status-error',
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

/**
 * QualCloud (Phase 13) Stage 5 — Complaint Handling: Intake → Classify
 * → Investigate → Resolve, with a real resolution-time KPI and the
 * critical routing behavior — a complaint describing a possible adverse
 * event gets routed to VigiCloud as a real PV case, never captured
 * twice.
 */
export function QualityComplaintsScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canViewAll = has('quality.view_all')
  const canLog = has('quality.log_deviation')

  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [kpi, setKpi] = useState<ResolutionTimeKpi | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showCreate, setShowCreate] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      listComplaints({ page: 1, limit: 50, status: statusFilter || undefined }),
      getResolutionTimeKpi(),
    ])
      .then(([complaintsRes, kpiRes]) => {
        setComplaints(complaintsRes.rows)
        setKpi(kpiRes)
      })
      .catch((err) => setError(getErrorMessage(err, t('qualityComplaints.errorLoad'))))
      .finally(() => setLoading(false))
  }, [statusFilter, t])

  useEffect(load, [load])

  if (!canViewAll) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">{t('qualityComplaints.title')}</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{t('qualityComplaints.noPermission')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">{t('qualityComplaints.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('qualityComplaints.subtitle')}</p>
        </div>
        {canLog && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors">
            <Plus className="h-4 w-4" /> {t('qualityComplaints.logComplaint')}
          </button>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 p-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-info" />
        <p>{t('qualityComplaints.infoRouting')}</p>
      </div>

      {kpi && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t('qualityComplaints.avgResolutionTime')}</p>
            <p className="mt-1 text-2xl font-display font-bold text-foreground">{kpi.averageDays ?? '—'}{kpi.averageDays != null && <span className="text-sm font-normal text-muted-foreground"> {t('qualityComplaints.days')}</span>}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t('qualityComplaints.withinTargetDay', { days: String(kpi.targetDays) })}</p>
            <p className="mt-1 text-2xl font-display font-bold text-foreground">{kpi.withinTargetPercent ?? '—'}{kpi.withinTargetPercent != null && '%'}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t('qualityComplaints.resolvedComplaints')}</p>
            <p className="mt-1 text-2xl font-display font-bold text-foreground">{kpi.resolvedCount}</p>
          </div>
        </div>
      )}

      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputClass} w-auto`}>
        <option value="">{t('qualityComplaints.allStatuses')}</option>
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
        ) : complaints.length === 0 ? (
          <div className="p-12 text-center">
            <MessageSquareWarning className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{t('qualityComplaints.noComplaintsYet')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">{t('qualityComplaints.columnComplaintNumber')}</th>
                <th className="p-3">{t('qualityComplaints.columnSource')}</th>
                <th className="p-3">{t('qualityComplaints.columnLogged')}</th>
                <th className="p-3">{t('qualityComplaints.columnClassification')}</th>
                <th className="p-3">{t('qualityComplaints.columnStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map((c) => (
                <tr key={c.id} onClick={() => router.push(`/quality-complaints/${c.id}`)} className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50">
                  <td className="p-3 text-foreground font-mono text-xs">{c.complaintNumber}</td>
                  <td className="p-3 text-muted-foreground text-xs">{COMPLAINT_CHANNEL_LABELS[c.channel as keyof typeof COMPLAINT_CHANNEL_LABELS] ?? c.channel}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(c.createdAt)}</td>
                  <td className="p-3">
                    {c.classification ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CLASSIFICATION_STYLES[c.classification] ?? 'bg-muted text-foreground'}`}>
                        {c.classification ? COMPLAINT_CLASSIFICATION_LABELS[c.classification as keyof typeof COMPLAINT_CLASSIFICATION_LABELS] : '—'}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
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
        <CreateComplaintModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false)
            setNotice(t('qualityComplaints.loggedNotice'))
            load()
            router.push(`/quality-complaints/${id}`)
          }}
        />
      )}
    </div>
  )
}

function CreateComplaintModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useTranslation()
  const [productId, setProductId] = useState('')
  const [channel, setChannel] = useState<string>('phone')
  const [description, setDescription] = useState('')
  const [reporterName, setReporterName] = useState('')
  const [reporterContact, setReporterContact] = useState('')
  const [products, setProducts] = useState<{ id: string; brandName: string }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listProducts({ limit: 100 })
      .then((res) => setProducts(res.rows.map((p) => ({ id: p.id, brandName: p.brandName }))))
      .catch(() => setProducts([]))
  }, [])

  const isValid = productId.length > 0 && description.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      const created = await createComplaint({
        productId,
        channel,
        description: description.trim(),
        reporterName: reporterName.trim() || undefined,
        reporterContact: reporterContact.trim() || undefined,
      })
      onCreated(created.id)
    } catch (err) {
      setError(getErrorMessage(err, t('qualityComplaints.errorCreate')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 space-y-4 my-8">
        <h2 className="font-display font-bold text-lg text-foreground">{t('qualityComplaints.logModalTitle')}</h2>

        <div>
          <label className={labelClass}>{t('qualityComplaints.product')}</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
            <option value="">{t('qualityComplaints.selectProduct')}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.brandName}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>{t('qualityComplaints.source')}</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputClass}>
            {COMPLAINT_CHANNELS.map((ch) => (
              <option key={ch} value={ch}>{COMPLAINT_CHANNEL_LABELS[ch]}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t('qualityComplaints.reporterName')}</label>
            <input value={reporterName} onChange={(e) => setReporterName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t('qualityComplaints.reporterContact')}</label>
            <input value={reporterContact} onChange={(e) => setReporterContact(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>{t('qualityComplaints.description')}</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={inputClass} placeholder={t('qualityComplaints.descriptionPlaceholder')} />
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
            {t('qualityComplaints.logComplaint')}
          </button>
        </div>
      </div>
    </div>
  )
}
