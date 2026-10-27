'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Paperclip } from 'lucide-react'
import { listDocuments, DocumentWithVersions } from '@/lib/api/documents'
import { uploadRecordFile } from '@/lib/api/capa-allocation'
import { getErrorMessage } from '@/lib/api/client'
import { useTranslation } from '@/lib/i18n/use-translation'

interface Props {
  /** Heading for the section, e.g. "Investigation report". */
  title: string
  /** Plain-language line explaining what this document is for and whether it is required. */
  description: string
  /** Record-scoped route that performs the upload AND writes the audit entry (e.g. `/quality/deviations/:id/investigation/report`). */
  uploadPath: string
  /** The `Document.recordType` the attached files are stored under, used to list what is already attached. */
  listRecordType: string
  recordId: string
  /** Called after a successful upload so the parent can refresh gate state. */
  onUploaded?: () => void
  /** Hide the upload control for users without the permission (the backend still enforces it). */
  canUpload: boolean
}

/**
 * Pass A2 — the one evidence control the quality record screens share. Every
 * upload goes through a dedicated route that performs the access check and
 * writes its own audit entry; the list is the existing per-record documents read.
 */
export function RecordDocumentUpload({ title, description, uploadPath, listRecordType, recordId, onUploaded, canUpload }: Props) {
  const { t } = useTranslation()
  const [documents, setDocuments] = useState<DocumentWithVersions[] | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    try {
      setDocuments(await listDocuments(listRecordType, recordId))
    } catch {
      setDocuments([])
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listRecordType, recordId])

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      await uploadRecordFile(uploadPath, file)
      await load()
      onUploaded?.()
    } catch (err) {
      setError(getErrorMessage(err, t('recordDocumentUpload.errorUpload')))
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div>
        <h4 className="font-display font-bold text-sm text-foreground">{title}</h4>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>

      {documents === null ? (
        <p className="text-xs text-muted-foreground">{t('recordDocumentUpload.loadingAttached')}</p>
      ) : documents.length === 0 ? (
        <p className="text-xs text-status-warning">{t('recordDocumentUpload.noDocumentYet')}</p>
      ) : (
        <ul className="space-y-1">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center gap-2 text-xs text-foreground">
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate">{d.title}</span>
            </li>
          ))}
        </ul>
      )}

      {canUpload && (
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            disabled={uploading}
            onChange={(e) => void handleFile(e.target.files?.[0])}
            className="text-xs text-muted-foreground file:mr-2 file:rounded-lg file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-xs file:text-foreground"
          />
          {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      )}
      {error && <p className="text-xs text-status-error">{error}</p>}
    </div>
  )
}
