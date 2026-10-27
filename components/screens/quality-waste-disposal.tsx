'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Paperclip, Plus, Trash2, Upload, X } from 'lucide-react'

import { getErrorMessage } from '@/lib/api/client'
import { DocumentWithVersions, getDownloadUrl, listDocuments } from '@/lib/api/documents'
import { Batch, listBatches, listProducts, Product } from '@/lib/api/master-data'
import {
  addWasteAttendee,
  closeWasteCase,
  createWasteCase,
  getWasteCase,
  listWasteCases,
  recordWasteApplication,
  recordWasteDestruction,
  recordWasteHandover,
  uploadWasteEvidence,
  uploadWastePhotos,
  verifyWasteHandover,
  WasteAttendee,
  WasteAttendeeRole,
  WasteDisposalCase,
  WasteEvidenceKind,
  withdrawWasteAttendee,
} from '@/lib/api/waste-disposal-cases'
import { DocumentPreviewModal } from '@/components/ui/document-preview-modal'
import { Modal } from '@/components/ui/modal'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { MAX_UPLOAD_SIZE_BYTES, validateUploadSize } from '@/lib/upload-limits'
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'
const buttonClass =
  'inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50'
const secondaryButtonClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-2,transparent)] disabled:opacity-50'

/** The PPB application fee in the Second Schedule, Part B of LN 99 of 2022. */
const PPB_FEE_KES = 2500

const STEP_KEYS: { n: number; key: 'application' | 'evidence' | 'handover' | 'destruction' | 'ppbCertificate'; titleKey: MessageKey; whyKey: MessageKey }[] = [
  { n: 2, key: 'application', titleKey: 'wasteDisposal.step2Title', whyKey: 'wasteDisposal.step2Why' },
  { n: 3, key: 'evidence', titleKey: 'wasteDisposal.step3Title', whyKey: 'wasteDisposal.step3Why' },
  { n: 4, key: 'handover', titleKey: 'wasteDisposal.step4Title', whyKey: 'wasteDisposal.step4Why' },
  { n: 5, key: 'destruction', titleKey: 'wasteDisposal.step5Title', whyKey: 'wasteDisposal.step5Why' },
  { n: 6, key: 'ppbCertificate', titleKey: 'wasteDisposal.step6Title', whyKey: 'wasteDisposal.step6Why' },
]

const ATTENDEE_ROLE_LABEL_KEYS: Record<WasteAttendeeRole, MessageKey> = {
  client_representative: 'wasteDisposal.roleClientRepresentative',
  ppb_officer: 'wasteDisposal.rolePpbOfficer',
  other: 'wasteDisposal.roleOther',
}

function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

function errorText(err: unknown, fallback: string): string {
  return getErrorMessage(err, fallback)
}

/**
 * QualCloud Phase 1 Pass B (item B) — the pharmaceutical waste disposal case,
 * rebuilt as a 7-step, evidence-tracked process. The steps and their rule
 * references come from "The Pharmacy and Poisons (Pharmaceutical Waste
 * Management) Rules, LN 99 of 2022". The cage weighing, the attendee roles and
 * the photos are client-process requirements, not rules in that document.
 */
export function QualityWasteDisposalScreen() {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const presetBatchId = searchParams?.get('batchId') ?? undefined
  const { has } = usePermissions()
  const canManage = has('quality.manage_waste_disposal')
  const canClose = has('quality.close_waste_disposal')

  const [cases, setCases] = useState<WasteDisposalCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showCreate, setShowCreate] = useState(Boolean(presetBatchId))
  const [openCaseId, setOpenCaseId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listWasteCases({ page: 1, limit: 100 })
      .then((page) => setCases(page.rows))
      .catch((err) => setError(errorText(err, t('wasteDisposal.errorLoadCases'))))
      .finally(() => setLoading(false))
  }, [t])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">{t('wasteDisposal.title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            {t('wasteDisposal.subtitle')}
          </p>
        </div>
        {canManage && (
          <button onClick={() => setShowCreate(true)} className={buttonClass}>
            <Plus className="h-3.5 w-3.5" /> {t('wasteDisposal.newDisposalCase')}
          </button>
        )}
      </div>

      {notice && <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2,transparent)] px-4 py-2 text-sm text-[var(--text)]">{notice}</div>}
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('wasteDisposal.loadingCases')}
        </div>
      ) : cases.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--text-muted)]">
          {t('wasteDisposal.noCasesYet')}{' '}
          {canManage ? t('wasteDisposal.startOneHint') : t('wasteDisposal.qualityUserHint')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-2,transparent)] text-left text-xs text-[var(--text-muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">{t('wasteDisposal.columnCase')}</th>
                <th className="px-3 py-2 font-medium">{t('wasteDisposal.columnProductBatch')}</th>
                <th className="px-3 py-2 font-medium">{t('wasteDisposal.columnWeighed')}</th>
                <th className="px-3 py-2 font-medium">{t('wasteDisposal.columnNextStep')}</th>
                <th className="px-3 py-2 font-medium">{t('wasteDisposal.columnStatus')}</th>
                <th className="px-3 py-2 font-medium">{t('wasteDisposal.columnDisposalDue')}</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer border-t border-[var(--border)] hover:bg-[var(--surface-2,transparent)]"
                  onClick={() => setOpenCaseId(c.id)}
                >
                  <td className="px-3 py-2 font-mono text-xs text-[var(--text)]">{c.caseNumber}</td>
                  <td className="px-3 py-2 text-[var(--text)]">
                    {c.items.length === 0 ? (
                      t('wasteDisposal.notLinkedToProduct')
                    ) : c.items.length === 1 ? (
                      <>
                        {c.items[0].product.brandName} {c.items[0].product.strength}
                        <span className="text-[var(--text-muted)]"> · batch {c.items[0].batch.batchNumber}</span>
                      </>
                    ) : (
                      <>
                        {c.items[0].product.brandName} <span className="text-[var(--text-muted)]">{t('wasteDisposal.andMore', { count: String(c.items.length - 1) })}</span>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">{formatDate(c.weighedAt)}</td>
                  <td className="px-3 py-2 text-[var(--text)]">
                    {c.status === 'closed' ? t('wasteDisposal.closed') : c.currentStep === 7 ? t('wasteDisposal.closeTheCase') : t('wasteDisposal.stepN', { n: String(c.currentStep) })}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        c.status === 'closed' ? 'bg-emerald-500/15 text-emerald-700' : 'bg-amber-500/15 text-amber-700'
                      }`}
                    >
                      {c.status === 'closed' ? t('wasteDisposal.closed') : t('wasteDisposal.open')}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">{formatDate(c.disposalDeadlineAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <NewCaseModal
          presetBatchId={presetBatchId}
          onClose={() => setShowCreate(false)}
          onCreated={(created) => {
            setShowCreate(false)
            setNotice(t('wasteDisposal.caseCreatedNotice', { number: created.caseNumber }))
            setOpenCaseId(created.id)
            load()
          }}
        />
      )}

      {openCaseId && (
        <CaseDetailModal
          caseId={openCaseId}
          canManage={canManage}
          canClose={canClose}
          onClose={() => setOpenCaseId(null)}
          onChanged={() => load()}
          onNotice={(message) => setNotice(message)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- new case (step 1)

function NewCaseModal({
  presetBatchId,
  onClose,
  onCreated,
}: {
  presetBatchId?: string
  onClose: () => void
  onCreated: (created: WasteDisposalCase) => void
}) {
  const { t } = useTranslation()
  const [products, setProducts] = useState<Product[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set())
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')
  const [weighedAt, setWeighedAt] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    listProducts({ limit: 100 }).then((page) => setProducts(page.rows)).catch(() => undefined)
    listBatches({ limit: 100 })
      .then((page) => {
        setBatches(page.rows)
        if (presetBatchId) {
          const found = page.rows.find((b) => b.id === presetBatchId)
          if (found) {
            setSelectedProductIds(new Set([found.productId]))
            setSelectedBatchIds(new Set([presetBatchId]))
          }
        }
      })
      .catch(() => undefined)
  }, [presetBatchId])

  // Several products, each its own batch, are often weighed together as one
  // lot. Pick the products first; only batches belonging to a selected
  // product are offered, and picking a batch that no longer matches any
  // selected product (because it was deselected) drops it automatically.
  const batchesForSelectedProducts = useMemo(
    () => batches.filter((b) => selectedProductIds.has(b.productId)),
    [batches, selectedProductIds],
  )

  function toggleProduct(id: string) {
    const wasSelected = selectedProductIds.has(id)
    setSelectedProductIds((prev) => {
      const next = new Set(prev)
      if (wasSelected) next.delete(id)
      else next.add(id)
      return next
    })
    if (wasSelected) {
      // Deselecting a product drops any selected batch that belongs to it.
      setSelectedBatchIds((prev) => {
        const next = new Set(prev)
        for (const batchId of Array.from(next)) {
          const batch = batches.find((b) => b.id === batchId)
          if (batch && batch.productId === id) next.delete(batchId)
        }
        return next
      })
    }
  }

  function toggleBatch(id: string) {
    setSelectedBatchIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit() {
    setFormError(null)
    if (!description.trim() || !quantity.trim() || !unit.trim()) {
      setFormError(t('wasteDisposal.errorDescribeAll'))
      return
    }
    if (selectedBatchIds.size === 0) {
      setFormError(t('wasteDisposal.errorChooseOneBatch'))
      return
    }
    setSaving(true)
    try {
      const items = Array.from(selectedBatchIds).map((batchId) => {
        const batch = batches.find((b) => b.id === batchId)!
        return { productId: batch.productId, batchId }
      })
      const created = await createWasteCase({
        items,
        wasteDescription: description.trim(),
        quantity: quantity.trim(),
        unit: unit.trim(),
        weighedAt,
      })
      onCreated(created)
    } catch (err) {
      setFormError(errorText(err, t('wasteDisposal.errorCreateCase')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={t('wasteDisposal.newCaseModalTitle')} onClose={onClose} maxWidth="max-w-xl">
      <div className="space-y-4">
        <p className="text-xs text-[var(--text-muted)]">
          {t('wasteDisposal.newCaseIntro')}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>{t('wasteDisposal.productsTickAll')}</label>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-input p-2 space-y-1">
              {products.length === 0 && <p className="text-xs text-[var(--text-muted)]">{t('wasteDisposal.noProductsInCatalogue')}</p>}
              {products.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-xs text-[var(--text)]">
                  <input type="checkbox" checked={selectedProductIds.has(p.id)} onChange={() => toggleProduct(p.id)} />
                  {p.brandName} {p.strength}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className={labelClass}>{t('wasteDisposal.batchesBeingDisposed')}</label>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-input p-2 space-y-1">
              {selectedProductIds.size === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">{t('wasteDisposal.tickProductFirst')}</p>
              ) : batchesForSelectedProducts.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">{t('wasteDisposal.noBatchesForTicked')}</p>
              ) : (
                batchesForSelectedProducts.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 text-xs text-[var(--text)]">
                    <input type="checkbox" checked={selectedBatchIds.has(b.id)} onChange={() => toggleBatch(b.id)} />
                    {t('wasteDisposal.batchExpires', { number: b.batchNumber, date: formatDate(b.expiresOn) })}
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
        <div>
          <label className={labelClass}>{t('wasteDisposal.whatIsDisposed')}</label>
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('wasteDisposal.wasteDescriptionPlaceholder')} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={labelClass}>{t('wasteDisposal.quantityWeighed')}</label>
            <input className={inputClass} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={t('wasteDisposal.quantityPlaceholder')} />
          </div>
          <div>
            <label className={labelClass}>{t('wasteDisposal.unit')}</label>
            <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={t('wasteDisposal.unitPlaceholder')} />
          </div>
          <div>
            <label className={labelClass}>{t('wasteDisposal.weighedOn')}</label>
            <input type="date" className={inputClass} value={weighedAt} onChange={(e) => setWeighedAt(e.target.value)} />
          </div>
        </div>
        {formError && <p className="text-xs text-red-600">{formError}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className={secondaryButtonClass}>{t('wasteDisposal.cancel')}</button>
          <button onClick={submit} disabled={saving} className={buttonClass}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {t('wasteDisposal.createCase')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------- case detail (steps 2–7)

function CaseDetailModal({
  caseId,
  canManage,
  canClose,
  onClose,
  onChanged,
  onNotice,
}: {
  caseId: string
  canManage: boolean
  canClose: boolean
  onClose: () => void
  onChanged: () => void
  onNotice: (message: string) => void
}) {
  const { t } = useTranslation()
  const [item, setItem] = useState<WasteDisposalCase | null>(null)
  const [docs, setDocs] = useState<DocumentWithVersions[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<{ title: string; doc: DocumentWithVersions } | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const [fresh, documents] = await Promise.all([getWasteCase(caseId), listDocuments('waste_disposal_case', caseId)])
      setItem(fresh)
      setDocs(documents)
    } catch (err) {
      setLoadError(errorText(err, t('wasteDisposal.errorLoadCase')))
    }
  }, [caseId, t])

  useEffect(() => {
    load()
  }, [load])

  /** Every change refreshes the case and tells the list to refresh. */
  function applyUpdate(updated: WasteDisposalCase, message: string) {
    setItem(updated)
    onNotice(message)
    onChanged()
    listDocuments('waste_disposal_case', caseId).then(setDocs).catch(() => undefined)
  }

  const nextStep = item ? STEP_KEYS.find((s) => !item.steps[s.key]) : undefined

  return (
    <Modal title={item ? t('wasteDisposal.disposalCaseTitle', { number: item.caseNumber }) : t('wasteDisposal.disposalCaseGeneric')} onClose={onClose} maxWidth="max-w-3xl">
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}
      {!item && !loadError && (
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('wasteDisposal.loading')}
        </div>
      )}
      {item && (
        <div className="space-y-5">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2,transparent)] p-3 text-sm">
            {item.status === 'closed' ? (
              <p className="text-[var(--text)]">
                <span className="font-medium">{t('wasteDisposal.closedOnStatement', { date: formatDate(item.step7Closure.closedAt) })}</span> {t('wasteDisposal.archivedNote')}
              </p>
            ) : item.currentStep === 7 ? (
              <p className="text-[var(--text)]">
                <span className="font-medium">{t('wasteDisposal.everyStepComplete')}</span> {t('wasteDisposal.managerCanClose')}
              </p>
            ) : nextStep ? (
              <p className="text-[var(--text)]">
                <span className="font-medium">{t('wasteDisposal.nextStepStatement', { n: String(nextStep.n), title: t(nextStep.titleKey) })}</span>{' '}
                <span className="text-[var(--text-muted)]">{t(nextStep.whyKey)}</span>
              </p>
            ) : null}
            {item.status !== 'closed' && item.closureBlockers.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-[var(--text-muted)]">
                {item.closureBlockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            {item.warnings.map((w) => (
              <p key={w} className="mt-2 text-xs text-amber-700">
                {w}
              </p>
            ))}
          </div>

          <StepCard n={1} title={t('wasteDisposal.wasteWeighed')} done>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <Field label={item.items.length > 1 ? t('wasteDisposal.productsAndBatches') : t('wasteDisposal.product')}>
                {item.items.length === 0 ? (
                  t('wasteDisposal.notLinked')
                ) : (
                  <ul className="space-y-0.5">
                    {item.items.map((i) => (
                      <li key={i.id}>
                        {i.product.brandName} {i.product.strength} <span className="text-[var(--text-muted)]">· batch {i.batch.batchNumber}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Field>
              <Field label={t('wasteDisposal.waste')}>{item.wasteDescription}</Field>
              <Field label={t('wasteDisposal.quantity')}>
                {item.quantity} {item.unit}
              </Field>
              <Field label={t('wasteDisposal.weighedOnField')}>{formatDate(item.weighedAt)}</Field>
            </dl>
          </StepCard>

          <StepCard n={2} title={t(STEP_KEYS[0].titleKey)} done={item.steps.application}>
            <ApplicationStep item={item} disabled={!canManage || item.status === 'closed'} onSaved={applyUpdate} />
          </StepCard>

          <StepCard n={3} title={t(STEP_KEYS[1].titleKey)} done={item.steps.evidence}>
            <EvidenceStep item={item} docs={docs} disabled={!canManage || item.status === 'closed'} onSaved={applyUpdate} onPreview={setPreviewing} />
          </StepCard>

          <StepCard n={4} title={t(STEP_KEYS[2].titleKey)} done={item.steps.handover}>
            <HandoverStep item={item} docs={docs} disabled={!canManage || item.status === 'closed'} onSaved={applyUpdate} onPreview={setPreviewing} />
          </StepCard>

          <StepCard n={5} title={t(STEP_KEYS[3].titleKey)} done={item.steps.destruction}>
            <DestructionStep item={item} docs={docs} disabled={!canManage || item.status === 'closed'} onSaved={applyUpdate} onPreview={setPreviewing} />
          </StepCard>

          <StepCard n={6} title={t(STEP_KEYS[4].titleKey)} done={item.steps.ppbCertificate}>
            <PpbCertificateStep item={item} docs={docs} disabled={!canManage || item.status === 'closed'} onSaved={applyUpdate} onPreview={setPreviewing} />
          </StepCard>

          <StepCard n={7} title={t('wasteDisposal.closeTheCaseTitle')} done={item.status === 'closed'}>
            {item.status === 'closed' ? (
              <p className="text-sm text-[var(--text-muted)]">{t('wasteDisposal.closedOnOnly', { date: formatDate(item.step7Closure.closedAt) })}</p>
            ) : canClose ? (
              <div className="space-y-2">
                <p className="text-xs text-[var(--text-muted)]">
                  {t('wasteDisposal.closingArchivesNote')}
                </p>
                <button
                  disabled={item.closureBlockers.length > 0}
                  onClick={async () => {
                    try {
                      const closed = await closeWasteCase(item.id)
                      applyUpdate(closed, t('wasteDisposal.caseClosedNotice', { number: closed.caseNumber }))
                    } catch (err) {
                      setLoadError(errorText(err, t('wasteDisposal.errorCloseCase')))
                    }
                  }}
                  className={buttonClass}
                >
                  {t('wasteDisposal.closeCase')}
                </button>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">{t('wasteDisposal.managerOnlyNote')}</p>
            )}
          </StepCard>
        </div>
      )}
      {previewing && (
        <DocumentPreviewModal
          title={previewing.title}
          filename={previewing.doc.versions[0]?.filename ?? previewing.doc.title}
          contentType={previewing.doc.versions[0]?.contentType ?? 'application/octet-stream'}
          getUrl={() => getDownloadUrl(previewing.doc.id, previewing.doc.versions[0]!.id)}
          onClose={() => setPreviewing(null)}
        />
      )}
    </Modal>
  )
}

function StepCard({
  n,
  title,
  done,
  locked,
  children,
}: {
  n: number
  title: string
  done: boolean
  locked?: boolean
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <section className="rounded-xl border border-[var(--border)] p-4">
      <header className="mb-3 flex items-center gap-3">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
            done ? 'bg-emerald-500 text-white' : 'bg-[var(--surface-2,transparent)] text-[var(--text-muted)] border border-[var(--border)]'
          }`}
        >
          {done ? '✓' : n}
        </span>
        <h3 className="text-sm font-semibold text-[var(--text)]">
          {t('wasteDisposal.stepN', { n: String(n) })}: {title}
        </h3>
        {done && <span className="text-xs text-emerald-700">{t('wasteDisposal.complete')}</span>}
        {locked && <span className="text-xs text-[var(--text-muted)]">{t('wasteDisposal.lockedNote')}</span>}
      </header>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
      <dd className="text-[var(--text)]">{children}</dd>
    </div>
  )
}

function DocLink({
  doc,
  label,
  docs,
  onPreview,
}: {
  doc: { id: string; title: string } | null
  label: string
  docs: DocumentWithVersions[]
  onPreview: (p: { title: string; doc: DocumentWithVersions }) => void
}) {
  const { t } = useTranslation()
  if (!doc) return <span className="text-xs text-[var(--text-muted)]">{t('wasteDisposal.notAttached', { label })}</span>
  const full = docs.find((d) => d.id === doc.id)
  if (!full || full.versions.length === 0) {
    return <span className="text-xs text-[var(--text-muted)]">{t('wasteDisposal.labelColonValue', { label, value: doc.title })}</span>
  }
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-xs text-[var(--primary)] underline-offset-2 hover:underline"
      onClick={() => onPreview({ title: label, doc: full })}
    >
      <Paperclip className="h-3 w-3" /> {t('wasteDisposal.labelColonValue', { label, value: doc.title })}
    </button>
  )
}

function ApplicationStep({
  item,
  disabled,
  onSaved,
}: {
  item: WasteDisposalCase
  disabled: boolean
  onSaved: (updated: WasteDisposalCase, message: string) => void
}) {
  const { t } = useTranslation()
  const [applicationReference, setApplicationReference] = useState(item.step2Application.applicationReference ?? '')
  const [invoiceReference, setInvoiceReference] = useState(item.step2Application.invoiceReference ?? '')
  const [fee, setFee] = useState(String(item.step2Application.feeAmountKes ?? PPB_FEE_KES))
  const [submittedOn, setSubmittedOn] = useState(
    item.step2Application.applicationSubmittedAt ? item.step2Application.applicationSubmittedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const feeNumber = Number(fee)

  async function save() {
    setErr(null)
    if (!applicationReference.trim() || !invoiceReference.trim() || !Number.isFinite(feeNumber) || feeNumber <= 0) {
      setErr(t('wasteDisposal.errorApplicationFields'))
      return
    }
    setSaving(true)
    try {
      const updated = await recordWasteApplication(item.id, {
        applicationReference: applicationReference.trim(),
        invoiceReference: invoiceReference.trim(),
        feeAmountKes: feeNumber,
        applicationSubmittedAt: submittedOn,
      })
      onSaved(updated, t('wasteDisposal.applicationRecordedNotice'))
    } catch (e) {
      setErr(errorText(e, t('wasteDisposal.errorRecordApplication')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-muted)]">
        {t('wasteDisposal.feePaidNote', { fee: PPB_FEE_KES.toLocaleString() })}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>{t('wasteDisposal.ppbApplicationReference')}</label>
          <input className={inputClass} disabled={disabled} value={applicationReference} onChange={(e) => setApplicationReference(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t('wasteDisposal.invoiceReference')}</label>
          <input className={inputClass} disabled={disabled} value={invoiceReference} onChange={(e) => setInvoiceReference(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t('wasteDisposal.feePaidKes')}</label>
          <input className={inputClass} disabled={disabled} type="number" value={fee} onChange={(e) => setFee(e.target.value)} />
          {Number.isFinite(feeNumber) && feeNumber !== PPB_FEE_KES && (
            <p className="mt-1 text-xs text-amber-700">{t('wasteDisposal.feeWarning', { fee: PPB_FEE_KES.toLocaleString() })}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>{t('wasteDisposal.appliedOn')}</label>
          <input className={inputClass} disabled={disabled} type="date" value={submittedOn} onChange={(e) => setSubmittedOn(e.target.value)} />
        </div>
      </div>
      {item.step2Application.certificateDueAt && (
        <p className="text-xs text-[var(--text-muted)]">{t('wasteDisposal.certificateDueNote', { date: formatDate(item.step2Application.certificateDueAt) })}</p>
      )}
      {err && <p className="text-xs text-red-600">{err}</p>}
      {!disabled && (
        <button onClick={save} disabled={saving} className={buttonClass}>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {t('wasteDisposal.saveApplicationDetails')}
        </button>
      )}
    </div>
  )
}

function EvidenceStep({
  item,
  docs,
  disabled,
  onSaved,
  onPreview,
}: {
  item: WasteDisposalCase
  docs: DocumentWithVersions[]
  disabled: boolean
  onSaved: (updated: WasteDisposalCase, message: string) => void
  onPreview: (p: { title: string; doc: DocumentWithVersions }) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-muted)]">{t('wasteDisposal.evidenceIntro')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <EvidenceSlot kind="invoice" label={t('wasteDisposal.invoice')} current={item.step3Evidence.invoiceDocument} disabled={disabled} onSaved={onSaved} docs={docs} onPreview={onPreview} caseId={item.id} />
        <EvidenceSlot kind="payment_receipt" label={t('wasteDisposal.paymentReceipt')} current={item.step3Evidence.paymentReceiptDocument} disabled={disabled} onSaved={onSaved} docs={docs} onPreview={onPreview} caseId={item.id} />
      </div>
    </div>
  )
}

function EvidenceSlot({
  caseId,
  kind,
  label,
  current,
  disabled,
  onSaved,
  docs,
  onPreview,
}: {
  caseId: string
  kind: WasteEvidenceKind
  label: string
  current: { id: string; title: string } | null
  disabled: boolean
  onSaved: (updated: WasteDisposalCase, message: string) => void
  docs: DocumentWithVersions[]
  onPreview: (p: { title: string; doc: DocumentWithVersions }) => void
}) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function upload(file: File) {
    setErr(null)
    const tooBig = validateUploadSize(file)
    if (tooBig) return setErr(tooBig)
    setBusy(true)
    try {
      onSaved(await uploadWasteEvidence(caseId, kind, file), t('wasteDisposal.attachedNotice', { label }))
    } catch (e) {
      setErr(errorText(e, t('wasteDisposal.errorUploadLabel', { label: label.toLowerCase() })))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="rounded-lg border border-[var(--border)] p-3">
      <p className="text-xs font-medium text-[var(--text)]">{label}</p>
      <div className="mt-1">
        <DocLink doc={current} label={label} docs={docs} onPreview={onPreview} />
      </div>
      {!disabled && (
        <label className={`${secondaryButtonClass} mt-2 cursor-pointer`}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} {current ? t('wasteDisposal.replaceFile') : t('wasteDisposal.uploadFile')}
          <input type="file" className="hidden" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
      )}
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
      <p className="mt-1 text-[10px] text-[var(--text-muted)]">{t('wasteDisposal.maxSize', { mb: String(Math.round(MAX_UPLOAD_SIZE_BYTES / (1024 * 1024))) })}</p>
    </div>
  )
}

function HandoverStep({
  item,
  docs,
  disabled,
  onSaved,
  onPreview,
}: {
  item: WasteDisposalCase
  docs: DocumentWithVersions[]
  disabled: boolean
  onSaved: (updated: WasteDisposalCase, message: string) => void
  onPreview: (p: { title: string; doc: DocumentWithVersions }) => void
}) {
  const { t } = useTranslation()
  const [company, setCompany] = useState(item.step4Handover.disposalCompanyName ?? '')
  const [handedOn, setHandedOn] = useState(
    item.step4Handover.handedOverAt ? item.step4Handover.handedOverAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const certificateDoc = item.step4Handover.handoverCertificateDocument
  const verified = Boolean(item.step4Handover.ppbVerifiedAt)

  async function save() {
    setErr(null)
    if (company.trim().length < 2) return setErr(t('wasteDisposal.errorCompanyName'))
    setSaving(true)
    try {
      onSaved(await recordWasteHandover(item.id, { disposalCompanyName: company.trim(), handedOverAt: handedOn }), t('wasteDisposal.handoverRecordedNotice'))
    } catch (e) {
      setErr(errorText(e, t('wasteDisposal.errorRecordHandover')))
    } finally {
      setSaving(false)
    }
  }

  async function verify() {
    setErr(null)
    try {
      onSaved(await verifyWasteHandover(item.id), t('wasteDisposal.certificateVerifiedNotice'))
    } catch (e) {
      setErr(errorText(e, t('wasteDisposal.errorVerifyCertificate')))
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>{t('wasteDisposal.authorisedDisposalCompany')}</label>
          <input className={inputClass} disabled={disabled} value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t('wasteDisposal.handedOverOn')}</label>
          <input className={inputClass} disabled={disabled} type="date" value={handedOn} onChange={(e) => setHandedOn(e.target.value)} />
        </div>
      </div>
      {!disabled && (
        <button onClick={save} disabled={saving} className={secondaryButtonClass}>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {t('wasteDisposal.saveCompanyAndDate')}
        </button>
      )}
      <div className="rounded-lg border border-[var(--border)] p-3">
        <p className="text-xs font-medium text-[var(--text)]">{t('wasteDisposal.disposalCompanyCertificate')}</p>
        <div className="mt-1">
          <DocLink doc={certificateDoc} label={t('wasteDisposal.certificate')} docs={docs} onPreview={onPreview} />
        </div>
        {!disabled && (
          <label className={`${secondaryButtonClass} mt-2 cursor-pointer`}>
            <Upload className="h-3.5 w-3.5" /> {certificateDoc ? t('wasteDisposal.replaceCertificate') : t('wasteDisposal.uploadCertificate')}
            <input
              type="file"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const tooBig = validateUploadSize(file)
                if (tooBig) return setErr(tooBig)
                setErr(null)
                try {
                  onSaved(await uploadWasteEvidence(item.id, 'handover_certificate', file), t('wasteDisposal.companyCertificateAttachedNotice'))
                } catch (ex) {
                  setErr(errorText(ex, t('wasteDisposal.errorUploadCertificate')))
                }
              }}
            />
          </label>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {verified ? (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-700">{t('wasteDisposal.verifiedByPpbOn', { date: formatDate(item.step4Handover.ppbVerifiedAt) })}</span>
        ) : (
          <span className="text-xs text-[var(--text-muted)]">{t('wasteDisposal.notYetVerified')}</span>
        )}
        {!disabled && !verified && (
          <button onClick={verify} className={secondaryButtonClass} disabled={!company || !certificateDoc}>
            {t('wasteDisposal.markCertificateVerified')}
          </button>
        )}
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  )
}

function DestructionStep({
  item,
  docs,
  disabled,
  onSaved,
  onPreview,
}: {
  item: WasteDisposalCase
  docs: DocumentWithVersions[]
  disabled: boolean
  onSaved: (updated: WasteDisposalCase, message: string) => void
  onPreview: (p: { title: string; doc: DocumentWithVersions }) => void
}) {
  const { t } = useTranslation()
  const [date, setDate] = useState(item.step5Destruction.destructionDate ? item.step5Destruction.destructionDate.slice(0, 10) : '')
  const [location, setLocation] = useState(item.step5Destruction.destructionLocation ?? '')
  const [attendeeName, setAttendeeName] = useState('')
  const [attendeeOrg, setAttendeeOrg] = useState('')
  const [attendeeRole, setAttendeeRole] = useState<WasteAttendeeRole>('client_representative')
  const [photos, setPhotos] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function saveDetails() {
    setErr(null)
    if (!date || location.trim().length < 2) return setErr(t('wasteDisposal.errorDestructionFields'))
    setSaving(true)
    try {
      onSaved(await recordWasteDestruction(item.id, { destructionDate: date, destructionLocation: location.trim() }), t('wasteDisposal.destructionDetailsRecordedNotice'))
    } catch (e) {
      setErr(errorText(e, t('wasteDisposal.errorRecordDestructionDetails')))
    } finally {
      setSaving(false)
    }
  }

  async function addAttendee() {
    setErr(null)
    if (attendeeName.trim().length < 2 || attendeeOrg.trim().length < 2) return setErr(t('wasteDisposal.errorAttendeeFields'))
    try {
      onSaved(
        await addWasteAttendee(item.id, { name: attendeeName.trim(), organisation: attendeeOrg.trim(), attendeeRole }),
        t('wasteDisposal.attendeeAddedNotice'),
      )
      setAttendeeName('')
      setAttendeeOrg('')
    } catch (e) {
      setErr(errorText(e, t('wasteDisposal.errorAddAttendee')))
    }
  }

  async function uploadPhotos() {
    setErr(null)
    const bad = photos.map((p) => validateUploadSize(p)).find(Boolean)
    if (bad) return setErr(bad)
    setSaving(true)
    try {
      onSaved(await uploadWastePhotos(item.id, photos), t('wasteDisposal.photosUploadedNotice', { count: String(photos.length) }))
      setPhotos([])
    } catch (e) {
      setErr(errorText(e, t('wasteDisposal.errorUploadPhotos')))
    } finally {
      setSaving(false)
    }
  }

  const combined = item.step5Destruction.combinedPdfDocument
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>{t('wasteDisposal.destructionDate')}</label>
          <input className={inputClass} disabled={disabled} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t('wasteDisposal.locationOfDestruction')}</label>
          <input className={inputClass} disabled={disabled} value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('wasteDisposal.facilityOrSitePlaceholder')} />
        </div>
      </div>
      {!disabled && (
        <button onClick={saveDetails} disabled={saving} className={secondaryButtonClass}>
          {t('wasteDisposal.saveDateAndLocation')}
        </button>
      )}

      <div className="rounded-lg border border-[var(--border)] p-3">
        <p className="text-xs font-medium text-[var(--text)]">{t('wasteDisposal.whoWasPresent')}</p>
        <p className="mb-2 text-[11px] text-[var(--text-muted)]">{t('wasteDisposal.recordAtLeastOne')}</p>
        <ul className="space-y-1 text-sm">
          {item.step5Destruction.attendees.length === 0 && <li className="text-xs text-[var(--text-muted)]">{t('wasteDisposal.noAttendeesYet')}</li>}
          {item.step5Destruction.attendees.map((a: WasteAttendee) => (
            <li key={a.id} className="flex items-center justify-between gap-2">
              <span>
                {a.name} · {a.organisation} · <span className="text-[var(--text-muted)]">{t(ATTENDEE_ROLE_LABEL_KEYS[a.attendeeRole])}</span>
              </span>
              {!disabled && (
                <button
                  className="text-xs text-red-600 hover:underline"
                  onClick={async () => {
                    try {
                      onSaved(await withdrawWasteAttendee(item.id, a.id), t('wasteDisposal.attendeeRemovedNotice'))
                    } catch (e) {
                      setErr(errorText(e, t('wasteDisposal.errorRemoveAttendee')))
                    }
                  }}
                >
                  <Trash2 className="inline h-3 w-3" /> {t('wasteDisposal.remove')}
                </button>
              )}
            </li>
          ))}
        </ul>
        {!disabled && (
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <input className={inputClass} placeholder={t('wasteDisposal.fullName')} value={attendeeName} onChange={(e) => setAttendeeName(e.target.value)} />
            <input className={inputClass} placeholder={t('wasteDisposal.organisation')} value={attendeeOrg} onChange={(e) => setAttendeeOrg(e.target.value)} />
            <select className={inputClass} value={attendeeRole} onChange={(e) => setAttendeeRole(e.target.value as WasteAttendeeRole)}>
              {(Object.keys(ATTENDEE_ROLE_LABEL_KEYS) as WasteAttendeeRole[]).map((r) => (
                <option key={r} value={r}>
                  {t(ATTENDEE_ROLE_LABEL_KEYS[r])}
                </option>
              ))}
            </select>
            <button onClick={addAttendee} className={secondaryButtonClass}>
              <Plus className="h-3.5 w-3.5" /> {t('wasteDisposal.addAttendee')}
            </button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-[var(--border)] p-3">
        <p className="text-xs font-medium text-[var(--text)]">{t('wasteDisposal.destructionPhotos')}</p>
        <p className="mb-2 text-[11px] text-[var(--text-muted)]">
          {t('wasteDisposal.photosNote')}
        </p>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <DocLink doc={combined} label={t('wasteDisposal.combinedPdf')} docs={docs} onPreview={onPreview} />
        </div>
        <ul className="mb-2 text-xs text-[var(--text-muted)]">
          {item.step5Destruction.photos.map((p) => (
            <li key={p.id}>
              {t('wasteDisposal.photoLine', { n: String(p.sortOrder + 1), title: p.document.title })}
            </li>
          ))}
        </ul>
        {!disabled && (
          <div className="space-y-2">
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {photos.map((file, index) => (
                  <PhotoPreviewThumb key={`${file.name}-${file.lastModified}-${index}`} file={file} onRemove={() => setPhotos((prev) => prev.filter((_, i) => i !== index))} />
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <label className={`${secondaryButtonClass} cursor-pointer`}>
                <Plus className="h-3.5 w-3.5" /> {t('wasteDisposal.addPhotos')}
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const added = Array.from(e.target.files ?? [])
                    setPhotos((prev) => [...prev, ...added])
                    e.target.value = ''
                  }}
                />
              </label>
              <button onClick={uploadPhotos} disabled={saving || photos.length === 0} className={secondaryButtonClass}>
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {t('wasteDisposal.uploadPhotosCount', { count: String(photos.length || '') })}
              </button>
            </div>
          </div>
        )}
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  )
}

/** A local (not-yet-uploaded) photo, previewed from an object URL so it can be checked and removed before uploading. */
function PhotoPreviewThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const { t } = useTranslation()
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])
  return (
    <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-[var(--border)]">
      {url && <img src={url} alt={file.name} className="h-full w-full object-cover" />}
      <button
        type="button"
        onClick={onRemove}
        title={t('wasteDisposal.removeFile', { name: file.name })}
        className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

function PpbCertificateStep({
  item,
  docs,
  disabled,
  onSaved,
  onPreview,
}: {
  item: WasteDisposalCase
  docs: DocumentWithVersions[]
  disabled: boolean
  onSaved: (updated: WasteDisposalCase, message: string) => void
  onPreview: (p: { title: string; doc: DocumentWithVersions }) => void
}) {
  const { t } = useTranslation()
  const [err, setErr] = useState<string | null>(null)
  const current = item.step6PpbCertificate.document
  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-muted)]">
        {t('wasteDisposal.ppbCertificateIntro')}
      </p>
      <DocLink doc={current} label={t('wasteDisposal.ppbCertificate')} docs={docs} onPreview={onPreview} />
      {!disabled && (
        <label className={`${secondaryButtonClass} cursor-pointer`}>
          <Upload className="h-3.5 w-3.5" /> {current ? t('wasteDisposal.replaceCertificate') : t('wasteDisposal.uploadPpbCertificate')}
          <input
            type="file"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const tooBig = validateUploadSize(file)
              if (tooBig) return setErr(tooBig)
              setErr(null)
              try {
                onSaved(await uploadWasteEvidence(item.id, 'ppb_certificate', file), t('wasteDisposal.ppbCertificateAttachedNotice'))
              } catch (ex) {
                setErr(errorText(ex, t('wasteDisposal.errorUploadPpbCertificate')))
              }
            }}
          />
        </label>
      )}
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  )
}
