'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Circle, FileText, Loader2, MessageSquare, Plus, StickyNote, Upload } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { listDocuments, getDownloadUrl } from '@/lib/api/documents'
import { listRegQueries, receiveRegQuery, respondRegQuery, type RegQuery } from '@/lib/api/reg-dossiers'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { DocumentPreviewModal } from '@/components/ui/document-preview-modal'
import { Modal } from '@/components/ui/modal'

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString()
}

/**
 * RegCloud (Phase 12) Stage 5 — Query & Assessment. A real correspondence
 * log: every query the regulator raised, when, its content, and — once
 * answered — the response document, all in one auditable thread.
 * `RegWorkflowGuards` is what actually gates the dossier's own workflow
 * transitions on this data existing; this panel is just where a
 * regulatory affairs officer logs/answers a query.
 *
 * `respondWithNoteOnly` (RegCloud Stage 15) — when this dossier's
 * effective engagement is `client_handles_queries`, the client fields
 * the regulator's question directly and may never share the actual
 * correspondence with SafeMeds. Swaps the plain file-upload "Respond"
 * link for a short note-entry modal instead; every other engagement
 * type keeps the original file-only flow unchanged.
 */
export function RegQueryPanel({ dossierId, onChanged, respondWithNoteOnly = false }: { dossierId: string; onChanged: () => void; respondWithNoteOnly?: boolean }) {
  const { has } = usePermissions()
  const canManage = has('regulatory.manage_dossier')

  const [queries, setQueries] = useState<RegQuery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [respondingWithNoteFor, setRespondingWithNoteFor] = useState<string | null>(null)
  const [showLogQuery, setShowLogQuery] = useState(false)
  const [respondingTo, setRespondingTo] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<{ title: string; filename: string; contentType: string; getUrl: () => Promise<string> } | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    listRegQueries(dossierId)
      .then(setQueries)
      .catch((err) => setError(getErrorMessage(err, 'Could not load queries.')))
      .finally(() => setLoading(false))
  }, [dossierId])

  useEffect(load, [load])

  const previewResponse = async (queryId: string, documentId: string, title: string) => {
    const docs = await listDocuments('reg_query', queryId)
    const doc = docs.find((d) => d.id === documentId)
    const latest = doc?.versions[0]
    if (!doc || !latest) return
    setPreviewing({ title, filename: latest.filename, contentType: latest.contentType, getUrl: () => getDownloadUrl(doc.id, latest.id) })
  }

  const handleRespond = async (queryId: string, file: File) => {
    setRespondingTo(queryId)
    setError(null)
    try {
      await respondRegQuery(dossierId, queryId, file)
      await load()
      onChanged()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not attach a response.'))
    } finally {
      setRespondingTo(null)
    }
  }

  const handleRespondWithNote = async (queryId: string, note: string) => {
    setRespondingTo(queryId)
    setError(null)
    try {
      await respondRegQuery(dossierId, queryId, undefined, note)
      setRespondingWithNoteFor(null)
      await load()
      onChanged()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not record this response.'))
    } finally {
      setRespondingTo(null)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-[var(--primary)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text)]">Correspondence Log</h2>
            <p className="text-xs text-[var(--text-muted)]">Every query the regulator raised, and how it was answered.</p>
          </div>
        </div>
        {canManage && (
          <button
            onClick={() => setShowLogQuery(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white"
          >
            <Plus className="h-3.5 w-3.5" /> Log a Query
          </button>
        )}
      </div>

      {error && <div className="m-5 p-3 rounded-lg bg-status-error/10 border border-status-error text-status-error text-sm">{error}</div>}

      <div className="p-2">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-[var(--text-muted)]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : queries.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-muted)]">No queries logged yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {queries.map((q) => (
              <li key={q.id} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    {q.status === 'closed' ? (
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-status-success" />
                    ) : (
                      <Circle className="h-4 w-4 flex-shrink-0 mt-0.5 text-status-warning" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--text)]">{q.queryText}</p>
                      <p className="text-xs text-[var(--text-muted)]">Received {formatDate(q.receivedDate)}</p>
                    </div>
                  </div>
                </div>
                <div className="ml-6 flex items-center gap-2">
                  {q.responseDocumentId ? (
                    <button
                      onClick={() => previewResponse(q.id, q.responseDocumentId!, 'Query Response')}
                      className="flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" /> View response
                    </button>
                  ) : q.responseNote ? (
                    <p className="flex items-start gap-1 text-xs text-[var(--text)]">
                      <StickyNote className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-[var(--text-muted)]" />
                      {q.responseNote}
                    </p>
                  ) : canManage && respondWithNoteOnly ? (
                    <button
                      onClick={() => setRespondingWithNoteFor(q.id)}
                      className="flex items-center gap-1 text-xs font-medium text-status-warning hover:underline"
                    >
                      <StickyNote className="h-3.5 w-3.5" /> Log how the client resolved this
                    </button>
                  ) : (
                    canManage && (
                      <label className="flex cursor-pointer items-center gap-1 text-xs font-medium text-status-warning hover:underline">
                        {respondingTo === q.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        Respond
                        <input
                          type="file"
                          className="hidden"
                          disabled={respondingTo !== null}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleRespond(q.id, file)
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

      {respondingWithNoteFor && (
        <RespondWithNoteModal
          onClose={() => setRespondingWithNoteFor(null)}
          submitting={respondingTo === respondingWithNoteFor}
          onSubmit={(note) => handleRespondWithNote(respondingWithNoteFor, note)}
        />
      )}

      {showLogQuery && (
        <LogQueryModal
          dossierId={dossierId}
          onClose={() => setShowLogQuery(false)}
          onLogged={() => {
            setShowLogQuery(false)
            load()
            onChanged()
          }}
        />
      )}
    </div>
  )
}

function LogQueryModal({ dossierId, onClose, onLogged }: { dossierId: string; onClose: () => void; onLogged: () => void }) {
  const [queryText, setQueryText] = useState('')
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!queryText.trim()) return
    setSaving(true)
    setError(null)
    try {
      await receiveRegQuery(dossierId, { queryText: queryText.trim(), receivedDate })
      onLogged()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not log this query.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Log a regulator query" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">What did the regulator ask?</label>
          <textarea
            autoFocus
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            rows={4}
            placeholder="e.g. Please clarify the CPP validity period."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">Received on</label>
          <input
            type="date"
            value={receivedDate}
            onChange={(e) => setReceivedDate(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-xs text-status-error">{error}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!queryText.trim() || saving}
            className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Log Query
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** RegCloud (Phase 12) Stage 15 — the `client_handles_queries` respond path, a note instead of a response document. */
function RespondWithNoteModal({ onClose, onSubmit, submitting }: { onClose: () => void; onSubmit: (note: string) => void; submitting: boolean }) {
  const [note, setNote] = useState('')

  return (
    <Modal title="Log how the client resolved this" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          This dossier is engaged as &quot;client handles queries&quot; — the client fields the regulator&apos;s follow-up questions directly, and the actual correspondence may never
          reach SafeMeds. Describe how it was resolved instead.
        </p>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">How was this resolved?</label>
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="e.g. The client confirmed the CPP validity directly with PPB on 23 Aug."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(note.trim())}
            disabled={!note.trim() || submitting}
            className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </Modal>
  )
}
