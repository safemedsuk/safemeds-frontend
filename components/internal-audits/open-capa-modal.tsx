'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { CapaAllocationFields, CapaAllocationDraft, EMPTY_CAPA_DRAFT, draftToAllocationInput, isCapaDraftValid } from '@/components/capa/capa-allocation-fields'
import { CapaAllocationInput } from '@/lib/api/capa-allocation'
import { getErrorMessage } from '@/lib/api/client'
import { createCapa } from '@/lib/api/internal-audits'
import { useTranslation } from '@/lib/i18n/use-translation'

interface Props {
  /**
   * When set (opened from a specific finding's own "Open CAPA" action), the
   * created CAPA is linked to that finding via `Capa.findingId`. When omitted
   * (the generic CAPAs tab), it's created standalone.
   */
  findingId?: string
  /**
   * Where the allocated CAPA is sent. Defaults to the standalone/finding
   * `POST /capas`; the Deviation, OOS/OOT and Complaint screens pass their own
   * record-scoped opener, so every CAPA goes through the same form and rules.
   */
  submit?: (input: CapaAllocationInput) => Promise<unknown>
  /** Optional line shown above the form, e.g. which deviation or OOS this CAPA is for. */
  contextNote?: string
  onClose: () => void
  onOpened: () => void
}

/** Pass A2 — the one CAPA opener modal. Replaces the old "Title" form everywhere. */
export function OpenCapaModal({ findingId, submit, contextNote, onClose, onOpened }: Props) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<CapaAllocationDraft>(EMPTY_CAPA_DRAFT)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = isCapaDraftValid(draft)

  const handleSubmit = async () => {
    if (!isValid || submitting) return
    setSubmitting(true)
    setError(null)
    const input = draftToAllocationInput(draft)
    try {
      if (submit) {
        await submit(input)
      } else {
        await createCapa({ ...input, findingId })
      }
      onOpened()
    } catch (err) {
      setError(getErrorMessage(err, t('openCapaModal.errorOpen')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">{t('openCapaModal.title')}</h2>
        {findingId && <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2">{t('openCapaModal.linkedToFindingNote')}</p>}

        <CapaAllocationFields value={draft} onChange={setDraft} contextNote={contextNote} />

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('internalAuditDetail.open')}
          </button>
        </div>
      </div>
    </div>
  )
}
