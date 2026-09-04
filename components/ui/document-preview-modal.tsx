'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Download, FileQuestion, Loader2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { Modal } from './modal'

interface DocumentPreviewModalProps {
  title: string
  filename: string
  /** MIME type, if known — drives which preview renderer is used. Pass an empty string when unknown; the modal falls back to a clean "no preview" state rather than guessing. */
  contentType: string
  /** Lazily resolves a fresh, short-lived signed URL — called once, when the modal opens, so a URL is never fetched (and never allowed to go stale) before the user actually asks to see this file. */
  getUrl: () => Promise<string>
  onClose: () => void
}

/**
 * Special Corner SC-3/SC-4 — the one, reusable "view a document without
 * ever navigating the user's own browser tab to a raw Cloudflare R2
 * URL" component. Every document link in this app should open this
 * modal instead of `window.open(presignedUrl)`: the file is embedded
 * in-page (an `<iframe>` for PDFs, an `<img>` for images), and the
 * "Download" action is a real `<a download>` anchor — the browser
 * downloads the bytes in the background, the address bar never
 * changes, and the user is never "sent to" Cloudflare in any visible
 * sense. Files this app can't preview inline (XML, and anything else
 * with no in-browser renderer) get an honest "no preview for this file
 * type" state — never a silent full-page redirect as the fallback.
 */
export function DocumentPreviewModal({ title, filename, contentType, getUrl, onClose }: DocumentPreviewModalProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getUrl()
      .then((resolved) => {
        if (!cancelled) setUrl(resolved)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load this document.'))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isPdf = contentType === 'application/pdf'
  const isImage = contentType.startsWith('image/')
  const canPreviewInline = isPdf || isImage

  return (
    <Modal title={title} onClose={onClose} maxWidth="max-w-4xl">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-xs text-[var(--text-muted)]" title={filename}>
            {filename}
          </p>
          {url && (
            <a
              href={url}
              download={filename}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-raised)]"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </a>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">
            <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
          </div>
        )}

        {!error && !url && (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-16 text-sm text-[var(--text-muted)]">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading preview…
          </div>
        )}

        {url && canPreviewInline && isPdf && (
          <iframe src={url} title={filename} className="h-[70vh] w-full rounded-lg border border-[var(--border)]" />
        )}

        {url && canPreviewInline && isImage && (
          <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived R2 URL isn't a static asset Next's image optimizer can cache. */}
            <img src={url} alt={filename} className="max-w-full object-contain" />
          </div>
        )}

        {url && !canPreviewInline && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-12 text-center">
            <FileQuestion className="h-10 w-10 text-[var(--text-muted)]/50" />
            <p className="text-sm text-[var(--text)]">No inline preview is available for this file type.</p>
            <p className="text-xs text-[var(--text-muted)]">Use the Download button above to view it.</p>
          </div>
        )}
      </div>
    </Modal>
  )
}
