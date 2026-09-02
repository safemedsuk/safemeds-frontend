'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Eye, EyeOff, FileCheck2, FlaskConical, Loader2, Plus, ShieldAlert, UploadCloud, UserPlus } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  BLINDING_TYPE_LABELS,
  ClinicalTrialSubject,
  ClinicalTrialWithSubjects,
  enrollTrialSubject,
  getClinicalTrial,
  listClinicalTrialSubjects,
  revealTreatmentArm,
  TRIAL_STATUS_LABELS,
  updateClinicalTrial,
} from '@/lib/api/clinical-trials'
import { PatientSex } from '@/lib/api/pv-cases'
import { createRegDossier, listRegDossiers, RegDossier } from '@/lib/api/reg-dossiers'
import { listProducts, Product } from '@/lib/api/master-data'
import { getCountryConfig } from '@/lib/api/country-config'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { SignatureModal } from '@/components/ui/signature-modal'
import { ProductClassPicker } from '@/components/regulatory/product-class-picker'
import { BulkImportTrialSubjectsModal } from '@/components/pv-cases/bulk-import-trial-subjects-modal'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

function subjectColumns(
  revealedArms: Record<string, string | null>,
  canUnblind: boolean,
  onRevealClick: (subject: ClinicalTrialSubject) => void,
): DataTableColumn<ClinicalTrialSubject>[] {
  return [
    { key: 'subjectCode', label: 'Subject Code', render: (v) => <span className="font-mono text-xs">{v}</span> },
    { key: 'sex', label: 'Sex', render: (v) => <span className="capitalize">{v}</span> },
    { key: 'ageYears', label: 'Age', render: (v) => v ?? '—' },
    { key: 'enrolledAt', label: 'Enrolled', sortable: true, render: (v) => formatDate(v) },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground capitalize">{v}</span>,
    },
    {
      key: 'blindingBroken',
      label: 'Treatment Arm',
      render: (_v, row) =>
        revealedArms[row.id] !== undefined ? (
          <span className="flex items-center gap-1 text-xs font-medium text-status-warning">
            <Eye className="h-3.5 w-3.5" /> {revealedArms[row.id]}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <EyeOff className="h-3.5 w-3.5" /> Blinded{row.blindingBroken ? ' (previously unblinded)' : ''}
          </span>
        ),
    },
    {
      key: 'unblindedAt',
      label: '',
      render: (_v, row) =>
        canUnblind && revealedArms[row.id] === undefined ? (
          <button onClick={() => onRevealClick(row)} className="text-xs font-medium text-safemeds-teal hover:underline whitespace-nowrap">
            Reveal Treatment Arm
          </button>
        ) : null,
    },
  ]
}

interface Props {
  trialId: string
}

export function ClinicalTrialDetail({ trialId }: Props) {
  const router = useRouter()
  const { has } = usePermissions()
  const canManage = has('pv.manage_clinical_trials')
  const canUnblind = has('pv.unblind_treatment')
  const canManageDossier = has('regulatory.manage_dossier')

  const [trial, setTrial] = useState<ClinicalTrialWithSubjects | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()

  const [showEnroll, setShowEnroll] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [revealTarget, setRevealTarget] = useState<ClinicalTrialSubject | null>(null)
  const [revealedArms, setRevealedArms] = useState<Record<string, string | null>>({})

  // Special Corner SC-5 — Enrolled Subjects is its own real, server-paginated
  // list (see `listClinicalTrialSubjects()`'s own doc comment for why this
  // is separate from `trial.subjects`).
  const [subjects, setSubjects] = useState<ClinicalTrialSubject[]>([])
  const [subjectsLoading, setSubjectsLoading] = useState(true)
  const [subjectsPage, setSubjectsPage] = useState(1)
  const [subjectsLimit, setSubjectsLimit] = useState(10)
  const [subjectsTotalPages, setSubjectsTotalPages] = useState(1)
  const [subjectsTotal, setSubjectsTotal] = useState(0)

  // RegCloud (Phase 12) Stage 12 — Clinical Trials Regulatory Route: every
  // Clinical Trial Application dossier ever filed for this trial (initial +
  // any amendment), reusing `RegDossier`'s own mechanics entirely.
  const [dossiers, setDossiers] = useState<RegDossier[]>([])
  const [dossiersLoading, setDossiersLoading] = useState(true)
  const [showStartDossier, setShowStartDossier] = useState(false)

  const loadDossiers = useCallback(async () => {
    setDossiersLoading(true)
    try {
      const { rows } = await listRegDossiers({ clinicalTrialId: trialId, limit: 50 })
      setDossiers(rows)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load this trial’s regulatory dossiers.'))
    } finally {
      setDossiersLoading(false)
    }
  }, [trialId])

  useEffect(() => {
    loadDossiers()
  }, [loadDossiers])

  // `silent` refreshes must never re-show the spinner — see
  // `pv-case-detail.tsx`'s identical fix for the full reasoning.
  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      setError(null)
      try {
        setTrial(await getClinicalTrial(trialId))
      } catch (err) {
        setError(getErrorMessage(err, 'Could not load this clinical trial.'))
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [trialId],
  )

  const refresh = useCallback(() => load(true), [load])

  const loadSubjects = useCallback(
    async (page = subjectsPage, limit = subjectsLimit) => {
      setSubjectsLoading(true)
      try {
        const { subjects: rows, meta } = await listClinicalTrialSubjects(trialId, page, limit)
        setSubjects(rows)
        setSubjectsTotalPages(meta.totalPages)
        setSubjectsTotal(meta.total)
      } catch (err) {
        setError(getErrorMessage(err, 'Could not load enrolled subjects.'))
      } finally {
        setSubjectsLoading(false)
      }
    },
    [trialId, subjectsPage, subjectsLimit],
  )

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    loadSubjects(subjectsPage, subjectsLimit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trialId, subjectsPage, subjectsLimit])

  const handleSubjectsPageChange = (page: number) => setSubjectsPage(page)
  const handleSubjectsRowsPerPageChange = (limit: number) => {
    setSubjectsLimit(limit)
    setSubjectsPage(1)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !trial) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error ?? 'Trial not found.'}</div>
      </div>
    )
  }

  const handleStatusChange = async (status: 'active' | 'completed' | 'terminated') => {
    try {
      const updated = await updateClinicalTrial(trial.id, { status })
      setTrial({ ...trial, ...updated })
      setNotice(`Status updated to ${TRIAL_STATUS_LABELS[status]}.`)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update status.'))
    }
  }

  return (
    <div className="space-y-6 p-6">
      <button onClick={() => router.push('/clinical-trials')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Clinical Trials
      </button>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <FlaskConical className="h-6 w-6 text-safemeds-teal" />
            <h1 className="text-2xl font-display font-bold text-foreground">{trial.trialName}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground font-mono">{trial.trialReference}</p>
        </div>
        {canManage ? (
          <select
            value={trial.status}
            onChange={(e) => handleStatusChange(e.target.value as 'active' | 'completed' | 'terminated')}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            {Object.entries(TRIAL_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        ) : (
          <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-foreground">{TRIAL_STATUS_LABELS[trial.status]}</span>
        )}
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      {/* Trial-level dashboard — Stage 14's own "open SAEs, upcoming annual renewal" requirement */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Open SAEs</p>
          <p className={`mt-1 text-2xl font-display font-bold ${trial.openSaeCaseCount > 0 ? 'text-status-warning' : 'text-foreground'}`}>{trial.openSaeCaseCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Enrolled Subjects</p>
          <p className="mt-1 text-2xl font-display font-bold text-foreground">{trial.subjectCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Annual Renewal Due</p>
          <p className="mt-1 text-2xl font-display font-bold text-foreground">{formatDate(trial.annualRenewalDueAt)}</p>
          <p className="mt-1 text-xs text-muted-foreground">AE line listing + DSUR</p>
        </div>
      </div>

      {/* Trial details */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Trial Details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Sponsor</p>
            <p className="text-sm text-foreground">{trial.sponsor ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Phase</p>
            <p className="text-sm text-foreground">{trial.phase ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Blinding</p>
            <p className="text-sm text-foreground">{BLINDING_TYPE_LABELS[trial.blindingType]}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Start Date</p>
            <p className="text-sm text-foreground">{formatDate(trial.startDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ethics Committee</p>
            <p className="text-sm text-foreground">{trial.ethicsCommitteeName ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ethics Committee Contact</p>
            <p className="text-sm text-foreground">{trial.ethicsCommitteeContactEmail ?? '—'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground">Clinical Trial Portal Reference</p>
            <p className="text-sm text-foreground">{trial.clinicalTrialPortalReference ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* RegCloud (Phase 12) Stage 12 — Clinical Trials Regulatory Route: every CTA dossier ever filed for this trial, through the exact same reg_dossier mechanics as any other dossier. */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Regulatory — Clinical Trial Application Dossiers</h2>
          {canManageDossier && (
            <button
              onClick={() => setShowStartDossier(true)}
              className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce"
            >
              <Plus className="h-3.5 w-3.5" /> Start CTA Dossier
            </button>
          )}
        </div>
        {dossiersLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : dossiers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Clinical Trial Application dossier has been started for this trial yet.</p>
        ) : (
          <ul className="space-y-2">
            {dossiers.map((d) => (
              <li key={d.id}>
                <button
                  onClick={() => router.push(`/reg-dossiers/${d.id}`)}
                  className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left hover:bg-muted"
                >
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    <FileCheck2 className="h-4 w-4 text-safemeds-teal" />
                    {d.product.brandName} · {d.authority.name}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize text-foreground">{d.status.replace(/_/g, ' ')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Subject roster */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Enrolled Subjects</h2>
          {canManage && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowBulkImport(true)}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                <UploadCloud className="h-3.5 w-3.5" /> Bulk Import
              </button>
              <button
                onClick={() => setShowEnroll(true)}
                className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce"
              >
                <UserPlus className="h-3.5 w-3.5" /> Enroll Subject
              </button>
            </div>
          )}
        </div>

        <DataTableV2<ClinicalTrialSubject>
          data={subjects}
          columns={subjectColumns(revealedArms, canUnblind, setRevealTarget)}
          searchable={false}
          exportable={false}
          showDensityToggle={false}
          loading={subjectsLoading}
          page={subjectsPage}
          totalPages={subjectsTotalPages}
          totalCount={subjectsTotal}
          onPageChange={handleSubjectsPageChange}
          rowsPerPage={subjectsLimit}
          onRowsPerPageChange={handleSubjectsRowsPerPageChange}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
        {!subjectsLoading && subjects.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No subjects enrolled yet.</p>}

        {!canUnblind && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5" /> Revealing a treatment-arm assignment requires the QPPV-held unblinding permission and a fresh electronic signature.
          </p>
        )}
      </div>

      {showEnroll && (
        <EnrollSubjectModal
          trialId={trial.id}
          onClose={() => setShowEnroll(false)}
          onEnrolled={() => {
            setShowEnroll(false)
            refresh()
            setSubjectsPage(1)
            loadSubjects(1, subjectsLimit)
          }}
        />
      )}

      {showBulkImport && (
        <BulkImportTrialSubjectsModal
          onClose={() => setShowBulkImport(false)}
          onImported={() => {
            setShowBulkImport(false)
            refresh()
            setSubjectsPage(1)
            loadSubjects(1, subjectsLimit)
          }}
        />
      )}

      {showStartDossier && (
        <StartCtaDossierModal
          trialId={trial.id}
          countryId={trial.countryId}
          onClose={() => setShowStartDossier(false)}
          onCreated={(dossierId) => {
            setShowStartDossier(false)
            router.push(`/reg-dossiers/${dossierId}`)
          }}
        />
      )}

      {revealTarget && (
        <SignatureModal
          isOpen={true}
          onClose={() => setRevealTarget(null)}
          documentTitle={`Reveal treatment arm — subject ${revealTarget.subjectCode}`}
          documentId={revealTarget.id}
          onSigned={async ({ signatureToken, intentStatement }) => {
            const subject = revealTarget
            const result = await revealTreatmentArm(subject.id, { reason: intentStatement, intentStatement, signatureToken })
            setRevealedArms((prev) => ({ ...prev, [subject.id]: result.treatmentArm }))
            setRevealTarget(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function EnrollSubjectModal({ trialId, onClose, onEnrolled }: { trialId: string; onClose: () => void; onEnrolled: () => void }) {
  const [subjectCode, setSubjectCode] = useState('')
  const [sex, setSex] = useState<PatientSex>('unknown')
  const [ageYears, setAgeYears] = useState('')
  const [enrolledAt, setEnrolledAt] = useState('')
  const [treatmentArm, setTreatmentArm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = subjectCode.trim().length > 0 && enrolledAt.length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await enrollTrialSubject(trialId, {
        subjectCode: subjectCode.trim(),
        sex,
        ageYears: ageYears ? Number(ageYears) : undefined,
        enrolledAt,
        treatmentArm: treatmentArm.trim() || undefined,
      })
      onEnrolled()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not enroll this subject.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">Enroll Trial Subject</h2>

        <div>
          <label className={labelClass}>Subject Code *</label>
          <input value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} placeholder="e.g. SUBJ-01 — never a name" className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Sex</label>
            <select value={sex} onChange={(e) => setSex(e.target.value as PatientSex)} className={inputClass}>
              <option value="unknown">Unknown</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Age (years)</label>
            <input type="number" min={0} max={130} value={ageYears} onChange={(e) => setAgeYears(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Enrollment Date *</label>
          <input type="date" value={enrolledAt} onChange={(e) => setEnrolledAt(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Treatment Arm (if already known)</label>
          <input value={treatmentArm} onChange={(e) => setTreatmentArm(e.target.value)} placeholder="e.g. Arm A (active, 500mg)" className={inputClass} />
          <p className="mt-1 text-xs text-muted-foreground">Encrypted at rest and blinded by default — only a signature-gated reveal can ever show it again.</p>
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
            Enroll
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * RegCloud (Phase 12) Stage 12 — the entire mechanism here is
 * `RegDossierService.create()` with `clinicalTrialId` set, the exact same
 * dossier-creation path any other registration goes through; this modal is
 * just the product/authority picker that path needs to get started.
 */
function StartCtaDossierModal({
  trialId,
  countryId,
  onClose,
  onCreated,
}: {
  trialId: string
  countryId: string
  onClose: () => void
  onCreated: (dossierId: string) => void
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [authorities, setAuthorities] = useState<{ id: string; name: string; code: string }[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [productId, setProductId] = useState('')
  const [authorityId, setAuthorityId] = useState('')
  const [productClass, setProductClass] = useState('clinical_trial_imp')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoadingOptions(true)
    Promise.all([listProducts({ limit: 100 }), getCountryConfig(countryId)])
      .then(([productPage, authorityNodes]) => {
        setProducts(productPage.rows)
        setProductId(productPage.rows[0]?.id ?? '')
        const flatAuthorities = authorityNodes.map((a) => ({ id: a.id, name: a.name, code: a.code }))
        setAuthorities(flatAuthorities)
        setAuthorityId(flatAuthorities[0]?.id ?? '')
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load products/authorities.')))
      .finally(() => setLoadingOptions(false))
  }, [countryId])

  const isValid = productId.length > 0 && authorityId.length > 0 && productClass.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      const created = await createRegDossier({ productId, authorityId, productClass: productClass.trim(), clinicalTrialId: trialId })
      onCreated(created.id)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not start this dossier.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">Start Clinical Trial Application Dossier</h2>

        {loadingOptions ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div>
              <label className={labelClass}>Product (the IMP)</label>
              <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
                {products.length === 0 && <option value="">No products yet — add one first</option>}
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.brandName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Authority</label>
              <select value={authorityId} onChange={(e) => setAuthorityId(e.target.value)} className={inputClass}>
                {authorities.length === 0 && <option value="">No configured authorities for this trial’s country</option>}
                {authorities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Product class</label>
              <ProductClassPicker key={authorityId} authorityId={authorityId || undefined} value={productClass} onChange={setProductClass} className={inputClass} />
            </div>
          </>
        )}

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting || loadingOptions}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Start Dossier
          </button>
        </div>
      </div>
    </div>
  )
}
