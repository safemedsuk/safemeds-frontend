'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Circle, FileText, Loader2, Send, Upload } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { listDocuments } from '@/lib/api/documents'
import { attachRegSubmissionEvidence, generateRegSubmission, listRegSubmissions, type RegSubmission } from '@/lib/api/reg-dossiers'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { DocumentPreviewModal } from '@/components/ui/document-preview-modal'

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString()
}

const CHANNEL_LABELS: Record<string, string> = {
  vigiflow: 'VigiFlow',
  dhis2: 'DHIS2',
  portal: 'Regulator Portal',
  paper_pdf: 'Physical / Courier',
  email: 'Email',
}

/**
 * RegCloud (Phase 12) Stage 4 — generate a submission package (a real PDF
 * cover sheet, naming every enclosed document) and confirm dispatch with
 * real evidence — the "No Gateway" honesty VigiCloud's own E2B submission
 * established, extended to every channel a registration might go out
 * through. `RegWorkflowGuards`' own evidence gate is what actually blocks
 * `Completeness Check → Submitted` until this exists; this panel is just
 * the UI for the two actions that gate checks for.
 */
export function RegulatorySubmissionPanel({ dossierId, onGenerated }: { dossierId: string; onGenerated: () => void }) {
  const { has } = usePermissions()
  const canSubmit = has('regulatory.submit')

  const [submissions, setSubmissions] = useState<RegSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<{ title: string; filename: string; contentType: string; getUrl: () => Promise<string> } | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    listRegSubmissions(dossierId)
      .then(setSubmissions)
      .catch((err) => setError(getErrorMessage(err, 'Could not load submissions.')))
      .finally(() => setLoading(false))
  }, [dossierId])

  useEffect(load, [load])

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      await generateRegSubmission(dossierId)
      await load()
      onGenerated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not generate a submission package.'))
    } finally {
      setGenerating(false)
    }
  }

  const handleAttachEvidence = async (submissionId: string, file: File) => {
    setUploadingFor(submissionId)
    setError(null)
    try {
      await attachRegSubmissionEvidence(dossierId, submissionId, file)
      await load()
      onGenerated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not attach dispatch evidence.'))
    } finally {
      setUploadingFor(null)
    }
  }

  const previewDocument = async (recordId: string, documentId: string, title: string) => {
    const docs = await listDocuments('reg_submission', recordId)
    const doc = docs.find((d) => d.id === documentId)
    const latest = doc?.versions[0]
    if (!doc || !latest) return
    setPreviewing({
      title,
      filename: latest.filename,
      contentType: latest.contentType,
      getUrl: async () => (await import('@/lib/api/documents')).getDownloadUrl(doc.id, latest.id),
    })
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
            <Send className="h-5 w-5 text-[var(--primary)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text)]">Regulatory Submission</h2>
            <p className="text-xs text-[var(--text-muted)]">
              Generate a real cover sheet, then confirm dispatch — SafeMeds doesn&apos;t transmit to the regulator directly, a human still sends it.
            </p>
          </div>
        </div>
        {canSubmit && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {generating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {submissions.length === 0 ? 'Generate Submission' : 'Generate Resubmission'}
          </button>
        )}
      </div>

      {error && <div className="m-5 p-3 rounded-lg bg-status-error/10 border border-status-error text-status-error text-sm">{error}</div>}

      <div className="p-2">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-[var(--text-muted)]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : submissions.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-muted)]">No submission package generated yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {submissions.map((s) => (
              <li key={s.id} className="p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {s.evidenceDocumentId ? (
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-status-success" />
                  ) : (
                    <Circle className="h-4 w-4 flex-shrink-0 text-muted-foreground/40" />
                  )}
                  <span className="text-sm font-medium text-[var(--text)]">Submission #{s.submissionNumber}</span>
                  <span className="text-xs text-[var(--text-muted)]">{CHANNEL_LABELS[s.channel] ?? s.channel} · {formatDateTime(s.generatedAt)}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => previewDocument(s.id, s.coverSheetDocumentId, `Submission #${s.submissionNumber} Cover Sheet`)}
                    className="flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5" /> Cover Sheet
                  </button>
                  {s.evidenceDocumentId ? (
                    <button
                      onClick={() => previewDocument(s.id, s.evidenceDocumentId!, `Submission #${s.submissionNumber} Evidence`)}
                      className="flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" /> Evidence
                    </button>
                  ) : (
                    canSubmit && (
                      <label className="flex cursor-pointer items-center gap-1 text-xs font-medium text-status-warning hover:underline">
                        {uploadingFor === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        Attach Evidence
                        <input
                          type="file"
                          className="hidden"
                          disabled={uploadingFor !== null}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleAttachEvidence(s.id, file)
                            e.target.value = ''
                          }}
                        />
                      </label>
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {previewing && (
        <DocumentPreviewModal
          title={previewing.title}
          filename={previewing.filename}
          contentType={previewing.contentType}
          getUrl={previewing.getUrl}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  )
}
