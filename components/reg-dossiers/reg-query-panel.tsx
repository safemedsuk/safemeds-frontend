'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  Loader2,
  MessageSquare,
  Plus,
  StickyNote,
  Upload,
  User as UserIcon,
} from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { listDocuments, getDownloadUrl } from '@/lib/api/documents'
import {
  addRegQueryCorrespondence,
  assignRegQueryOwner,
  closeRegQuery,
  listRegQueries,
  listRegQueryCorrespondence,
  receiveRegQuery,
  respondRegQuery,
  setRegQueryDueDate,
  type RegQuery,
  type RegQueryCorrespondence,
} from '@/lib/api/reg-dossiers'
import { listUsers, type TenantUser } from '@/lib/api/users'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { DocumentPreviewModal } from '@/components/ui/document-preview-modal'
import { Modal } from '@/components/ui/modal'

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString()
}

/**
 * The backend's `responseDueDate` is a `@db.Date` Prisma field, which
 * still serializes over JSON as a full ISO datetime
 * (`"2026-10-15T00:00:00.000Z"`), not a bare `"2026-10-15"`. A native
 * `<input type="date">` silently rejects any value that isn't exactly
 * `YYYY-MM-DD` and falls back to showing its own placeholder
 * ("dd/mm/yyyy") — the real root cause of a real-usage report that a
 * freshly-set due date displayed as the literal placeholder text
 * instead of the date that was actually saved.
 */
function toDateInputValue(value: string | null): string {
  return value ? value.slice(0, 10) : ''
}

/** Only users who actually hold `regulatory.manage_dossier` can ever act on an assigned query (the backend's `respond`/`close`/`due-date`/`owner` endpoints all require it) — restricting the owner picker to this set is what actually prevents assigning an "owner" who will then find every action silently inaccessible, the real root cause behind a real-usage report of a named owner never seeing a Respond button at all. */
function canOwnRegQueries(user: TenantUser): boolean {
  return user.roleKeys.includes('REGULATORY_AFFAIRS_OFFICER')
}

const STATUS_LABEL: Record<RegQuery['status'], string> = {
  open: 'Open',
  in_progress: 'In Progress',
  responded: 'Responded',
  closed: 'Closed',
}

function StatusBadge({ query }: { query: RegQuery }) {
  if (query.isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-status-error/10 px-2 py-0.5 text-[11px] font-medium text-status-error">
        <AlertTriangle className="h-3 w-3" /> Overdue
      </span>
    )
  }
  const tone =
    query.status === 'closed'
      ? 'bg-status-success/10 text-status-success'
      : query.status === 'responded'
        ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
        : 'bg-status-warning/10 text-status-warning'
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>{STATUS_LABEL[query.status]}</span>
}

/**
 * A real-usage report found a just-set due date rendering as the raw
 * "dd/mm/yyyy" placeholder, and an owner field appearing to show the
 * wrong person after a reload — both traced to the same underlying
 * cause: the previous inline inputs used React's **uncontrolled**
 * `defaultValue`, which is only ever applied once at the DOM node's
 * first mount. Since each query row keeps the same `<li key={q.id}>`
 * across a `load()` refresh, React reuses the same `<input>`/`<select>`
 * node rather than remounting it — so neither element ever picked up a
 * freshly-fetched `responseDueDate`/`ownerUserId` after the first
 * render. These two small components hold real, fully **controlled**
 * state instead, explicitly re-synced via `useEffect` whenever the
 * underlying query data actually changes.
 */
function DueDateField({ query, onSave }: { query: RegQuery; onSave: (value: string) => void }) {
  const [value, setValue] = useState(toDateInputValue(query.responseDueDate))

  useEffect(() => {
    setValue(toDateInputValue(query.responseDueDate))
  }, [query.responseDueDate])

  return (
    <input
      type="date"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={(e) => {
        if (e.target.value && e.target.value !== toDateInputValue(query.responseDueDate)) onSave(e.target.value)
      }}
      className="rounded border border-input bg-background px-1.5 py-0.5 text-xs text-foreground"
    />
  )
}

function OwnerField({ query, users, onSave }: { query: RegQuery; users: TenantUser[]; onSave: (userId: string) => void }) {
  const [value, setValue] = useState(query.ownerUserId ?? '')
  const assignable = users.filter(canOwnRegQueries)
  // The query's own currently-assigned owner is always offered even if
  // they no longer qualify (e.g. a role change since assignment) —
  // never silently hides who it's actually assigned to.
  const currentOwner = users.find((u) => u.id === query.ownerUserId)
  const options = currentOwner && !assignable.some((u) => u.id === currentOwner.id) ? [currentOwner, ...assignable] : assignable

  useEffect(() => {
    setValue(query.ownerUserId ?? '')
  }, [query.ownerUserId])

  return (
    <select
      value={value}
      onChange={(e) => {
        setValue(e.target.value)
        onSave(e.target.value)
      }}
      className="rounded border border-input bg-background px-1.5 py-0.5 text-xs text-foreground"
    >
      <option value="">Unassigned</option>
      {options.map((u) => (
        <option key={u.id} value={u.id}>
          {u.fullName}
          {canOwnRegQueries(u) ? '' : ' (cannot respond — missing permission)'}
        </option>
      ))}
    </select>
  )
}

/**
 * RegCloud (Phase 12) Stage 5 — Query & Assessment, extended by CEO
 * feedback, 30 Sep 2026 (real-usage query-register review): a real
 * response due date (manual for now — see the module doc comment on
 * `RegQueryService`), named/reassignable ownership, a genuine
 * multi-round correspondence thread, and the widened
 * open→in_progress→responded→closed lifecycle. `RegWorkflowGuards` is
 * what actually gates the dossier's own workflow transitions on this
 * data existing; this panel is where a regulatory affairs officer logs/
 * owns/answers/closes a query.
 */
export function RegQueryPanel({ dossierId, onChanged, respondWithNoteOnly = false }: { dossierId: string; onChanged: () => void; respondWithNoteOnly?: boolean }) {
  const { has } = usePermissions()
  const canManage = has('regulatory.manage_dossier')

  const [queries, setQueries] = useState<RegQuery[]>([])
  const [users, setUsers] = useState<TenantUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showLogQuery, setShowLogQuery] = useState(false)
  const [respondingTo, setRespondingTo] = useState<RegQuery | null>(null)
  const [closingQuery, setClosingQuery] = useState<RegQuery | null>(null)
  const [threadFor, setThreadFor] = useState<RegQuery | null>(null)
  const [previewing, setPreviewing] = useState<{ title: string; filename: string; contentType: string; getUrl: () => Promise<string> } | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([listRegQueries(dossierId), listUsers({ limit: 100 }).catch(() => ({ users: [], meta: undefined as never }))])
      .then(([q, u]) => {
        setQueries(q)
        setUsers(u.users)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load queries.')))
      .finally(() => setLoading(false))
  }, [dossierId])

  useEffect(load, [load])

  const previewDoc = async (recordType: 'reg_query', recordId: string, documentId: string, title: string) => {
    const docs = await listDocuments(recordType, recordId)
    const doc = docs.find((d) => d.id === documentId)
    const latest = doc?.versions[0]
    if (!doc || !latest) return
    setPreviewing({ title, filename: latest.filename, contentType: latest.contentType, getUrl: () => getDownloadUrl(doc.id, latest.id) })
  }

  const setDueDate = async (query: RegQuery, value: string) => {
    if (!value) return
    try {
      await setRegQueryDueDate(dossierId, query.id, value)
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not set the response due date.'))
    }
  }

  const assignOwner = async (query: RegQuery, ownerUserId: string) => {
    try {
      await assignRegQueryOwner(dossierId, query.id, ownerUserId || null)
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not assign an owner.'))
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
            <p className="text-xs text-[var(--text-muted)]">Every query the regulator raised — due date, owner, the full correspondence thread, and how it was answered.</p>
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
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <StatusBadge query={q} />
                    {q.queryLetterDocumentId && (
                      <button
                        onClick={() => previewDoc('reg_query', q.id, q.queryLetterDocumentId!, 'Regulator Query Letter')}
                        className="flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" /> Letter
                      </button>
                    )}
                  </div>
                </div>

                <div className="ml-6 flex flex-wrap items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 text-[var(--text-muted)]">
                    <Clock className="h-3.5 w-3.5" />
                    Due:
                    {canManage ? (
                      <DueDateField query={q} onSave={(value) => setDueDate(q, value)} />
                    ) : (
                      <span>{q.responseDueDate ? formatDate(q.responseDueDate) : '—'}</span>
                    )}
                  </label>
                  <label className="flex items-center gap-1.5 text-[var(--text-muted)]">
                    <UserIcon className="h-3.5 w-3.5" />
                    Owner:
                    {canManage ? (
                      <OwnerField query={q} users={users} onSave={(userId) => assignOwner(q, userId)} />
                    ) : (
                      <span>{users.find((u) => u.id === q.ownerUserId)?.fullName ?? 'Unassigned'}</span>
                    )}
                  </label>
                  <button onClick={() => setThreadFor(q)} className="flex items-center gap-1 font-medium text-[var(--primary)] hover:underline">
                    <MessageSquare className="h-3.5 w-3.5" /> Correspondence Thread
                  </button>
                </div>

                <div className="ml-6 space-y-1">
                  {(q.status === 'responded' || q.status === 'closed') && (
                    <>
                      {q.responseNote && (
                        <p className="flex items-start gap-1 text-xs text-[var(--text)]">
                          <StickyNote className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-[var(--text-muted)]" />
                          {q.responseNote}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                        {q.respondedDate && <span>Responded {formatDate(q.respondedDate)}</span>}
                        {q.responseDocumentId && (
                          <button
                            onClick={() => previewDoc('reg_query', q.id, q.responseDocumentId!, 'Query Response')}
                            className="flex items-center gap-1 font-medium text-[var(--primary)] hover:underline"
                          >
                            <FileText className="h-3.5 w-3.5" /> View response
                          </button>
                        )}
                        {canManage && q.status === 'responded' && (
                          <button onClick={() => setClosingQuery(q)} className="font-medium text-status-success hover:underline">
                            Close
                          </button>
                        )}
                        {q.status === 'closed' && q.closedAt && <span>Closed {formatDate(q.closedAt)}</span>}
                      </div>
                    </>
                  )}
                  {(q.status === 'open' || q.status === 'in_progress') && canManage && (
                    <button onClick={() => setRespondingTo(q)} className="flex items-center gap-1 text-xs font-medium text-status-warning hover:underline">
                      <Upload className="h-3.5 w-3.5" /> Respond
                    </button>
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

      {threadFor && (
        <CorrespondenceThreadModal
          dossierId={dossierId}
          query={threadFor}
          canManage={canManage}
          onClose={() => setThreadFor(null)}
          onLogged={() => {
            load()
            onChanged()
          }}
        />
      )}

      {respondingTo && (
        <RespondToQueryModal
          dossierId={dossierId}
          query={respondingTo}
          fileRequired={!respondWithNoteOnly}
          onClose={() => setRespondingTo(null)}
          onResponded={() => {
            setRespondingTo(null)
            load()
            onChanged()
          }}
        />
      )}

      {closingQuery && (
        <CloseQueryModal
          dossierId={dossierId}
          query={closingQuery}
          onClose={() => setClosingQuery(null)}
          onClosed={() => {
            setClosingQuery(null)
            load()
            onChanged()
          }}
        />
      )}

      {showLogQuery && (
        <LogQueryModal
          dossierId={dossierId}
          users={users}
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

/** testing-correction-explanation.md §2.1 — the regulator's own scanned query letter is now a mandatory upload. CEO feedback, 30 Sep 2026 — an optional response due date and owner can be set at the same time. */
function LogQueryModal({ dossierId, users, onClose, onLogged }: { dossierId: string; users: TenantUser[]; onClose: () => void; onLogged: () => void }) {
  const [queryText, setQueryText] = useState('')
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [responseDueDate, setResponseDueDate] = useState('')
  const [ownerUserId, setOwnerUserId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = queryText.trim().length > 0 && receivedDate.trim().length > 0 && file !== null

  const submit = async () => {
    if (!canSubmit || !file) return
    setSaving(true)
    setError(null)
    try {
      await receiveRegQuery(dossierId, {
        queryText: queryText.trim(),
        receivedDate,
        file,
        responseDueDate: responseDueDate || undefined,
        ownerUserId: ownerUserId || undefined,
      })
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Received on</label>
            <input
              type="date"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Response due (optional)</label>
            <input
              type="date"
              value={responseDueDate}
              onChange={(e) => setResponseDueDate(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">Owner (optional)</label>
          <select
            value={ownerUserId}
            onChange={(e) => setOwnerUserId(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="">Unassigned</option>
            {users.filter(canOwnRegQueries).map((u) => (
              <option key={u.id} value={u.id}>{u.fullName}</option>
            ))}
          </select>
          {users.length > 0 && users.filter(canOwnRegQueries).length === 0 && (
            <p className="mt-1 text-xs text-status-warning">
              No one in this company holds the Regulatory Affairs Officer role yet — a query can be logged without an owner and assigned later once someone does.
            </p>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">Regulator&apos;s query letter</label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input px-3 py-2 text-xs text-muted-foreground">
            <Upload className="h-3.5 w-3.5" /> {file ? file.name : 'Upload the scanned query letter'}
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-xs text-status-error">{error}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit || saving}
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

/** CEO feedback, 30 Sep 2026 — "every letter, email and document exchanged on a query kept in one thread, with dates, including follow-up questions and multiple response rounds." */
function CorrespondenceThreadModal({
  dossierId,
  query,
  canManage,
  onClose,
  onLogged,
}: {
  dossierId: string
  query: RegQuery
  canManage: boolean
  onClose: () => void
  onLogged: () => void
}) {
  const [thread, setThread] = useState<RegQueryCorrespondence[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    listRegQueryCorrespondence(dossierId, query.id).then(setThread).finally(() => setLoading(false))
  }, [dossierId, query.id])

  useEffect(load, [load])

  return (
    <Modal title="Correspondence thread" onClose={onClose}>
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <ol className="space-y-3 max-h-96 overflow-y-auto">
            {thread.map((entry) => (
              <li key={entry.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium capitalize">{entry.direction.replace(/_/g, ' ')} · {entry.channel}</span>
                  <span>{formatDate(entry.occurredOn)}</span>
                </div>
                <p className="mt-1 text-sm text-foreground">{entry.summary}</p>
              </li>
            ))}
          </ol>
        )}
        {canManage && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-input px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" /> Log correspondence
          </button>
        )}
      </div>
      {showAdd && (
        <AddCorrespondenceModal
          dossierId={dossierId}
          query={query}
          onClose={() => setShowAdd(false)}
          onLogged={() => {
            setShowAdd(false)
            load()
            onLogged()
          }}
        />
      )}
    </Modal>
  )
}

function AddCorrespondenceModal({
  dossierId,
  query,
  onClose,
  onLogged,
}: {
  dossierId: string
  query: RegQuery
  onClose: () => void
  onLogged: () => void
}) {
  const [direction, setDirection] = useState<RegQueryCorrespondence['direction']>('to_regulator')
  const [channel, setChannel] = useState<RegQueryCorrespondence['channel']>('email')
  const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().slice(0, 10))
  const [summary, setSummary] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = summary.trim().length > 0 && occurredOn.trim().length > 0

  const submit = async () => {
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      await addRegQueryCorrespondence(dossierId, query.id, { direction, channel, occurredOn, summary: summary.trim(), file: file ?? undefined })
      onLogged()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not log this correspondence.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Log correspondence" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Direction</label>
            <select value={direction} onChange={(e) => setDirection(e.target.value as RegQueryCorrespondence['direction'])} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground">
              <option value="from_regulator">From the regulator</option>
              <option value="to_regulator">To the regulator</option>
              <option value="internal_note">Internal note</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Channel</label>
            <select value={channel} onChange={(e) => setChannel(e.target.value as RegQueryCorrespondence['channel'])} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground">
              <option value="letter">Letter</option>
              <option value="email">Email</option>
              <option value="phone">Phone call</option>
              <option value="portal">Regulator portal</option>
              <option value="note">Note</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">Date</label>
          <input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">Summary</label>
          <textarea autoFocus value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">Document (optional)</label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input px-3 py-2 text-xs text-muted-foreground">
            <Upload className="h-3.5 w-3.5" /> {file ? file.name : 'Attach a document'}
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-xs text-status-error">{error}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">Cancel</button>
          <button onClick={submit} disabled={!canSubmit || saving} className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Log
          </button>
        </div>
      </div>
    </Modal>
  )
}

/**
 * testing-correction-explanation.md §2.1 — a real note, a real responded
 * date, and (except for `client_handles_queries`, where `fileRequired`
 * is false — the client fielded the regulator directly and there may be
 * no document to share) a real response document, all required.
 */
function RespondToQueryModal({
  dossierId,
  query,
  fileRequired,
  onClose,
  onResponded,
}: {
  dossierId: string
  query: RegQuery
  fileRequired: boolean
  onClose: () => void
  onResponded: () => void
}) {
  const [note, setNote] = useState('')
  const [respondedDate, setRespondedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = note.trim().length > 0 && respondedDate.trim().length > 0 && (!fileRequired || file !== null)

  const submit = async () => {
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      await respondRegQuery(dossierId, query.id, note.trim(), respondedDate, file ?? undefined)
      onResponded()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not record this response.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Respond to regulator query" onClose={onClose}>
      <div className="space-y-4">
        {!fileRequired && (
          <p className="text-xs text-muted-foreground">
            This dossier is engaged as &quot;client handles queries&quot; — the client fields the regulator&apos;s follow-up questions
            directly. A document is optional; the note below is what proves how it was resolved.
          </p>
        )}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">How was this resolved?</label>
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="e.g. Provided the requested stability data on 23 Aug."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">Responded on</label>
          <input
            type="date"
            value={respondedDate}
            onChange={(e) => setRespondedDate(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">Response document{fileRequired ? '' : ' (optional)'}</label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input px-3 py-2 text-xs text-muted-foreground">
            <Upload className="h-3.5 w-3.5" /> {file ? file.name : 'Upload the response document'}
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-xs text-status-error">{error}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit || saving}
            className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Response
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** CEO feedback, 30 Sep 2026 — the register's own separate, deliberate "closed" state, reachable only once a response is on file. */
function CloseQueryModal({ dossierId, query, onClose, onClosed }: { dossierId: string; query: RegQuery; onClose: () => void; onClosed: () => void }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      await closeRegQuery(dossierId, query.id, note.trim() || undefined)
      onClosed()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not close this query.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Close this query" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          A response is already on file — this formally files the query away. You can leave a closing note (e.g. a regulator confirmation).
        </p>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Closing note (optional)" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" />
        {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-xs text-status-error">{error}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">Cancel</button>
          <button onClick={submit} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-status-success px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Close Query
          </button>
        </div>
      </div>
    </Modal>
  )
}
