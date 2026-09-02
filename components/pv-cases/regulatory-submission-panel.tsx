'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock, Download, FileText, Loader2, ShieldAlert, UploadCloud } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  attachRegulatorySubmissionEvidence,
  generateRegulatorySubmission,
  getRegulatorySubmissionDownloadUrl,
  listRegulatorySubmissions,
  RegulatorySubmission,
} from '@/lib/api/pv-cases'
import { DocumentPreviewModal } from '@/components/ui/document-preview-modal'

const ARTIFACT_META: Record<'xml' | 'pdf', { contentType: string; extension: string; label: string }> = {
  pdf: { contentType: 'application/pdf', extension: 'pdf', label: 'submission PDF' },
  xml: { contentType: 'application/xml', extension: 'xml', label: 'E2B XML' },
}

interface Props {
  caseId: string
  canGenerate: boolean
  canAttachEvidence: boolean
}

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '—'
}

/**
 * VigiCloud Stage 12 — the "Generate submission" action, per-submission
 * XML/PDF download links, and the evidence-upload step. Deliberately does
 * **not** transition the case's workflow itself — the existing
 * `WorkflowActionsPanel` already has a real "Move to Submitted" button
 * once the case is in Submission Ready, and the backend's own guard
 * (blocking that exact transition until evidence is attached here)
 * surfaces its real reason there if clicked too early.
 */
export function RegulatorySubmissionPanel({ caseId, canGenerate, canAttachEvidence }: Props) {
  const [submissions, setSubmissions] = useState<RegulatorySubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busySubmissionId, setBusySubmissionId] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<{ submissionId: string; submissionNumber: number; artifact: 'xml' | 'pdf' } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSubmissions(await listRegulatorySubmissions(caseId))
    } catch {
      // Best-effort — the case itself already loaded; a submissions-list hiccup shouldn't block the page.
    } finally {
      setLoading(false)
    }
  }, [caseId])

  useEffect(() => {
    load()
  }, [load])

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      await generateRegulatorySubmission(caseId)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not generate a submission for this case.'))
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = (submissionId: string, submissionNumber: number, artifact: 'xml' | 'pdf') => {
    setPreviewing({ submissionId, submissionNumber, artifact })
  }

  const handleAttachEvidence = async (submissionId: string, file: File) => {
    setBusySubmissionId(submissionId)
    setError(null)
    try {
      await attachRegulatorySubmissionEvidence(submissionId, file)
      await load()
    } catch (err) {
      // testing-todo 12.3 — a real server-side rejection (bad file, too
      // large, etc.) already carries a specific message via
      // `getErrorMessage()`; a raw network-level failure (dropped
      // connection, timeout) does not — previously fell back to the same
      // generic line either way, making a genuine transient network issue
      // indistinguishable from "this file is broken." The fallback here
      // now says so explicitly and points at the obvious next step,
      // rather than leaving the user to guess. The file selection itself
      // isn't cleared on failure, so retrying is just clicking the button
      // again.
      const fallback = `Could not attach this evidence file (${file.name}, ${(file.size / (1024 * 1024)).toFixed(1)}MB) — this usually means a dropped connection during upload. Check your network and try again.`
      setError(getErrorMessage(err, fallback))
    } finally {
      setBusySubmissionId(null)
    }
  }

  if (loading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-status-error">{error}</p>}

      {submissions.length === 0 ? (
        <div className="rounded-lg border border-border p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">No submission generated for this case yet.</p>
          {canGenerate && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50 whitespace-nowrap"
            >
              {generating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Generate submission
            </button>
          )}
        </div>
      ) : (
        <>
          {canGenerate && (
            <div className="flex justify-end">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                {generating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Generate resubmission
              </button>
            </div>
          )}
          {submissions.map((s) => (
            <SubmissionCard
              key={s.id}
              submission={s}
              busy={busySubmissionId === s.id}
              canAttachEvidence={canAttachEvidence}
              onDownload={(artifact) => handleDownload(s.id, s.submissionNumber, artifact)}
              onAttachEvidence={(file) => handleAttachEvidence(s.id, file)}
            />
          ))}
        </>
      )}

      {previewing && (
        <DocumentPreviewModal
          title={`${ARTIFACT_META[previewing.artifact].label} — submission ${previewing.submissionNumber}`}
          filename={`submission-${previewing.submissionNumber}.${ARTIFACT_META[previewing.artifact].extension}`}
          contentType={ARTIFACT_META[previewing.artifact].contentType}
          getUrl={() => getRegulatorySubmissionDownloadUrl(previewing.submissionId, previewing.artifact)}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  )
}

function SubmissionCard({
  submission,
  busy,
  canAttachEvidence,
  onDownload,
  onAttachEvidence,
}: {
  submission: RegulatorySubmission
  busy: boolean
  canAttachEvidence: boolean
  onDownload: (artifact: 'xml' | 'pdf') => void
  onAttachEvidence: (file: File) => void
}) {
  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {submission.submissionNumber === 1 ? 'Initial submission' : `Resubmission ${submission.submissionNumber}`}
          </span>
          <span className="text-xs text-muted-foreground">to {submission.authority.name} ({submission.authority.code})</span>
        </div>
        {submission.reportable ? (
          <span className="flex items-center gap-1 rounded-full bg-status-success/10 px-2.5 py-0.5 text-xs font-medium text-status-success">
            <CheckCircle2 className="h-3 w-3" /> Reportable
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-status-warning/10 px-2.5 py-0.5 text-xs font-medium text-status-warning">
            <ShieldAlert className="h-3 w-3" /> Not individually reportable
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{submission.reportabilityReason}</p>
      <p className="text-xs text-muted-foreground">Generated {formatDateTime(submission.generatedAt)}</p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onDownload('pdf')}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          <FileText className="h-3.5 w-3.5" /> View submission PDF
        </button>
        <button
          onClick={() => onDownload('xml')}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" /> Download E2B XML
        </button>
      </div>

      <div className="border-t border-border pt-3">
        {submission.evidenceDocumentId ? (
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-status-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> Submission evidence attached
            </span>
            <span className="text-muted-foreground">Submitted {formatDateTime(submission.submittedAt)}</span>
          </div>
        ) : canAttachEvidence ? (
          <EvidenceUploadControl busy={busy} onUpload={onAttachEvidence} />
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Awaiting upload confirmation from the authority&apos;s own portal
          </span>
        )}
      </div>
    </div>
  )
}

function EvidenceUploadControl({ busy, onUpload }: { busy: boolean; onUpload: (file: File) => void }) {
  const [file, setFile] = useState<File | null>(null)

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Once this has actually been uploaded to the authority&apos;s own portal (VigiFlow/PvERS — outside this system), attach the confirmation/acknowledgement here.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block flex-1 text-xs text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
        />
        <button
          onClick={() => file && onUpload(file)}
          disabled={busy || !file}
          className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50 whitespace-nowrap"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
          Attach evidence
        </button>
      </div>
    </div>
  )
}
