'use client'

import { useCallback, useEffect, useState } from 'react'
import { CircleCheck, ClipboardList, Download, FileBarChart, Loader2, ShieldAlert, Upload } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { uploadDocument } from '@/lib/api/documents'
import {
  AUDIT_REQUIREMENT_STATUS_LABELS,
  AuditPack,
  AuditReadinessDashboard,
  AuditRequirementRow,
  AuditRequirementStatus,
  generateAuditPack,
  getAeLogExportUrl,
  getAuditReadinessDashboard,
  listAuditPacks,
  updateAuditRequirement,
} from '@/lib/api/governance'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const STATUS_STYLES: Record<AuditRequirementStatus, string> = {
  ready: 'bg-status-success/10 text-status-success',
  needs_update: 'bg-status-warning/10 text-status-warning',
  expiring: 'bg-status-warning/10 text-status-warning',
  missing: 'bg-status-error/10 text-status-error',
}

const GAUGE_STYLES: Record<'green' | 'amber' | 'red', string> = {
  green: 'bg-status-success/10 text-status-success border-status-success',
  amber: 'bg-status-warning/10 text-status-warning border-status-warning',
  red: 'bg-status-error/10 text-status-error border-status-error',
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

/**
 * VigiCloud Stage 16.2 — the audit-readiness dashboard: a gauge, the
 * 15-row requirement table with live status, drill-in per requirement,
 * "Generate Audit Pack", and the AE-log CSV export. `system_generated`
 * rows are read-only here except for an optional human note — their
 * real status always comes from the backend's own live resolver, never
 * from anything typed in this screen.
 */
export function AuditReadinessScreen() {
  const { has } = usePermissions()
  const canManage = has('governance.manage')

  const [dashboard, setDashboard] = useState<AuditReadinessDashboard | null>(null)
  const [packs, setPacks] = useState<AuditPack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [selectedRow, setSelectedRow] = useState<AuditRequirementRow | null>(null)
  const [generating, setGenerating] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([getAuditReadinessDashboard(), listAuditPacks()])
      .then(([d, p]) => {
        setDashboard(d)
        setPacks(p)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load the audit-readiness dashboard.')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleGeneratePack = async () => {
    setGenerating(true)
    setError(null)
    try {
      await generateAuditPack()
      setNotice('Audit pack generated.')
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not generate an audit pack.'))
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !dashboard) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error}</div>
      </div>
    )
  }

  if (!dashboard) return null

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <ClipboardList className="h-6 w-6 text-safemeds-teal" />
            <h1 className="text-3xl font-display font-bold text-foreground">Audit Readiness</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {dashboard.rows.length > 0
              ? `The ${dashboard.rows.length} ${dashboard.homeCountryName} inspection requirements — most resolved live from your own real data, a few are documents you upload yourself.`
              : `No inspection requirements are configured for ${dashboard.homeCountryName} yet.`}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={getAeLogExportUrl()}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            <Download className="h-4 w-4" /> AE Log CSV
          </a>
          {canManage && (
            <button
              onClick={handleGeneratePack}
              disabled={generating}
              className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
            >
              {generating && <Loader2 className="h-4 w-4 animate-spin" />}
              Generate Audit Pack
            </button>
          )}
        </div>
      </div>

      {dashboard.rows.length > 0 && (
        <div className={`rounded-lg border-2 p-4 flex items-center justify-between ${GAUGE_STYLES[dashboard.overall]}`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider">Overall Readiness</p>
            <p className="text-2xl font-display font-bold">{dashboard.overall.toUpperCase()}</p>
          </div>
          <p className="text-sm">
            {dashboard.readyCount} / {dashboard.totalMandatory} mandatory requirements ready
          </p>
        </div>
      )}

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      {dashboard.rows.length === 0 ? (
        <div className="rounded-lg border border-status-warning bg-status-warning/10 p-6 text-sm text-status-warning flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">
              {dashboard.authorityConfigured
                ? `${dashboard.homeCountryName} has a regulatory authority configured, but no inspection requirements yet.`
                : `${dashboard.homeCountryName} has no regulatory authority configured yet.`}
            </p>
            <p className="mt-1 text-status-warning/90">
              This is expected for a market that hasn&apos;t had its regulatory content set up yet — not a bug.
              Contact SafeMeds support to have {dashboard.homeCountryName}&apos;s regulatory content configured.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">#</th>
                <th className="p-3">Requirement</th>
                <th className="p-3">Source</th>
                <th className="p-3">Status</th>
                <th className="p-3">Mandatory</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {dashboard.rows.map((row) => (
                <tr key={row.definitionId} className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/50" onClick={() => setSelectedRow(row)}>
                  <td className="p-3 text-muted-foreground">{row.sortOrder}</td>
                  <td className="p-3 font-medium text-foreground">{row.title}</td>
                  <td className="p-3 text-xs text-muted-foreground">{row.source === 'system_generated' ? 'Live' : 'Upload'}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLES[row.status]}`}>{AUDIT_REQUIREMENT_STATUS_LABELS[row.status]}</span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{row.isMandatory ? 'Yes' : 'No'}</td>
                  <td className="p-3 text-right text-xs text-safemeds-teal">View</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileBarChart className="h-4 w-4 text-safemeds-teal" />
          <h2 className="text-sm font-semibold text-foreground">Audit Pack History</h2>
        </div>
        {packs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No audit packs generated yet — supports no-notice audits with zero prep time.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="pb-2">Generated</th>
                <th className="pb-2">Overall</th>
                <th className="pb-2">Ready</th>
              </tr>
            </thead>
            <tbody>
              {packs.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="py-2 text-foreground">{formatDate(p.generatedAt)}</td>
                  <td className="py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${GAUGE_STYLES[p.snapshot.overall]}`}>{p.snapshot.overall.toUpperCase()}</span>
                  </td>
                  <td className="py-2 text-muted-foreground">
                    {p.snapshot.readyCount} / {p.snapshot.totalMandatory}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedRow && (
        <RequirementDetailModal
          row={selectedRow}
          canManage={canManage}
          onClose={() => setSelectedRow(null)}
          onSaved={() => {
            setSelectedRow(null)
            setNotice('Requirement updated.')
            load()
          }}
        />
      )}
    </div>
  )
}

function RequirementDetailModal({
  row,
  canManage,
  onClose,
  onSaved,
}: {
  row: AuditRequirementRow
  canManage: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [status, setStatus] = useState<AuditRequirementStatus>(row.status)
  const [note, setNote] = useState(row.statusNote ?? '')
  const [uploading, setUploading] = useState(false)
  const [documentId, setDocumentId] = useState<string | undefined>(row.evidenceDocumentId ?? undefined)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isPersonUploads = row.source === 'person_uploads'

  const handleFileSelected = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const version = await uploadDocument('audit_requirement_record', row.definitionId, file, { title: row.title })
      setDocumentId(version.documentId)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not upload this file.'))
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await updateAuditRequirement(row.definitionId, {
        status: isPersonUploads ? status : undefined,
        documentId,
        note: note.trim() || undefined,
      })
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save this requirement.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 space-y-4">
        <div>
          <h2 className="font-display font-bold text-lg text-foreground">{row.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{row.description}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Evidence Type</p>
            <p className="text-foreground">{row.evidenceArtifactType}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Current Status</p>
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[row.status]}`}>{AUDIT_REQUIREMENT_STATUS_LABELS[row.status]}</span>
          </div>
        </div>

        {!isPersonUploads && (
          <div className="rounded-lg border border-status-info bg-status-info/10 p-3 text-xs text-status-info flex items-start gap-2">
            <CircleCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            This status is resolved live from your real data — you can add a note below, but the status itself can&apos;t be overridden here.
          </div>
        )}

        {isPersonUploads && canManage && (
          <div>
            <label className={labelClass}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as AuditRequirementStatus)} className={inputClass}>
              {Object.entries(AUDIT_REQUIREMENT_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}

        {canManage && (
          <div>
            <label className={labelClass}>Evidence Document</label>
            {documentId ? (
              <p className="text-sm text-status-success">Document attached.</p>
            ) : (
              <label className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground cursor-pointer hover:bg-muted">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload evidence
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileSelected(file)
                  }}
                />
              </label>
            )}
          </div>
        )}

        {canManage && (
          <div>
            <label className={labelClass}>Note</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputClass} />
          </div>
        )}

        {!canManage && row.statusNote && (
          <div>
            <p className={labelClass}>Note</p>
            <p className="text-sm text-foreground">{row.statusNote}</p>
          </div>
        )}

        {!row.isMandatory && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5" /> Not mandatory — doesn&apos;t affect the overall readiness gauge.
          </p>
        )}

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Close
          </button>
          {canManage && (
            <button
              onClick={handleSave}
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
