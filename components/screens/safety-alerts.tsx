'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Mail, Plus, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { Product, listProducts } from '@/lib/api/master-data'
import {
  SafetyAlert,
  SafetyAlertStatus,
  SAFETY_ALERT_STATUS_LABELS,
  createSafetyAlert,
  dispatchSafetyLetter,
  generateSafetyLetter,
  getSafetyAlert,
  listSafetyAlerts,
  SafetyLetterType,
  SAFETY_LETTER_TYPE_LABELS,
  SafetyLetterWithRecipients,
  updateSafetyAlertStatus,
} from '@/lib/api/safety-alerts'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { Modal } from '@/components/ui/modal'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'

const inputClass = 'w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm'
const labelClass = 'block text-xs font-medium text-[var(--text-muted)] mb-1'

const STATUS_STYLES: Record<SafetyAlertStatus, string> = {
  open: 'bg-status-warning/10 text-status-warning',
  reviewed: 'bg-status-info/10 text-status-info',
  actioned: 'bg-status-success/10 text-status-success',
  dismissed: 'bg-muted text-muted-foreground',
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString()
}

/**
 * VigiCloud Stage 18 — the manual, audit-trailed half of "safety-signal
 * notifications." The automated daily external-source scan is
 * deliberately not built (see `SafetyAlert`'s own backend schema doc
 * comment) — this screen is where a human logs what they found and, if
 * warranted, generates a real DHCP/DIL letter in response.
 */
export function SafetyAlertsScreen() {
  const { has } = usePermissions()
  const canManage = has('safety_alerts.manage')

  const [alerts, setAlerts] = useState<SafetyAlert[]>([])
  const [statusFilter, setStatusFilter] = useState<SafetyAlertStatus | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showCreate, setShowCreate] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listSafetyAlerts(statusFilter === 'all' ? undefined : statusFilter)
      .then(setAlerts)
      .catch((err) => setError(getErrorMessage(err, 'Could not load safety alerts.')))
      .finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => {
    load()
  }, [load])

  const columns: DataTableColumn<SafetyAlert>[] = [
    { key: 'title', label: 'Title', render: (v) => <span className="font-medium text-foreground">{v as string}</span> },
    { key: 'source', label: 'Source' },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[v as SafetyAlertStatus]}`}>{SAFETY_ALERT_STATUS_LABELS[v as SafetyAlertStatus]}</span>,
    },
    { key: 'createdAt', label: 'Logged', render: (v) => formatDate(v as string) },
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-safemeds-teal" />
            <h1 className="text-3xl font-display font-bold text-foreground">Safety Alerts</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {alerts.length} {alerts.length === 1 ? 'alert' : 'alerts'} · manually logged safety signals and the DHCP/DIL letters generated in response
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors"
          >
            <Plus className="h-4 w-4" />
            Log Alert
          </button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as SafetyAlertStatus | 'all')} className={`${inputClass} mt-2 sm:max-w-xs`}>
          <option value="all">All Statuses</option>
          {Object.entries(SAFETY_ALERT_STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error}</div>}

      <DataTableV2 data={alerts} columns={columns} onRowClick={(row) => setDetailId(row.id)} searchable exportable={false} showDensityToggle={false} loading={loading} />

      {!loading && alerts.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No safety alerts logged yet.</p>
        </div>
      )}

      {showCreate && (
        <LogAlertModal
          onClose={() => setShowCreate(false)}
          onCreated={(alert) => {
            setShowCreate(false)
            setNotice('Alert logged.')
            setAlerts((prev) => [alert, ...prev])
          }}
        />
      )}

      {detailId && (
        <AlertDetailModal
          id={detailId}
          canManage={canManage}
          onClose={() => setDetailId(null)}
          onUpdated={() => {
            load()
          }}
        />
      )}
    </div>
  )
}

function LogAlertModal({ onClose, onCreated }: { onClose: () => void; onCreated: (alert: SafetyAlert) => void }) {
  const [title, setTitle] = useState('')
  const [source, setSource] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [summary, setSummary] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [affectedProductId, setAffectedProductId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listProducts({ limit: 100 })
      .then(({ rows }) => setProducts(rows))
      .catch(() => setProducts([]))
  }, [])

  const isValid = title.trim().length > 0 && source.trim().length > 0 && summary.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      const alert = await createSafetyAlert({
        title: title.trim(),
        source: source.trim(),
        sourceUrl: sourceUrl.trim() || undefined,
        summary: summary.trim(),
        affectedProductId: affectedProductId || undefined,
      })
      onCreated(alert)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not log this alert.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Log Safety Alert" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className={labelClass}>Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Batch withdrawal notice" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Source *</label>
          <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. WHO Medical Product Alert" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Source URL (optional)</label>
          <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Affected product (optional)</label>
          <select value={affectedProductId} onChange={(e) => setAffectedProductId(e.target.value)} className={inputClass}>
            <option value="">None / not product-specific</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brandName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Summary *</label>
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} className={inputClass} />
        </div>

        {error && <p className="text-xs text-status-error">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text)]">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--primary)] text-white text-xs font-medium disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Log Alert
          </button>
        </div>
      </div>
    </Modal>
  )
}

function AlertDetailModal({ id, canManage, onClose, onUpdated }: { id: string; canManage: boolean; onClose: () => void; onUpdated: () => void }) {
  const [alert, setAlert] = useState<SafetyAlert | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [showLetterForm, setShowLetterForm] = useState(false)
  const [letter, setLetter] = useState<SafetyLetterWithRecipients | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getSafetyAlert(id)
      .then(setAlert)
      .catch((err) => setError(getErrorMessage(err, 'Could not load this alert.')))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const handleStatus = async (status: 'reviewed' | 'actioned' | 'dismissed') => {
    setBusy(true)
    setError(null)
    try {
      const updated = await updateSafetyAlertStatus(id, { status, reviewNote: reviewNote.trim() || undefined })
      setAlert(updated)
      onUpdated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update this alert.'))
    } finally {
      setBusy(false)
    }
  }

  const handleDispatch = async () => {
    if (!letter) return
    setBusy(true)
    setError(null)
    try {
      setLetter(await dispatchSafetyLetter(letter.id))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not dispatch this letter.'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Modal title="Safety Alert" onClose={onClose}>
        <div className="flex justify-center p-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </Modal>
    )
  }

  if (!alert) {
    return (
      <Modal title="Safety Alert" onClose={onClose}>
        <p className="text-sm text-status-error">{error ?? 'Not found.'}</p>
      </Modal>
    )
  }

  return (
    <Modal title={alert.title} onClose={onClose} maxWidth="max-w-xl">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[alert.status]}`}>{SAFETY_ALERT_STATUS_LABELS[alert.status]}</span>
          <span className="text-xs text-muted-foreground">{alert.source}</span>
        </div>
        <p className="text-sm text-foreground">{alert.summary}</p>
        {alert.reviewNote && (
          <div className="rounded-lg bg-muted/40 p-3 text-sm text-foreground">
            <p className="text-xs font-semibold text-muted-foreground">Review note</p>
            {alert.reviewNote}
          </div>
        )}

        {error && <p className="text-xs text-status-error">{error}</p>}

        {canManage && alert.status !== 'dismissed' && (
          <div className="space-y-2 border-t border-border pt-3">
            <label className={labelClass}>Review note (optional)</label>
            <textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={2} className={inputClass} />
            <div className="flex flex-wrap gap-2">
              {alert.status === 'open' && (
                <button onClick={() => handleStatus('reviewed')} disabled={busy} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                  Mark Reviewed
                </button>
              )}
              <button onClick={() => handleStatus('actioned')} disabled={busy} className="rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce">
                Mark Actioned
              </button>
              <button onClick={() => handleStatus('dismissed')} disabled={busy} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="border-t border-border pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">DHCP / DIL Letter</p>
          {letter ? (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-sm font-medium text-foreground">{letter.title}</p>
              <ul className="space-y-1">
                {letter.recipients.map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-xs">
                    <span className="text-foreground">
                      {r.recipientName} &lt;{r.recipientEmail}&gt;
                    </span>
                    <span className={r.sentAt ? 'text-status-success' : 'text-muted-foreground'}>{r.sentAt ? `Sent ${formatDate(r.sentAt)}` : 'Not sent'}</span>
                  </li>
                ))}
              </ul>
              {canManage && letter.recipients.some((r) => !r.sentAt) && (
                <button onClick={handleDispatch} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce">
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                  Dispatch to Remaining Recipients
                </button>
              )}
            </div>
          ) : canManage ? (
            showLetterForm ? (
              <GenerateLetterForm
                safetyAlertId={alert.id}
                onGenerated={(generated) => {
                  setLetter(generated)
                  setShowLetterForm(false)
                }}
                onCancel={() => setShowLetterForm(false)}
              />
            ) : (
              <button onClick={() => setShowLetterForm(true)} className="text-xs font-medium text-safemeds-teal hover:underline">
                Generate a DHCP/DIL letter for this alert
              </button>
            )
          ) : (
            <p className="text-xs text-muted-foreground">No letter generated yet.</p>
          )}
        </div>
      </div>
    </Modal>
  )
}

function GenerateLetterForm({ safetyAlertId, onGenerated, onCancel }: { safetyAlertId: string; onGenerated: (letter: SafetyLetterWithRecipients) => void; onCancel: () => void }) {
  const [letterType, setLetterType] = useState<SafetyLetterType>('dhcp')
  const [ppbApprovalReference, setPpbApprovalReference] = useState('')
  const [backgroundInformation, setBackgroundInformation] = useState('')
  const [actionableGuidance, setActionableGuidance] = useState('')
  const [signatoryName, setSignatoryName] = useState('')
  const [signatoryTitle, setSignatoryTitle] = useState('')
  const [recipients, setRecipients] = useState<{ name: string; email: string }[]>([{ name: '', email: '' }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validRecipients = recipients.filter((r) => r.name.trim() && r.email.trim())
  const isValid =
    ppbApprovalReference.trim().length > 0 &&
    backgroundInformation.trim().length > 0 &&
    actionableGuidance.trim().length > 0 &&
    signatoryName.trim().length > 0 &&
    validRecipients.length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      const letter = await generateSafetyLetter({
        safetyAlertId,
        letterType,
        ppbApprovalReference: ppbApprovalReference.trim(),
        backgroundInformation: backgroundInformation.trim(),
        actionableGuidance: actionableGuidance.trim(),
        signatoryName: signatoryName.trim(),
        signatoryTitle: signatoryTitle.trim() || undefined,
        recipients: validRecipients,
      })
      onGenerated(letter)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not generate this letter.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
      <div>
        <label className={labelClass}>Letter type</label>
        <select value={letterType} onChange={(e) => setLetterType(e.target.value as SafetyLetterType)} className={inputClass}>
          {Object.entries(SAFETY_LETTER_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>PPB approval reference</label>
        <input
          value={ppbApprovalReference}
          onChange={(e) => setPpbApprovalReference(e.target.value)}
          className={inputClass}
          placeholder="e.g. PPB/PV/2026/0142"
        />
        <p className="mt-1 text-xs text-muted-foreground">Required — a letter cannot be generated without regulator pre-approval reference.</p>
      </div>
      <div>
        <label className={labelClass}>Background information &amp; clinical relevance</label>
        <textarea value={backgroundInformation} onChange={(e) => setBackgroundInformation(e.target.value)} rows={3} className={inputClass} placeholder="What happened, and why it's clinically relevant?" />
      </div>
      <div>
        <label className={labelClass}>Actionable guidance for healthcare providers</label>
        <textarea value={actionableGuidance} onChange={(e) => setActionableGuidance(e.target.value)} rows={3} className={inputClass} placeholder="What should recipients do?" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>Signatory name</label>
          <input value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} className={inputClass} placeholder="e.g. Dr. Jane Doe" />
        </div>
        <div>
          <label className={labelClass}>Signatory title</label>
          <input value={signatoryTitle} onChange={(e) => setSignatoryTitle(e.target.value)} className={inputClass} placeholder="Medical Director / QPPV" />
        </div>
      </div>
      <div>
        <label className={labelClass}>Recipients</label>
        <div className="space-y-2">
          {recipients.map((r, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                value={r.name}
                onChange={(e) => setRecipients((prev) => prev.map((p, i) => (i === idx ? { ...p, name: e.target.value } : p)))}
                placeholder="Name"
                className={inputClass}
              />
              <input
                value={r.email}
                onChange={(e) => setRecipients((prev) => prev.map((p, i) => (i === idx ? { ...p, email: e.target.value } : p)))}
                placeholder="Email"
                className={inputClass}
              />
            </div>
          ))}
        </div>
        <button onClick={() => setRecipients((prev) => [...prev, { name: '', email: '' }])} className="mt-1 text-xs font-medium text-safemeds-teal hover:underline">
          + Add recipient
        </button>
      </div>

      {error && <p className="text-xs text-status-error">{error}</p>}

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-2 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text)]">
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={!isValid || submitting} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--primary)] text-white text-xs font-medium disabled:opacity-50">
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Generate Letter
        </button>
      </div>
    </div>
  )
}
