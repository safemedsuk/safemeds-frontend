'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ClipboardList, Loader2, ShieldAlert, Sparkles, Upload } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { uploadDocument } from '@/lib/api/documents'
import { Product, listProducts } from '@/lib/api/master-data'
import { activateRmp, attachRmpDocument, createRmp, listRmp, RiskManagementPlan, RiskManagementPlanStatus, updateRmpRenewal } from '@/lib/api/risk-management-plans'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { BuildRmpModal } from '@/components/rmp/build-rmp-modal'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const STATUS_STYLES: Record<RiskManagementPlanStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-status-success/10 text-status-success',
  retired: 'bg-status-info/10 text-status-info',
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

/**
 * VigiCloud Stage 18 — RMP tracker, per product. Version-on-write,
 * deliberately mirroring the PSMF screen's own table-not-list tone and
 * upload-then-activate flow — the one real structural difference is a
 * product picker up top, since an RMP's lifecycle is per-product, not
 * company-wide.
 */
export function RiskManagementPlansScreen() {
  const { has } = usePermissions()
  const canManage = has('rmp.manage')

  const [products, setProducts] = useState<Product[]>([])
  const [productId, setProductId] = useState('')
  const [versions, setVersions] = useState<RiskManagementPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showCreate, setShowCreate] = useState(false)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [editingRenewalFor, setEditingRenewalFor] = useState<string | null>(null)
  const [renewalDraft, setRenewalDraft] = useState('')
  const [buildingRmp, setBuildingRmp] = useState<RiskManagementPlan | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listProducts({ limit: 100 })
      .then(({ rows }) => setProducts(rows))
      .catch(() => setProducts([]))
  }, [])

  const load = useCallback(() => {
    if (!productId) {
      setVersions([])
      return
    }
    setLoading(true)
    setError(null)
    listRmp(productId)
      .then(setVersions)
      .catch((err) => setError(getErrorMessage(err, 'Could not load RMP versions.')))
      .finally(() => setLoading(false))
  }, [productId])

  useEffect(() => {
    load()
  }, [load])

  const activeVersion = versions.find((v) => v.status === 'active')

  const handleFileSelected = async (rmpId: string, file: File) => {
    setUploadingFor(rmpId)
    setError(null)
    try {
      const version = await uploadDocument('risk_management_plan', rmpId, file, { title: 'RMP document' })
      await attachRmpDocument(rmpId, version.documentId)
      setNotice('Document attached.')
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not upload this document.'))
    } finally {
      setUploadingFor(null)
    }
  }

  const handleActivate = async (id: string) => {
    setError(null)
    try {
      await activateRmp(id)
      setNotice('RMP activated.')
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not activate this RMP.'))
    }
  }

  const handleSaveRenewal = async (id: string) => {
    if (!renewalDraft) return
    setError(null)
    try {
      await updateRmpRenewal(id, renewalDraft)
      setEditingRenewalFor(null)
      setNotice('Renewal date updated.')
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update the renewal date.'))
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <ClipboardList className="h-6 w-6 text-safemeds-teal" />
            <h1 className="text-3xl font-display font-bold text-foreground">Risk Management Plans</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Per-product RMP: current version, submission, and renewal tracking.</p>
        </div>
        {canManage && productId && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors"
          >
            New Draft
          </button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <label className={labelClass}>Product</label>
        <select value={productId} onChange={(e) => setProductId(e.target.value)} className={`${inputClass} sm:max-w-sm`}>
          <option value="">Select a product…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.brandName}
            </option>
          ))}
        </select>
      </div>

      {!productId ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Select a product to view or manage its RMP.</p>
        </div>
      ) : (
        <>
          {activeVersion ? (
            <div className="rounded-lg border border-status-success bg-status-success/10 p-4 text-sm text-status-success">
              Version {activeVersion.version} is active. {activeVersion.nextRenewalDueAt ? `Next renewal due ${formatDate(activeVersion.nextRenewalDueAt)}.` : 'No renewal date set yet.'}
            </div>
          ) : (
            <div className="rounded-lg border border-status-warning bg-status-warning/10 p-4 text-sm text-status-warning flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
              No active RMP for this product — build or upload one, then activate it.
            </div>
          )}

          {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
          {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : versions.length === 0 ? (
              <div className="p-12 text-center">
                <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No RMP versions yet for this product.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="p-3">Version</th>
                    <th className="p-3">Title</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Document</th>
                    <th className="p-3">Next Renewal</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((v) => (
                    <tr key={v.id} className="border-b border-border last:border-0">
                      <td className="p-3 font-mono text-xs text-foreground">v{v.version}</td>
                      <td className="p-3 text-foreground">{v.title}</td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[v.status]}`}>{v.status}</span>
                      </td>
                      <td className="p-3 text-muted-foreground">{v.documentId ? 'Attached' : '—'}</td>
                      <td className="p-3 text-muted-foreground">
                        {editingRenewalFor === v.id ? (
                          <div className="flex items-center gap-1.5">
                            <input type="date" value={renewalDraft} onChange={(e) => setRenewalDraft(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1 text-xs" />
                            <button onClick={() => handleSaveRenewal(v.id)} className="text-xs font-medium text-safemeds-teal hover:underline">
                              Save
                            </button>
                            <button onClick={() => setEditingRenewalFor(null)} className="text-xs text-muted-foreground hover:underline">
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              if (!canManage) return
                              setEditingRenewalFor(v.id)
                              setRenewalDraft(v.nextRenewalDueAt?.slice(0, 10) ?? '')
                            }}
                            className={canManage ? 'hover:underline' : ''}
                            disabled={!canManage}
                          >
                            {formatDate(v.nextRenewalDueAt)}
                          </button>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {canManage && v.status === 'draft' && (
                          <div className="flex justify-end gap-2">
                            {!v.documentId && (
                              <>
                                <button
                                  onClick={() => setBuildingRmp(v)}
                                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                  Build
                                </button>
                                <button
                                  onClick={() => {
                                    fileInputRef.current?.setAttribute('data-rmp-id', v.id)
                                    fileInputRef.current?.click()
                                  }}
                                  disabled={uploadingFor === v.id}
                                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                                >
                                  {uploadingFor === v.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                  Upload
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleActivate(v.id)}
                              disabled={!v.documentId}
                              title={!v.documentId ? 'Attach a document before activating' : undefined}
                              className="rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-40"
                            >
                              Activate
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          const rmpId = fileInputRef.current?.getAttribute('data-rmp-id')
          if (file && rmpId) handleFileSelected(rmpId, file)
          e.target.value = ''
        }}
      />

      {showCreate && (
        <CreateRmpModal
          productId={productId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            setNotice('Draft created.')
            load()
          }}
        />
      )}

      {buildingRmp && (
        <BuildRmpModal
          rmp={buildingRmp}
          productBrandName={products.find((p) => p.id === productId)?.brandName ?? 'Product'}
          onClose={() => setBuildingRmp(null)}
          onGenerated={() => {
            setBuildingRmp(null)
            setNotice('RMP document generated.')
            load()
          }}
        />
      )}
    </div>
  )
}

function CreateRmpModal({ productId, onClose, onCreated }: { productId: string; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [nextRenewalDueAt, setNextRenewalDueAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = title.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await createRmp({ productId, title: title.trim(), summary: summary.trim() || undefined, nextRenewalDueAt: nextRenewalDueAt || undefined })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this draft.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">New RMP Draft</h2>

        <div>
          <label className={labelClass}>Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. RMP v1" className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Summary</label>
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Next renewal due (optional)</label>
          <input type="date" value={nextRenewalDueAt} onChange={(e) => setNextRenewalDueAt(e.target.value)} className={inputClass} />
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
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
