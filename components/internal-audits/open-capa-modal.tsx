'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { createCapa } from '@/lib/api/internal-audits'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

interface Props {
  /**
   * testing-todo Stage 16.3 — when set (opened from a specific finding's
   * own "Open CAPA" action), the created CAPA is linked to it via the
   * backend's already-existing `Capa.findingId` — `CapaService.create()`
   * has accepted this since Stage 16 shipped; the gap was purely that no
   * frontend entry point ever passed it. When omitted (opened from the
   * generic CAPAs tab), the CAPA is created standalone, exactly as
   * before.
   */
  findingId?: string
  onClose: () => void
  onOpened: () => void
}

/** Shared by the CAPAs tab's generic "Open CAPA" action and a specific finding's own "Open CAPA" action — see `findingId` above for the one behavioral difference between the two call sites. */
export function OpenCapaModal({ findingId, onClose, onOpened }: Props) {
  const [title, setTitle] = useState('')
  const [correctiveAction, setCorrectiveAction] = useState('')
  const [preventiveAction, setPreventiveAction] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = title.trim().length > 0 && correctiveAction.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await createCapa({
        findingId,
        title: title.trim(),
        correctiveAction: correctiveAction.trim(),
        preventiveAction: preventiveAction.trim() || undefined,
        dueDate: dueDate || undefined,
      })
      onOpened()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not open this CAPA.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">Open CAPA</h2>
        {findingId && (
          <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2">
            This CAPA will be linked to the finding it&apos;s being opened against — the finding will show as
            &quot;CAPA assigned&quot; once this is saved, and will close automatically once this CAPA does.
          </p>
        )}

        <div>
          <label className={labelClass}>Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Corrective Action *</label>
          <textarea value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} rows={2} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Preventive Action</label>
          <textarea value={preventiveAction} onChange={(e) => setPreventiveAction(e.target.value)} rows={2} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Due Date</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
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
            Open
          </button>
        </div>
      </div>
    </div>
  )
}
