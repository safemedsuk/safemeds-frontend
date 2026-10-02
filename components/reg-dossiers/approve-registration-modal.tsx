'use client'

import { useEffect, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { uploadDocument } from '@/lib/api/documents'
import { listLocalRepresentatives, listManufacturingSites, type LocalRepresentative, type ManufacturingSite } from '@/lib/api/regulatory'
import { postTransition } from '@/lib/api/workflow'
import { Modal } from '@/components/ui/modal'
import { SignatureModal } from '@/components/ui/signature-modal'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'

function FileField({ label, file, onChange }: { label: string; file: File | null; onChange: (f: File | null) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-foreground">
        {label} <span className="text-status-error">*</span>
      </label>
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input px-3 py-2 text-xs text-muted-foreground">
        <Upload className="h-3.5 w-3.5" /> {file ? file.name : `Upload ${label.toLowerCase()}`}
        <input type="file" className="hidden" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      </label>
    </div>
  )
}

/**
 * RegCloud (Phase 12) Stage 6 — the custom trigger for the `→ approved`
 * transition, wired through `WorkflowActionsPanel`'s own `customTriggers`
 * prop. Collects whatever data `RegWorkflowGuards`' own status-sync
 * function needs (a registration number for a brand-new registration —
 * never asked for a variation/renewal, which already has one) via the
 * generic `payload` mechanism, then reuses `SignatureModal` exactly as
 * every other signature-gated transition on this app does — this is a
 * two-step flow (collect data, then sign) not a bespoke approval engine.
 *
 * testing-correction-explanation.md §2.2 — "approval should also require
 * uploading a proof of payment / invoice / success/approval document" —
 * `RegWorkflowGuards.requireApprovalData` now unconditionally requires a
 * real `approvalEvidenceDocumentId` (the regulator's own approval/success
 * letter), and — only for a brand-new registration, never a
 * variation/renewal, which was already approved once — also
 * `approvalPaymentProofDocumentId`/`approvalInvoiceDocumentId`. All three
 * are uploaded here against the dossier itself (the same
 * `(reg_dossier, dossierId)` holding pair `DocumentsPanel` already uses on
 * this same page) before signing, then threaded through as document-id
 * fields on the same `payload` the registration-number fields already use.
 */
export function ApproveRegistrationModal({
  workflowInstanceId,
  dossierId,
  toStateName,
  isVariation,
  onClose,
  onApproved,
}: {
  workflowInstanceId: string
  dossierId: string
  toStateName: string
  isVariation: boolean
  onClose: () => void
  onApproved: () => void
}) {
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [issuedOn, setIssuedOn] = useState(() => new Date().toISOString().slice(0, 10))
  const [expiresOn, setExpiresOn] = useState('')
  const [manufacturingSiteId, setManufacturingSiteId] = useState('')
  const [localRepresentativeId, setLocalRepresentativeId] = useState('')
  const [sites, setSites] = useState<ManufacturingSite[]>([])
  const [reps, setReps] = useState<LocalRepresentative[]>([])
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null)
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [showSignature, setShowSignature] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    listManufacturingSites().then(({ rows }) => setSites(rows)).catch(() => setSites([]))
    listLocalRepresentatives().then(({ rows }) => setReps(rows)).catch(() => setReps([]))
  }, [])

  const canContinue =
    (isVariation || registrationNumber.trim().length > 0) && evidenceFile !== null && (isVariation || (paymentProofFile !== null && invoiceFile !== null))

  const buildPayload = async () => {
    const evidence = await uploadDocument('reg_dossier', dossierId, evidenceFile!, { title: 'Approval Evidence' })
    const extra: Record<string, string> = { approvalEvidenceDocumentId: evidence.documentId }
    if (!isVariation) {
      const [paymentProof, invoice] = await Promise.all([
        uploadDocument('reg_dossier', dossierId, paymentProofFile!, { title: 'Approval Proof of Payment' }),
        uploadDocument('reg_dossier', dossierId, invoiceFile!, { title: 'Approval Invoice' }),
      ])
      extra.approvalPaymentProofDocumentId = paymentProof.documentId
      extra.approvalInvoiceDocumentId = invoice.documentId
    }
    return {
      ...(isVariation ? {} : { registrationNumber: registrationNumber.trim(), issuedOn }),
      ...(expiresOn ? { expiresOn } : {}),
      ...(manufacturingSiteId ? { manufacturingSiteId } : {}),
      ...(localRepresentativeId ? { localRepresentativeId } : {}),
      ...extra,
    }
  }

  return (
    <>
      {!showSignature && (
        <Modal title={`Approve — ${toStateName}`} onClose={onClose}>
          <div className="space-y-4">
            {!isVariation && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-foreground">
                    Registration number <span className="text-status-error">*</span>
                  </label>
                  <input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} placeholder="e.g. PPB-2026-0001" className={inputClass} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-foreground">Issued on</label>
                  <input type="date" value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} className={inputClass} />
                </div>
              </>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Expiry date {isVariation ? '(override — leave blank to extend using the configured renewal cadence)' : '(leave blank to compute from the configured renewal cadence)'}
              </label>
              <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">Manufacturing site (optional)</label>
              <select value={manufacturingSiteId} onChange={(e) => setManufacturingSiteId(e.target.value)} className={inputClass}>
                <option value="">None</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.siteName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">Local representative (optional)</label>
              <select value={localRepresentativeId} onChange={(e) => setLocalRepresentativeId(e.target.value)} className={inputClass}>
                <option value="">None</option>
                {reps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <FileField label="Approval / success document" file={evidenceFile} onChange={setEvidenceFile} />
            {!isVariation && (
              <>
                <FileField label="Proof of payment" file={paymentProofFile} onChange={setPaymentProofFile} />
                <FileField label="Invoice" file={invoiceFile} onChange={setInvoiceFile} />
              </>
            )}
            {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-xs text-status-error">{error}</div>}
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
                Cancel
              </button>
              <button
                onClick={() => setShowSignature(true)}
                disabled={!canContinue}
                className="rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Continue to Sign
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showSignature && (
        <SignatureModal
          isOpen={true}
          onClose={() => setShowSignature(false)}
          documentTitle={`Approve — ${toStateName}`}
          documentId={workflowInstanceId}
          onSigned={async ({ signatureToken, intentStatement }) => {
            setBusy(true)
            setError(null)
            try {
              const payload = await buildPayload()
              await postTransition(workflowInstanceId, 'approved', { signatureToken, intentStatement }, undefined, payload)
              onApproved()
            } catch (err) {
              setError(getErrorMessage(err, 'Could not approve this registration.'))
              setShowSignature(false)
            } finally {
              setBusy(false)
            }
          }}
        />
      )}
      {busy && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      )}
    </>
  )
}
