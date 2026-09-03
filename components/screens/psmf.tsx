'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, FileCheck2, Hammer, Loader2, RefreshCw, ShieldAlert, Upload } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { DocumentWithVersions, getDownloadUrl, listDocuments, uploadDocument } from '@/lib/api/documents'
import { getMyEntitlements } from '@/lib/api/entitlements'
import { activatePsmf, attachPsmfDocument, createPsmf, listPsmf, Psmf, PsmfStatus } from '@/lib/api/psmf'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { BuildPsmfModal } from '@/components/psmf/build-psmf-modal'
import { DocumentPreviewModal } from '@/components/ui/document-preview-modal'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const STATUS_STYLES: Record<PsmfStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-status-success/10 text-status-success',
  retired: 'bg-status-info/10 text-status-info',
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

/**
 * VigiCloud Stage 16.1 — the PSMF onboarding gate's own management
 * screen. Version-on-write, mirrored on the Reconciliation/Contact
 * Testing screens' established tone: a table + modal, not a stacked
 * list. Activating a version requires a document attached first —
 * enforced server-side, surfaced here as a disabled "Activate" button
 * with an inline hint rather than a confusing 409 after the click.
 */
export function PsmfScreen() {
  const { has } = usePermissions()
  const canManage = has('psmf.manage')

  const [versions, setVersions] = useState<Psmf[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showCreate, setShowCreate] = useState(false)
  const [building, setBuilding] = useState<Psmf | null>(null)
  const [previewing, setPreviewing] = useState<DocumentWithVersions | null>(null)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // testing-todo Stage 16.1-B — this banner used to say "can be switched
  // on" forever, regardless of whether SafeMeds staff had actually
  // already switched it on, because it only ever reflected the PSMF's
  // own status, never the real entitlement. Fetched alongside the PSMF
  // list so the banner tells the truth once staff acts on it.
  const [vigicloudEnabled, setVigicloudEnabled] = useState<boolean | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      listPsmf(),
      getMyEntitlements().catch(() => null), // best-effort — the PSMF list itself is the load-bearing part of this page
    ])
      .then(([psmfVersions, entitlements]) => {
        setVersions(psmfVersions)
        if (entitlements) {
          setVigicloudEnabled(entitlements.some((e) => e.moduleKey === 'vigicloud' && e.featureKey === '*' && e.enabled))
        }
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load PSMF versions.')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const activeVersion = versions.find((v) => v.status === 'active')

  const handleFileSelected = async (psmfId: string, file: File) => {
    setUploadingFor(psmfId)
    setError(null)
    try {
      const version = await uploadDocument('psmf', psmfId, file, { title: 'PSMF document' })
      await attachPsmfDocument(psmfId, version.documentId)
      setNotice('Document attached.')
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not upload this document.'))
    } finally {
      setUploadingFor(null)
    }
  }

  const handlePreview = async (psmfId: string) => {
    setError(null)
    try {
      const docs = await listDocuments('psmf', psmfId)
      const doc = docs[0]
      if (doc) setPreviewing(doc)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load this document.'))
    }
  }

  const handleActivate = async (id: string) => {
    setError(null)
    try {
      await activatePsmf(id)
      setNotice('PSMF activated.')
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not activate this PSMF.'))
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <FileCheck2 className="h-6 w-6 text-safemeds-teal" />
            <h1 className="text-3xl font-display font-bold text-foreground">PSMF</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Pharmacovigilance System Master File — required before SafeMeds staff can switch on this company&apos;s
            VigiCloud <strong className="text-foreground">module access</strong> (the platform-side entitlement
            toggle). VigiCloud itself is already built — this only gates that access switch.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors"
          >
            New Draft
          </button>
        )}
      </div>

      {activeVersion && vigicloudEnabled ? (
        <div className="rounded-lg border border-status-success bg-status-success/10 p-4 text-sm text-status-success flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            VigiCloud module access is enabled for this company.
          </span>
          <button onClick={load} className="flex items-center gap-1 text-xs text-status-success hover:underline flex-shrink-0" title="Re-check the current access status">
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
      ) : activeVersion ? (
        <div className="rounded-lg border border-status-info bg-status-info/10 p-4 text-sm text-status-info flex items-center justify-between gap-3">
          <span>
            Version {activeVersion.version} is active — SafeMeds staff can now switch on VigiCloud module access for
            this company. It isn&apos;t on yet as of the last check.
          </span>
          <button onClick={load} className="flex items-center gap-1 text-xs text-status-info hover:underline flex-shrink-0" title="Re-check the current access status">
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-status-warning bg-status-warning/10 p-4 text-sm text-status-warning flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
          No active PSMF — build or upload one, then activate it. VigiCloud module access cannot be switched on
          until then.
        </div>
      )}

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : versions.length === 0 ? (
          <div className="p-12 text-center">
            <FileCheck2 className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No PSMF versions yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">Version</th>
                <th className="p-3">Title</th>
                <th className="p-3">Status</th>
                <th className="p-3">Document</th>
                <th className="p-3">Activated</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-mono text-xs text-foreground">v{v.version}</td>
                  <td className="p-3 text-foreground">{v.title}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[v.status]}`}>{v.status}</span>
                  </td>
                  <td className="p-3">
                    {v.documentId ? (
                      <button onClick={() => handlePreview(v.id)} className="text-safemeds-teal hover:underline">
                        View
                      </button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">{formatDate(v.activatedAt)}</td>
                  <td className="p-3 text-right">
                    {canManage && v.status === 'draft' && (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setBuilding(v)}
                          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                        >
                          <Hammer className="h-3.5 w-3.5" />
                          Build
                        </button>
                        {!v.documentId && (
                          <button
                            onClick={() => {
                              fileInputRef.current?.setAttribute('data-psmf-id', v.id)
                              fileInputRef.current?.click()
                            }}
                            disabled={uploadingFor === v.id}
                            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                          >
                            {uploadingFor === v.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                            Upload
                          </button>
                        )}
                        <button
                          onClick={() => handleActivate(v.id)}
                          disabled={!v.documentId}
                          title={!v.documentId ? 'Attach a document before activating' : undefined}
                          className="rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-40"
                        >
                          Activate
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          const psmfId = fileInputRef.current?.getAttribute('data-psmf-id')
          if (file && psmfId) handleFileSelected(psmfId, file)
          e.target.value = ''
        }}
      />

      {showCreate && (
        <CreatePsmfModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            setNotice('Draft created.')
            load()
          }}
        />
      )}

      {building && (
        <BuildPsmfModal
          psmf={building}
          onClose={() => setBuilding(null)}
          onGenerated={() => {
            setBuilding(null)
            setNotice('PSMF document generated.')
            load()
          }}
        />
      )}

      {previewing && (
        <DocumentPreviewModal
          title={previewing.versions[0]?.filename ?? previewing.title}
          filename={previewing.versions[0]?.filename ?? 'psmf.pdf'}
          contentType={previewing.versions[0]?.contentType ?? ''}
          getUrl={() => getDownloadUrl(previewing.id, previewing.versions[0]!.id)}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  )
}

function CreatePsmfModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = title.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await createPsmf({ title: title.trim(), summary: summary.trim() || undefined })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this draft.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">New PSMF Draft</h2>
        <p className="text-xs text-muted-foreground">Create it with your QPPV, or upload an existing PSMF document — either way, start with a title.</p>

        <div>
          <label className={labelClass}>Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. SafeMeds PSMF v1" className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Summary</label>
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className={inputClass} />
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
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
