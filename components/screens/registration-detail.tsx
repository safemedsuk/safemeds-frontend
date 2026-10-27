'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CalendarClock, Download, FileCheck2, Loader2, Plus, ShieldCheck, Upload } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { uploadDocument } from '@/lib/api/documents'
import {
  listRegPostMarketObligations,
  createRegPostMarketObligation,
  fulfillRegPostMarketObligation,
  type RegPostMarketObligation,
} from '@/lib/api/reg-post-market-obligations'
import { getRegistrationArchive, downloadRegistrationArchiveCsv, type RegistrationArchive } from '@/lib/api/registration-archive'
import { listRegRetentions, createRegRetention, classifyRegistration, type RegRetention } from '@/lib/api/reg-dossiers'
import { type RequiredDocumentDefinition } from '@/lib/api/regulatory-config'
import { getRegistration } from '@/lib/api/master-data'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { Modal } from '@/components/ui/modal'
import { useTranslation } from '@/lib/i18n/use-translation'

const OBLIGATION_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-[var(--surface-raised)] text-[var(--text-muted)]',
  overdue: 'bg-status-error/10 text-status-error',
  fulfilled: 'bg-[var(--ok-bg)] text-[var(--ok)]',
}

function formatDate(v: string | null | undefined): string {
  return v ? new Date(v).toLocaleDateString() : '—'
}

/**
 * RegCloud (Phase 12) Stages 8/9 — a single registration's own detail
 * page: Post-Market Obligations (Stage 8) and the full chronological
 * Archive (Stage 9), reusing the same "one record, several stages'
 * worth of sections" shape `RegDossierDetail`/`PvCaseDetail` already
 * established, not a new UI pattern.
 */
export function RegistrationDetail({ productRegistrationId }: { productRegistrationId: string }) {
  const router = useRouter()
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canManageObligations = has('regulatory.manage_obligations')

  const canManageRetentions = has('regulatory.manage_retentions')

  const [archive, setArchive] = useState<RegistrationArchive | null>(null)
  const [obligations, setObligations] = useState<RegPostMarketObligation[]>([])
  const [retentions, setRetentions] = useState<RegRetention[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [showLogObligation, setShowLogObligation] = useState(false)
  const [fulfilling, setFulfilling] = useState<RegPostMarketObligation | null>(null)
  const [showLogRetention, setShowLogRetention] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      getRegistrationArchive(productRegistrationId),
      listRegPostMarketObligations({ productRegistrationId, limit: 50 }),
      listRegRetentions(productRegistrationId),
    ])
      .then(([archiveData, obligationPage, retentionRows]) => {
        setArchive(archiveData)
        setObligations(obligationPage.rows)
        setRetentions(retentionRows)
      })
      .catch((err) => setError(getErrorMessage(err, t('registrationDetail.errorLoad'))))
      .finally(() => setLoading(false))
  }, [productRegistrationId, t])

  useEffect(load, [load])

  const handleExport = async () => {
    if (!archive) return
    setExporting(true)
    try {
      await downloadRegistrationArchiveCsv(productRegistrationId, archive.registration.registrationNumber)
    } catch (err) {
      setError(getErrorMessage(err, t('registrationDetail.errorExport')))
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[var(--text-muted)]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!archive) {
    return <div className="p-6 text-sm text-status-error">{error ?? t('registrationDetail.notFound')}</div>
  }

  return (
    <div className="space-y-6 p-6">
      <button onClick={() => router.push('/master-data')} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)]">
        <ArrowLeft className="h-3.5 w-3.5" /> {t('registrationDetail.backToMasterData')}
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-[var(--text)]">{archive.registration.registrationNumber}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {archive.registration.productBrandName} · {archive.registration.authorityName}
          </p>
        </div>
        <span className="px-3 py-1 rounded-full bg-[var(--ok-bg)] text-[var(--ok)] text-xs font-medium uppercase tracking-wide">{archive.registration.status}</span>
      </div>

      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="grid grid-cols-2 gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{t('registrationDetail.issued')}</p>
          <p className="text-sm text-[var(--text)]">{formatDate(archive.registration.issuedOn)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{t('registrationDetail.expires')}</p>
          <p className="text-sm text-[var(--text)]">{formatDate(archive.registration.expiresOn)}</p>
        </div>
      </div>

      {/* Stage 8 — Post-Market Obligations */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
              <CalendarClock className="h-5 w-5 text-[var(--primary)]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text)]">{t('registrationDetail.postMarketObligationsTitle')}</h2>
              <p className="text-xs text-[var(--text-muted)]">{t('registrationDetail.postMarketObligationsDescription')}</p>
            </div>
          </div>
          {canManageObligations && (
            <button onClick={() => setShowLogObligation(true)} className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white">
              <Plus className="h-3.5 w-3.5" /> {t('registrationDetail.logObligation')}
            </button>
          )}
        </div>
        <div className="p-2">
          {obligations.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-muted)]">{t('registrationDetail.noObligationsYet')}</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {obligations.map((o) => (
                <li key={o.id} className="p-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide ${OBLIGATION_STATUS_STYLES[o.status] ?? ''}`}>{o.status}</span>
                    <span className="text-sm text-[var(--text)]">{o.obligationType.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-[var(--text-muted)]">{t('registrationDetail.due', { date: formatDate(o.dueAt) })}</span>
                    {o.fulfillments.length > 0 && (
                      <span className="text-xs text-[var(--text-muted)]">{t('registrationDetail.fulfillmentCount', { count: String(o.fulfillments.length) })}</span>
                    )}
                  </div>
                  {canManageObligations && (
                    <button onClick={() => setFulfilling(o)} className="text-xs font-medium text-[var(--primary)] hover:underline">
                      {t('registrationDetail.fulfill')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* testing-correction-explanation.md §3.3/§3.7 — Retention */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-[var(--primary)]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text)]">{t('registrationDetail.retentionsTitle')}</h2>
              <p className="text-xs text-[var(--text-muted)]">{t('registrationDetail.retentionsDescription')}</p>
            </div>
          </div>
          {canManageRetentions && archive.registration.status === 'active' && new Date(archive.registration.expiresOn) > new Date() && (
            <button onClick={() => setShowLogRetention(true)} className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white">
              <Plus className="h-3.5 w-3.5" /> {t('registrationDetail.logRetention')}
            </button>
          )}
        </div>
        <div className="p-2">
          {archive.registration.status !== 'active' || new Date(archive.registration.expiresOn) <= new Date() ? (
            <p className="py-4 px-3 text-xs text-status-warning">
              {t('registrationDetail.retentionNoLongerApplies', {
                status: archive.registration.status !== 'active' ? archive.registration.status : t('registrationDetail.expiredWord'),
              })}
            </p>
          ) : null}
          {retentions.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-muted)]">{t('registrationDetail.noRetentionYet')}</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {retentions.map((r) => (
                <li key={r.id} className="p-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[var(--ok-bg)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--ok)]">{r.status}</span>
                    <span className="text-sm text-[var(--text)]">{r.year}</span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {r.displayCode} · {t('registrationDetail.paid', { date: formatDate(r.paidAt) })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Stage 9 — Archive & Custody */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
              <FileCheck2 className="h-5 w-5 text-[var(--primary)]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text)]">{t('registrationDetail.archiveTitle')}</h2>
              <p className="text-xs text-[var(--text-muted)]">{t('registrationDetail.archiveDescription')}</p>
            </div>
          </div>
          <button onClick={handleExport} disabled={exporting} className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text)] disabled:opacity-50">
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} {t('registrationDetail.exportCsv')}
          </button>
        </div>
        <div className="p-4 space-y-4">
          {archive.dossiers.map((dossier) => (
            <div key={dossier.id} className="rounded-lg border border-[var(--border)] p-3">
              <button onClick={() => router.push(`/reg-dossiers/${dossier.id}`)} className="text-sm font-medium text-[var(--primary)] hover:underline">
                {dossier.variation ? t('registrationDetail.variationDossier', { type: dossier.variation.variationType }) : t('registrationDetail.originalDossier')}
              </button>
              <span className="ml-2 text-xs text-[var(--text-muted)]">{formatDate(dossier.createdAt)} · {dossier.status}</span>

              {dossier.submissions.length > 0 && (
                <div className="mt-2 ml-3 space-y-1">
                  {dossier.submissions.map((s) => (
                    <p key={s.id} className="text-xs text-[var(--text-muted)]">
                      {t('registrationDetail.submissionLine', {
                        number: String(s.submissionNumber),
                        channel: s.channel,
                        date: formatDate(s.generatedAt),
                        dispatched: s.dispatchedAt ? t('registrationDetail.dispatchedSuffix') : '',
                      })}
                    </p>
                  ))}
                </div>
              )}
              {dossier.queries.length > 0 && (
                <div className="mt-2 ml-3 space-y-1">
                  {dossier.queries.map((q) => (
                    <p key={q.id} className="text-xs text-[var(--text-muted)]">
                      {t('registrationDetail.queryLine', { date: formatDate(q.receivedDate), text: q.queryText, status: q.status })}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
          {archive.feeInvoices.length > 0 && (
            <div className="rounded-lg border border-[var(--border)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1">{t('registrationDetail.feesLabel')}</p>
              {archive.feeInvoices.map((f) => (
                <p key={f.id} className="text-xs text-[var(--text-muted)]">
                  {t('registrationDetail.feeLine', { type: f.feeType, currency: f.currency, amount: String(f.amount), date: formatDate(f.dueAt), status: f.status })}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {showLogObligation && (
        <LogObligationModal
          productRegistrationId={productRegistrationId}
          onClose={() => setShowLogObligation(false)}
          onLogged={() => {
            setShowLogObligation(false)
            load()
          }}
        />
      )}
      {fulfilling && (
        <FulfillObligationModal
          obligation={fulfilling}
          onClose={() => setFulfilling(null)}
          onFulfilled={() => {
            setFulfilling(null)
            load()
          }}
        />
      )}
      {showLogRetention && (
        <LogRetentionModal
          productRegistrationId={productRegistrationId}
          onClose={() => setShowLogRetention(false)}
          onLogged={() => {
            setShowLogRetention(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function LogObligationModal({ productRegistrationId, onClose, onLogged }: { productRegistrationId: string; onClose: () => void; onLogged: () => void }) {
  const { t } = useTranslation()
  const [obligationType, setObligationType] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!obligationType.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createRegPostMarketObligation({ productRegistrationId, obligationType: obligationType.trim(), dueAt: dueAt || undefined })
      onLogged()
    } catch (err) {
      setError(getErrorMessage(err, t('registrationDetail.errorLogObligation')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={t('registrationDetail.logObligationModalTitle')} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text)]">{t('registrationDetail.obligationType')}</label>
          <input
            value={obligationType}
            onChange={(e) => setObligationType(e.target.value)}
            placeholder={t('registrationDetail.obligationTypePlaceholder')}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text)]">{t('registrationDetail.dueDateLabel')}</label>
          <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]" />
        </div>
        {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-xs text-status-error">{error}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)]">
            {t('common.cancel')}
          </button>
          <button onClick={submit} disabled={!obligationType.trim() || saving} className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t('registrationDetail.log')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function FulfillObligationModal({ obligation, onClose, onFulfilled }: { obligation: RegPostMarketObligation; onClose: () => void; onFulfilled: () => void }) {
  const { t } = useTranslation()
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [generateFilingRecord, setGenerateFilingRecord] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      let evidenceDocumentId: string | undefined
      if (file) {
        const version = await uploadDocument('reg_post_market_obligation', obligation.id, file, { title: 'Filing Evidence' })
        evidenceDocumentId = version.documentId
      }
      await fulfillRegPostMarketObligation(obligation.id, { evidenceDocumentId, generateFilingRecord, note: note || undefined })
      onFulfilled()
    } catch (err) {
      setError(getErrorMessage(err, t('registrationDetail.errorFulfill')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={t('registrationDetail.fulfillModalTitle', { type: obligation.obligationType.replace(/_/g, ' ') })} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-[var(--text-muted)]">{t('registrationDetail.fulfillingNote')}</p>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text)]">{t('registrationDetail.evidenceFileOptional')}</label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--text-muted)]">
            <Upload className="h-3.5 w-3.5" /> {file ? file.name : t('registrationDetail.uploadProofOfFiling')}
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs text-[var(--text)]">
          <input type="checkbox" checked={generateFilingRecord} onChange={(e) => setGenerateFilingRecord(e.target.checked)} />
          {t('registrationDetail.generateFilingRecord')}
        </label>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text)]">{t('registrationDetail.noteOptional')}</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]" />
        </div>
        {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-xs text-status-error">{error}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)]">
            {t('common.cancel')}
          </button>
          <button onClick={submit} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t('registrationDetail.fulfill')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** testing-correction-explanation.md §3.3 — two files (invoice + proof of payment) in one request; a real certificate is generated automatically the moment this succeeds. */
function LogRetentionModal({ productRegistrationId, onClose, onLogged }: { productRegistrationId: string; onClose: () => void; onLogged: () => void }) {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(String(currentYear))
  const [paidAt, setPaidAt] = useState('')
  const [invoice, setInvoice] = useState<File | null>(null)
  const [proofOfPayment, setProofOfPayment] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guidanceDocs, setGuidanceDocs] = useState<RequiredDocumentDefinition[]>([])

  // testing-correction-explanation.md §3.7 — the same country/authority/
  // product-class checklist Completeness Check resolves, shown here as
  // pure guidance text (never a blocking requirement — Retention isn't a
  // RegDossier and has no completeness gate at all).
  useEffect(() => {
    getRegistration(productRegistrationId)
      .then((registration) =>
        registration.productClass
          ? classifyRegistration({ authorityId: registration.authorityId, productClass: registration.productClass })
          : null,
      )
      .then((preview) => setGuidanceDocs(preview?.requirement?.documentDefinitions ?? []))
      .catch(() => setGuidanceDocs([]))
  }, [productRegistrationId])

  const canSubmit = year.trim().length > 0 && paidAt.trim().length > 0 && invoice && proofOfPayment

  const submit = async () => {
    if (!canSubmit || !invoice || !proofOfPayment) return
    setSaving(true)
    setError(null)
    try {
      await createRegRetention({
        productRegistrationId,
        year: Number(year),
        paidAt,
        invoice,
        proofOfPayment,
      })
      onLogged()
    } catch (err) {
      setError(getErrorMessage(err, t('registrationDetail.errorLogRetention')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={t('registrationDetail.logRetentionModalTitle')} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-[var(--text-muted)]">{t('registrationDetail.retentionUploadNote')}</p>
        {guidanceDocs.length > 0 && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-3">
            <p className="mb-1.5 text-xs font-medium text-[var(--text)]">{t('registrationDetail.guidanceDocsLabel')}</p>
            <ul className="space-y-0.5 text-xs text-[var(--text-muted)]">
              {guidanceDocs.map((d) => (
                <li key={d.id}>• {d.name}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text)]">{t('registrationDetail.retentionYear')}</label>
            <input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text)]">{t('registrationDetail.paidOn')}</label>
            <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]" />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text)]">{t('registrationDetail.invoice')}</label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--text-muted)]">
            <Upload className="h-3.5 w-3.5" /> {invoice ? invoice.name : t('registrationDetail.uploadRetentionInvoice')}
            <input type="file" className="hidden" onChange={(e) => setInvoice(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text)]">{t('registrationDetail.proofOfPayment')}</label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--text-muted)]">
            <Upload className="h-3.5 w-3.5" /> {proofOfPayment ? proofOfPayment.name : t('registrationDetail.uploadProofOfPayment')}
            <input type="file" className="hidden" onChange={(e) => setProofOfPayment(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-xs text-status-error">{error}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)]">
            {t('common.cancel')}
          </button>
          <button onClick={submit} disabled={!canSubmit || saving} className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t('registrationDetail.logRetention')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
