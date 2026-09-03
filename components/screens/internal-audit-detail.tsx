'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ClipboardCheck, Gavel, Loader2, Plus } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  addAuditFinding,
  AUDIT_FINDING_SEVERITY_LABELS,
  AuditFinding,
  AuditFindingSeverity,
  InternalAuditStatus,
  InternalAuditWithFindings,
  INTERNAL_AUDIT_STATUS_LABELS,
  getInternalAudit,
  updateInternalAudit,
} from '@/lib/api/internal-audits'
import { OpenCapaModal } from '@/components/internal-audits/open-capa-modal'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-status-error/10 text-status-error',
  major: 'bg-status-warning/10 text-status-warning',
  minor: 'bg-status-info/10 text-status-info',
  observation: 'bg-muted text-muted-foreground',
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

interface Props {
  auditId: string
}

export function InternalAuditDetail({ auditId }: Props) {
  const router = useRouter()
  const { has } = usePermissions()
  const canManage = has('quality.manage_capa')

  const [audit, setAudit] = useState<InternalAuditWithFindings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showFinding, setShowFinding] = useState(false)
  const [openingCapaFor, setOpeningCapaFor] = useState<AuditFinding | null>(null)

  // `silent` refreshes must never re-show the spinner — see
  // `pv-case-detail.tsx`'s identical fix for the full reasoning.
  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      setError(null)
      try {
        setAudit(await getInternalAudit(auditId))
      } catch (err) {
        setError(getErrorMessage(err, 'Could not load this audit.'))
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [auditId],
  )

  const refresh = useCallback(() => load(true), [load])

  useEffect(() => {
    load()
  }, [load])

  const handleStatusChange = async (status: InternalAuditStatus) => {
    if (!audit) return
    try {
      const updated = await updateInternalAudit(audit.id, { status })
      setAudit({ ...audit, ...updated })
      setNotice(`Status updated to ${INTERNAL_AUDIT_STATUS_LABELS[status]}.`)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update status.'))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !audit) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error ?? 'Audit not found.'}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <button onClick={() => router.push('/internal-audits')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Internal Audits
      </button>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Gavel className="h-6 w-6 text-safemeds-teal" />
            <h1 className="text-2xl font-display font-bold text-foreground">{audit.title}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Scheduled {formatDate(audit.scheduledDate)}</p>
          {audit.scope && <p className="mt-2 text-sm text-foreground">{audit.scope}</p>}
        </div>
        {canManage ? (
          <select value={audit.status} onChange={(e) => handleStatusChange(e.target.value as InternalAuditStatus)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground">
            {Object.entries(INTERNAL_AUDIT_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        ) : (
          <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-foreground">{INTERNAL_AUDIT_STATUS_LABELS[audit.status]}</span>
        )}
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Findings</h2>
          {canManage && (
            <button
              onClick={() => setShowFinding(true)}
              className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce"
            >
              <Plus className="h-3.5 w-3.5" /> Log Finding
            </button>
          )}
        </div>

        {audit.findings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No findings logged for this audit.</p>
        ) : (
          <div className="space-y-2">
            {audit.findings.map((f) => (
              <div key={f.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLES[f.severity]}`}>{AUDIT_FINDING_SEVERITY_LABELS[f.severity as AuditFindingSeverity]}</span>
                  <span className="text-xs text-muted-foreground capitalize">{f.status.replace('_', ' ')}</span>
                </div>
                <p className="mt-2 text-sm text-foreground">{f.description}</p>
                {f.status === 'open' && canManage && (
                  <button
                    onClick={() => setOpeningCapaFor(f)}
                    className="mt-2 flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" /> Open CAPA
                  </button>
                )}
                {f.status === 'capa_assigned' && (
                  <p className="mt-2 text-xs text-muted-foreground">A CAPA has been opened for this finding — see the CAPAs tab. It will close automatically once that CAPA is closed.</p>
                )}
                {f.status === 'closed' && <p className="mt-2 text-xs text-status-success">Closed — its CAPA was completed with a confirmed effectiveness check.</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {showFinding && (
        <LogFindingModal
          auditId={audit.id}
          onClose={() => setShowFinding(false)}
          onLogged={() => {
            setShowFinding(false)
            setNotice('Finding logged.')
            refresh()
          }}
        />
      )}

      {openingCapaFor && (
        <OpenCapaModal
          findingId={openingCapaFor.id}
          onClose={() => setOpeningCapaFor(null)}
          onOpened={() => {
            setOpeningCapaFor(null)
            setNotice('CAPA opened and linked to this finding.')
            refresh()
          }}
        />
      )}
    </div>
  )
}

function LogFindingModal({ auditId, onClose, onLogged }: { auditId: string; onClose: () => void; onLogged: () => void }) {
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<AuditFindingSeverity>('minor')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = description.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await addAuditFinding(auditId, { description: description.trim(), severity })
      onLogged()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not log this finding.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">Log Finding</h2>

        <div>
          <label className={labelClass}>Description *</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Severity</label>
          <select value={severity} onChange={(e) => setSeverity(e.target.value as AuditFindingSeverity)} className={inputClass}>
            {Object.entries(AUDIT_FINDING_SEVERITY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Log Finding
          </button>
        </div>
      </div>
    </div>
  )
}
