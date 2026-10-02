'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Circle, FileCheck, Loader2, Upload } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { attachVariationInvoice, attachVariationPaymentProof, getRegVariation, type RegVariation } from '@/lib/api/reg-dossiers'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { DocumentsPanel } from '@/components/documents/documents-panel'

function UploadRow({
  label,
  done,
  busy,
  canManage,
  onPick,
}: {
  label: string
  done: boolean
  busy: boolean
  canManage: boolean
  onPick: (file: File) => void
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
      <div className="flex items-center gap-2">
        {done ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-status-success" /> : <Circle className="h-4 w-4 flex-shrink-0 text-muted-foreground/40" />}
        <span className={`text-sm ${done ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
        <span className="rounded-full bg-status-error/10 px-2 py-0.5 text-[10px] font-medium text-status-error whitespace-nowrap">Required</span>
      </div>
      {canManage && (
        <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-safemeds-teal hover:underline">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {done ? 'Replace' : 'Upload'}
          <input
            type="file"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onPick(file)
              e.target.value = ''
            }}
          />
        </label>
      )}
    </li>
  )
}

/**
 * testing-correction-explanation.md §2.2 — a Variation/Renewal dossier
 * parked at `variation_application` can't reach Submitted until three
 * documents exist: the named proof-of-payment and PPB invoice on the
 * `RegVariation` row itself, plus at least one accompanying document
 * describing the actual change — `RegWorkflowGuards`' own guard on this
 * exact state checks all three. This panel is where a regulatory affairs
 * officer satisfies it: two dedicated named-slot uploads, plus the
 * existing generic `DocumentsPanel` reused as-is (scoped to
 * `(reg_variation, variationId)`, the same record/id pair the guard's
 * own `tx.document.count()` check queries) for the accompanying
 * document(s) — no bespoke uploader for that half.
 */
export function VariationApplicationPanel({ variationId, onChanged }: { variationId: string; onChanged: () => void }) {
  const { has } = usePermissions()
  const canManage = has('regulatory.manage_variations')

  const [variation, setVariation] = useState<RegVariation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadingSlot, setUploadingSlot] = useState<'paymentProof' | 'invoice' | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getRegVariation(variationId)
      .then((v) => setVariation(v))
      .catch((err) => setError(getErrorMessage(err, 'Could not load this variation.')))
      .finally(() => setLoading(false))
  }, [variationId])

  useEffect(load, [load])

  const handleUpload = async (slot: 'paymentProof' | 'invoice', file: File) => {
    setUploadingSlot(slot)
    setError(null)
    try {
      const fn = slot === 'paymentProof' ? attachVariationPaymentProof : attachVariationInvoice
      await fn(variationId, file)
      await load()
      onChanged()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not upload this document.'))
    } finally {
      setUploadingSlot(null)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="p-5 border-b border-[var(--border)] flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
          <FileCheck className="h-5 w-5 text-[var(--primary)]" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[var(--text)]">Variation Application Requirements</h2>
          <p className="text-xs text-[var(--text-muted)]">Three documents are required before this can move to Submitted.</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {error && <div className="rounded-lg bg-status-error/10 border border-status-error p-3 text-sm text-status-error">{error}</div>}

        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : variation ? (
          <ul className="space-y-2">
            <UploadRow
              label="Proof of payment"
              done={Boolean(variation.paymentProofDocumentId)}
              busy={uploadingSlot === 'paymentProof'}
              canManage={canManage}
              onPick={(f) => handleUpload('paymentProof', f)}
            />
            <UploadRow
              label="PPB variation invoice"
              done={Boolean(variation.invoiceDocumentId)}
              busy={uploadingSlot === 'invoice'}
              canManage={canManage}
              onPick={(f) => handleUpload('invoice', f)}
            />
          </ul>
        ) : null}

        <div>
          <p className="mb-2 text-xs font-medium text-foreground">Accompanying change document(s) — at least 1 required</p>
          <DocumentsPanel recordType="reg_variation" recordId={variationId} onUploaded={onChanged} />
        </div>
      </div>
    </div>
  )
}
