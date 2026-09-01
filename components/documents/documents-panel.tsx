'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, Upload, Download, Loader2, History, ChevronDown, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { listDocuments, uploadDocument, getDownloadUrl, type DocumentVersion, type DocumentWithVersions } from '@/lib/api/documents'
import { DocumentPreviewModal } from '@/components/ui/document-preview-modal'

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentsPanel({
  recordType,
  recordId,
  onUploaded,
}: {
  recordType: string
  recordId: string
  /** Fires after a successful upload — this panel manages its own `documents` state entirely internally, so a parent tracking the same record's documents separately (e.g. for a "link as source" flow) has no other way to know a new one just landed without a full page reload. */
  onUploaded?: () => void
}) {
  const { has } = usePermissions()
  const canManage = has('documents.manage')
  const canView = has('documents.view')

  const [documents, setDocuments] = useState<DocumentWithVersions[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showNewForm, setShowNewForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const newVersionDocId = useRef<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setDocuments(await listDocuments(recordType, recordId))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load documents.'))
    } finally {
      setLoading(false)
    }
  }, [recordType, recordId])

  useEffect(() => {
    if (canView) load()
  }, [canView, load])

  const handleFilePicked = async (file: File) => {
    const documentId = newVersionDocId.current ?? undefined
    const title = documentId ? undefined : newTitle.trim()
    if (!documentId && !title) {
      setError('Give the document a title first.')
      return
    }
    setUploading(documentId ? `version:${documentId}` : 'new')
    setError(null)
    try {
      await uploadDocument(recordType, recordId, file, { title, documentId })
      setShowNewForm(false)
      setNewTitle('')
      newVersionDocId.current = null
      await load()
      onUploaded?.()
    } catch (err) {
      setError(getErrorMessage(err, 'Upload failed.'))
    } finally {
      setUploading(null)
    }
  }

  const [previewing, setPreviewing] = useState<{ documentId: string; version: DocumentVersion } | null>(null)

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!canView) return null

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-[var(--primary)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text)]">Documents</h2>
            <p className="text-xs text-[var(--text-muted)]">
              Every upload is a new version — nothing is ever overwritten, and every file is hashed on arrival.
            </p>
          </div>
        </div>
        {canManage && (
          <button
            onClick={() => {
              newVersionDocId.current = null
              setShowNewForm(true)
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--primary)] text-white flex items-center gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" /> Add document
          </button>
        )}
      </div>

      {error && <div className="m-5 p-3 rounded-lg bg-status-error/10 border border-status-error text-status-error text-sm">{error}</div>}

      {showNewForm && (
        <div className="mx-5 mt-5 p-4 rounded-lg border border-[var(--border)] bg-[var(--bg)] space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Title</label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Pharmacovigilance System Master File"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text)] text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNewForm(false)} className="px-3 py-2 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text)]">
              Cancel
            </button>
            <button
              disabled={!newTitle.trim() || uploading === 'new'}
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 rounded-lg bg-[var(--primary)] text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5"
            >
              {uploading === 'new' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Choose file & upload
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFilePicked(file)
          e.target.value = ''
        }}
      />

      <div className="p-2">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-[var(--text-muted)]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-muted)]">No documents yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {documents.map((doc) => {
              const latest = doc.versions[0]
              const isExpanded = expanded.has(doc.id)
              return (
                <li key={doc.id} className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <button onClick={() => toggleExpanded(doc.id)} className="flex items-center gap-2 min-w-0 text-left flex-1">
                      {isExpanded ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" /> : <ChevronRight className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" />}
                      <FileText className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" />
                      <span className="text-sm font-medium text-[var(--text)] truncate">{doc.title}</span>
                      <span className="text-xs text-[var(--text-muted)] flex-shrink-0">v{latest?.version ?? '—'}</span>
                      {latest?.status === 'stored' && <CheckCircle2 className="h-3.5 w-3.5 text-[var(--ok)] flex-shrink-0" />}
                      {latest?.status === 'failed' && <AlertCircle className="h-3.5 w-3.5 text-status-error flex-shrink-0" />}
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {latest?.status === 'stored' && (
                        <button
                          onClick={() => setPreviewing({ documentId: doc.id, version: latest })}
                          className="p-1.5 rounded-md hover:bg-[var(--surface-raised)] text-[var(--text-muted)] hover:text-[var(--text)]"
                          title="View"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canManage && (
                        <button
                          onClick={() => {
                            newVersionDocId.current = doc.id
                            fileInputRef.current?.click()
                          }}
                          disabled={uploading === `version:${doc.id}`}
                          className="p-1.5 rounded-md hover:bg-[var(--surface-raised)] text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50"
                          title="Upload a new version"
                        >
                          {uploading === `version:${doc.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <History className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-2 ml-6 space-y-1.5">
                      {doc.versions.map((v) => (
                        <div key={v.id} className="flex items-center justify-between gap-3 text-xs text-[var(--text-muted)] py-1">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="font-mono">v{v.version}</span>
                            <span className="truncate">{v.filename}</span>
                            <span>{formatBytes(v.sizeBytes)}</span>
                            <span
                              className={
                                v.status === 'stored'
                                  ? 'text-[var(--ok)]'
                                  : v.status === 'failed'
                                    ? 'text-status-error'
                                    : 'text-status-warning'
                              }
                            >
                              {v.status}
                            </span>
                          </span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {v.sha256 && <span className="font-mono" title={v.sha256}>{v.sha256.slice(0, 10)}…</span>}
                            {v.status === 'stored' && (
                              <button onClick={() => setPreviewing({ documentId: doc.id, version: v })} className="text-[var(--primary)] hover:underline">
                                View
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {previewing && (
        <DocumentPreviewModal
          title={previewing.version.filename}
          filename={previewing.version.filename}
          contentType={previewing.version.contentType}
          getUrl={() => getDownloadUrl(previewing.documentId, previewing.version.id)}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  )
}
