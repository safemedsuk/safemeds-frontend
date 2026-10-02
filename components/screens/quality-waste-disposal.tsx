'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  createWasteDisposalRecord,
  listActiveWasteDisposalMethods,
  listWasteDisposalRecords,
  witnessWasteDisposalRecord,
  WasteDisposalMethodCatalogEntry,
  WasteDisposalRecord,
} from '@/lib/api/quality'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { SignatureModal } from '@/components/ui/signature-modal'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const WASTE_TYPE_LABELS: Record<string, string> = {
  expired_stock: 'Expired Stock',
  rejected_batch: 'Rejected Batch',
  recalled_stock: 'Recalled Stock',
  sampling_residue: 'Sampling Residue',
  other: 'Other',
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

/**
 * QualCloud (Phase 13) Stage 15 — Pharmaceutical Waste Management.
 * Genuinely, honestly generic — no real PPB waste-disposal procedure
 * document exists anywhere in this project's reference material, so
 * the disposal-method catalog is a plain, jurisdiction-agnostic default
 * (admin-editable, so a real PPB-sourced list can slot in later with
 * zero code change) rather than a fabricated citation.
 */
export function QualityWasteDisposalScreen() {
  const searchParams = useSearchParams()
  const presetBatchId = searchParams?.get('batchId') ?? undefined
  const { has } = usePermissions()
  const canView = has('quality.view_all')
  const canManage = has('quality.manage_waste_disposal')

  const [records, setRecords] = useState<WasteDisposalRecord[]>([])
  const [methods, setMethods] = useState<WasteDisposalMethodCatalogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showCreate, setShowCreate] = useState(Boolean(presetBatchId))
  const [witnessing, setWitnessing] = useState<WasteDisposalRecord | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([listWasteDisposalRecords({ page: 1, limit: 50 }), listActiveWasteDisposalMethods()])
      .then(([recordsRes, methodsRes]) => {
        setRecords(recordsRes.rows)
        setMethods(methodsRes)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load waste disposal records.')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">Pharmaceutical Waste Disposal</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to view waste disposal records.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Pharmaceutical Waste Disposal</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A log of expired, rejected, or recalled stock disposal — witnessed destruction optional per method.
          </p>
        </div>
        {canManage && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors">
            <Plus className="h-4 w-4" /> Log Disposal
          </button>
        )}
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <Trash2 className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No disposal records logged yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">Waste Type</th>
                <th className="p-3">Quantity</th>
                <th className="p-3">Method</th>
                <th className="p-3">Disposed</th>
                <th className="p-3">Witness</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="p-3 text-foreground">{WASTE_TYPE_LABELS[r.wasteType] ?? r.wasteType}</td>
                  <td className="p-3 text-muted-foreground">{r.quantity} {r.unit}</td>
                  <td className="p-3 text-muted-foreground capitalize">{r.disposalMethod.replace(/_/g, ' ')}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(r.disposedAt)}</td>
                  <td className="p-3">
                    {r.witnessedByUserId ? (
                      <span className="rounded-full bg-status-success/10 px-2 py-0.5 text-xs font-medium text-status-success">Witnessed</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">None</span>
                    )}
                  </td>
                  <td className="p-3">
                    {!r.witnessedByUserId && canManage && (
                      <button onClick={() => setWitnessing(r)} className="text-xs font-medium text-safemeds-teal hover:underline">
                        Sign as Witness
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateWasteDisposalModal
          methods={methods}
          presetBatchId={presetBatchId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            setNotice('Disposal logged.')
            load()
          }}
        />
      )}

      {witnessing && (
        <SignatureModal
          isOpen={true}
          onClose={() => setWitnessing(null)}
          documentTitle={`Witness disposal of ${witnessing.quantity} ${witnessing.unit}`}
          documentId={witnessing.id}
          onSigned={async ({ signatureToken, intentStatement }) => {
            await witnessWasteDisposalRecord(witnessing.id, { signatureToken, intentStatement })
            setWitnessing(null)
            setNotice('Witness signature recorded.')
            load()
          }}
        />
      )}
    </div>
  )
}

function CreateWasteDisposalModal({
  methods,
  presetBatchId,
  onClose,
  onCreated,
}: {
  methods: WasteDisposalMethodCatalogEntry[]
  presetBatchId?: string
  onClose: () => void
  onCreated: () => void
}) {
  const [wasteType, setWasteType] = useState('expired_stock')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')
  const [disposalMethod, setDisposalMethod] = useState(methods[0]?.methodKey ?? 'other')
  const [disposalFacilityName, setDisposalFacilityName] = useState('')
  const [disposedAt, setDisposedAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = quantity.trim().length > 0 && unit.trim().length > 0 && disposalMethod.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await createWasteDisposalRecord({
        batchId: presetBatchId,
        wasteType,
        quantity: quantity.trim(),
        unit: unit.trim(),
        disposalMethod,
        disposalFacilityName: disposalFacilityName.trim() || undefined,
        disposedAt: new Date(disposedAt).toISOString(),
      })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not log this disposal.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 space-y-4 my-8">
        <h2 className="font-display font-bold text-lg text-foreground">Log a Disposal</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Waste Type *</label>
            <select value={wasteType} onChange={(e) => setWasteType(e.target.value)} className={inputClass}>
              {Object.entries(WASTE_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Disposal Method *</label>
            <select value={disposalMethod} onChange={(e) => setDisposalMethod(e.target.value)} className={inputClass}>
              {methods.map((m) => (
                <option key={m.methodKey} value={m.methodKey}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Quantity *</label>
            <input value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} placeholder="e.g. 120" />
          </div>
          <div>
            <label className={labelClass}>Unit *</label>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} className={inputClass} placeholder="e.g. tablets" />
          </div>
        </div>

        <div>
          <label className={labelClass}>Disposal Facility</label>
          <input value={disposalFacilityName} onChange={(e) => setDisposalFacilityName(e.target.value)} className={inputClass} placeholder="e.g. EcoWaste Ltd" />
        </div>

        <div>
          <label className={labelClass}>Disposed On *</label>
          <input type="date" value={disposedAt} onChange={(e) => setDisposedAt(e.target.value)} className={inputClass} />
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
            Log Disposal
          </button>
        </div>
      </div>
    </div>
  )
}
