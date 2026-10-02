'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import { ClipboardCheck, Loader2, Plus, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  createValidationProtocol,
  createValidationReport,
  finalizeValidationReport,
  listValidationProtocols,
  listValidationReports,
  ValidationProtocol,
  ValidationReport,
  ValidationType,
} from '@/lib/api/quality'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const VALIDATION_TYPE_LABELS: Record<ValidationType, string> = {
  process: 'Process Validation',
  cleaning: 'Cleaning Validation',
  analytical_method: 'Analytical Method Validation',
  computer_system: 'Computer System Validation (CSV)',
}

const DOCUMENT_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-foreground',
  in_review: 'bg-status-info/10 text-status-info',
  approved: 'bg-status-warning/10 text-status-warning',
  effective: 'bg-status-success/10 text-status-success',
  superseded: 'bg-muted text-muted-foreground',
  retired: 'bg-status-error/10 text-status-error',
}

/**
 * QualCloud (Phase 13) Stage 18 — Validation (Process/Cleaning/Method)
 * and Computer System Validation. A protocol *is* a controlled
 * document — its lifecycle (Draft → In Review → Approved → Effective)
 * is driven through the exact same `quality_controlled_document`
 * workflow every other SOP uses, visible here via `protocolDocument
 * .status`. Use the Controlled Documents screen to actually transition
 * a protocol's document through review/approval — this screen focuses
 * on drafting protocols and recording execution/conclusion once one is
 * effective.
 */
export function QualityValidationScreen() {
  const { has } = usePermissions()
  const canView = has('quality.view_all')
  const canDraft = has('quality.manage_documents')
  const canManage = has('quality.manage_validation')

  const [protocols, setProtocols] = useState<ValidationProtocol[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showCreate, setShowCreate] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listValidationProtocols({ page: 1, limit: 50 })
      .then((res) => setProtocols(res.rows))
      .catch((err) => setError(getErrorMessage(err, 'Could not load validation protocols.')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">Validation &amp; Qualification</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to view validation records.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Validation &amp; Qualification</h1>
          <p className="mt-1 text-sm text-muted-foreground">Process, cleaning, analytical-method, and computer-system validation — a protocol is a real controlled document.</p>
        </div>
        {canDraft && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors">
            <Plus className="h-4 w-4" /> Draft Protocol
          </button>
        )}
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : protocols.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardCheck className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No validation protocols yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">Title</th>
                <th className="p-3">Type</th>
                <th className="p-3">Document #</th>
                <th className="p-3">Document Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {protocols.map((p) => (
                <Fragment key={p.id}>
                  <tr className="border-b border-border last:border-0">
                    <td className="p-3 text-foreground font-medium">{p.title}</td>
                    <td className="p-3 text-muted-foreground text-xs">{VALIDATION_TYPE_LABELS[p.validationType]}</td>
                    <td className="p-3 text-muted-foreground font-mono text-xs">{p.protocolDocument.documentNumber}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${DOCUMENT_STATUS_STYLES[p.protocolDocument.status] ?? 'bg-muted text-foreground'}`}>
                        {p.protocolDocument.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3">
                      <button onClick={() => setExpanded(expanded === p.id ? null : p.id)} className="text-xs font-medium text-safemeds-teal hover:underline">
                        {expanded === p.id ? 'Hide reports' : 'Execution & reports'}
                      </button>
                    </td>
                  </tr>
                  {expanded === p.id && (
                    <tr>
                      <td colSpan={5} className="bg-muted/30 p-4">
                        <ProtocolReports protocol={p} canManage={canManage} onChanged={() => setNotice('Updated.')} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateProtocolModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            setNotice('Protocol drafted as a new controlled document.')
            load()
          }}
        />
      )}
    </div>
  )
}

function ProtocolReports({
  protocol,
  canManage,
  onChanged,
}: {
  protocol: ValidationProtocol
  canManage: boolean
  onChanged: () => void
}) {
  const [reports, setReports] = useState<ValidationReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [conclusion, setConclusion] = useState('validated')

  const load = useCallback(() => {
    setLoading(true)
    listValidationReports(protocol.id)
      .then(setReports)
      .catch((err) => setError(getErrorMessage(err, 'Could not load reports.')))
      .finally(() => setLoading(false))
  }, [protocol.id])

  useEffect(load, [load])

  const isEffective = protocol.protocolDocument.status === 'effective'

  const handleRecord = async () => {
    setError(null)
    try {
      await createValidationReport(protocol.id, { conclusion })
      onChanged()
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not record execution — the protocol document must be effective first.'))
    }
  }

  return (
    <div className="space-y-3">
      {!isEffective && (
        <p className="text-xs text-muted-foreground">
          Execution can only be recorded once this protocol&apos;s own controlled document is <strong>Effective</strong>
          — drive it through Draft → In Review → Approved → Effective via the Controlled Documents screen.
        </p>
      )}
      {error && <p className="text-xs text-status-error">{error}</p>}
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : reports.length === 0 ? (
        <p className="text-xs text-muted-foreground">No execution recorded yet.</p>
      ) : (
        <ul className="space-y-1.5 text-xs">
          {reports.map((r) => (
            <li key={r.id} className="flex items-center justify-between">
              <span className="text-foreground capitalize">{r.conclusion?.replace(/_/g, ' ') ?? 'No conclusion yet'}</span>
              {canManage && (
                <select
                  defaultValue={r.conclusion ?? ''}
                  onChange={async (e) => {
                    await finalizeValidationReport(r.id, { conclusion: e.target.value })
                    onChanged()
                    load()
                  }}
                  className="rounded border border-input bg-background px-2 py-1 text-xs"
                >
                  <option value="validated">Validated</option>
                  <option value="not_validated">Not Validated</option>
                  <option value="conditionally_validated">Conditionally Validated</option>
                </select>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && isEffective && (
        <div className="flex items-center gap-2">
          <select value={conclusion} onChange={(e) => setConclusion(e.target.value)} className="rounded border border-input bg-background px-2 py-1 text-xs">
            <option value="validated">Validated</option>
            <option value="not_validated">Not Validated</option>
            <option value="conditionally_validated">Conditionally Validated</option>
          </select>
          <button onClick={handleRecord} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
            Record Execution
          </button>
        </div>
      )}
    </div>
  )
}

function CreateProtocolModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [validationType, setValidationType] = useState<ValidationType>('process')
  const [approach, setApproach] = useState('traditional_three_batch')
  const [gampCategory, setGampCategory] = useState('4_configured')
  const [documentNumber, setDocumentNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = title.trim().length > 0 && documentNumber.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await createValidationProtocol({
        title: title.trim(),
        validationType,
        approach: validationType === 'process' ? approach : undefined,
        gampCategory: validationType === 'computer_system' ? gampCategory : undefined,
        documentNumber: documentNumber.trim(),
      })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not draft this protocol.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 space-y-4 my-8">
        <h2 className="font-display font-bold text-lg text-foreground">Draft a Validation Protocol</h2>

        <div>
          <label className={labelClass}>Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="e.g. Cleaning Validation — Granulation Line 1" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Validation Type *</label>
            <select value={validationType} onChange={(e) => setValidationType(e.target.value as ValidationType)} className={inputClass}>
              {Object.entries(VALIDATION_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Document Number *</label>
            <input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} className={inputClass} placeholder="e.g. VAL-CLN-001" />
          </div>
        </div>

        {validationType === 'process' && (
          <div>
            <label className={labelClass}>Approach</label>
            <select value={approach} onChange={(e) => setApproach(e.target.value)} className={inputClass}>
              <option value="traditional_three_batch">Traditional Three-Batch</option>
              <option value="continued_process_verification">Continued Process Verification</option>
            </select>
          </div>
        )}

        {validationType === 'computer_system' && (
          <div>
            <label className={labelClass}>GAMP 5 Category</label>
            <select value={gampCategory} onChange={(e) => setGampCategory(e.target.value)} className={inputClass}>
              <option value="1_infrastructure">Category 1 — Infrastructure</option>
              <option value="3_non_configured">Category 3 — Non-Configured</option>
              <option value="4_configured">Category 4 — Configured</option>
              <option value="5_custom">Category 5 — Custom</option>
            </select>
          </div>
        )}

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
            Draft
          </button>
        </div>
      </div>
    </div>
  )
}
