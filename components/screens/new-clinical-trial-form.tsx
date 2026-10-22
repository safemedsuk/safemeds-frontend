'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Loader2, UploadCloud } from 'lucide-react'
import { Country, getAllCountries } from '@/lib/api/countries'
import { getErrorMessage } from '@/lib/api/client'
import { uploadDocument } from '@/lib/api/documents'
import { useAuthStore } from '@/lib/store/auth-store'
import { BLINDING_TYPE_LABELS, ClinicalTrialBlindingType, createClinicalTrial } from '@/lib/api/clinical-trials'
import { useTranslation } from '@/lib/i18n/use-translation'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

/** Real-usage request, 22 Sep 2026 (item 19) — same server-proxied "upload against a holding pair first" mechanism `call-log-form.tsx` already established for voicemail audio: the trial doesn't exist yet at the moment a PDF is picked, so it uploads scoped to the company itself, and the resulting document id is passed in the trial-creation payload. */
const CLINICAL_TRIAL_APPROVAL_RECORD_TYPE = 'clinical_trial'

function ApprovalUpload({
  label,
  companyId,
  documentId,
  approvalDate,
  expiryDate,
  onDocumentId,
  onApprovalDate,
  onExpiryDate,
}: {
  label: string
  companyId: string | undefined
  documentId: string | null
  approvalDate: string
  expiryDate: string
  onDocumentId: (id: string) => void
  onApprovalDate: (date: string) => void
  onExpiryDate: (date: string) => void
}) {
  const { t } = useTranslation()
  const [uploading, setUploading] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    if (!companyId) return
    setUploading(true)
    setError(null)
    try {
      const version = await uploadDocument(CLINICAL_TRIAL_APPROVAL_RECORD_TYPE, companyId, file, { title: label })
      onDocumentId(version.documentId)
      setFileName(file.name)
    } catch (err) {
      setError(getErrorMessage(err, t('clinicalTrials.newForm.errorUpload', { label: label.toLowerCase() })))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <p className="text-sm font-medium text-foreground">{label} *</p>
      <div className="flex items-center gap-2">
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          disabled={uploading || !companyId}
          className="block flex-1 text-xs text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
        />
        {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {documentId && !uploading && (
          <span className="flex items-center gap-1 text-xs text-status-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> {fileName ?? t('clinicalTrials.newForm.uploaded')}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-status-error">{error}</p>}
      {!documentId && !uploading && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <UploadCloud className="h-3.5 w-3.5" /> {t('clinicalTrials.newForm.requiredBeforeCreate')}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>{t('clinicalTrials.newForm.dateOfApproval')}</label>
          <input type="date" value={approvalDate} onChange={(e) => onApprovalDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t('clinicalTrials.newForm.expiryDate')}</label>
          <input type="date" value={expiryDate} onChange={(e) => onExpiryDate(e.target.value)} className={inputClass} />
          <p className="mt-1 text-xs text-muted-foreground">{t('clinicalTrials.newForm.leaveBlankNoExpiry')}</p>
        </div>
      </div>
    </div>
  )
}

export function NewClinicalTrialForm() {
  const { t } = useTranslation()
  const router = useRouter()
  const companyId = useAuthStore((state) => state.currentUser?.companyId)
  const [countries, setCountries] = useState<Country[]>([])

  const [trialReference, setTrialReference] = useState('')
  const [trialName, setTrialName] = useState('')
  const [sponsor, setSponsor] = useState('')
  const [phase, setPhase] = useState('')
  const [blindingType, setBlindingType] = useState<ClinicalTrialBlindingType>('open_label')
  const [ethicsCommitteeName, setEthicsCommitteeName] = useState('')
  const [ethicsCommitteeContactEmail, setEthicsCommitteeContactEmail] = useState('')
  const [clinicalTrialPortalReference, setClinicalTrialPortalReference] = useState('')
  const [countryId, setCountryId] = useState('')
  const [startDate, setStartDate] = useState('')

  // Real-usage request, 22 Sep 2026 (item 19) — no trial without proof of both approvals.
  const [regulatoryApprovalDocumentId, setRegulatoryApprovalDocumentId] = useState<string | null>(null)
  const [regulatoryApprovalDate, setRegulatoryApprovalDate] = useState('')
  const [regulatoryApprovalExpiryDate, setRegulatoryApprovalExpiryDate] = useState('')
  const [ethicsApprovalDocumentId, setEthicsApprovalDocumentId] = useState<string | null>(null)
  const [ethicsApprovalDate, setEthicsApprovalDate] = useState('')
  const [ethicsApprovalExpiryDate, setEthicsApprovalExpiryDate] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAllCountries()
      .then((rows) => {
        setCountries(rows)
        if (rows.length > 0) setCountryId((prev) => prev || rows[0].id)
      })
      .catch(() => {
        // Best-effort — the select just stays empty if this fails; the user can still retry the whole submit.
      })
  }, [])

  const isValid =
    trialReference.trim().length > 0 &&
    trialName.trim().length > 0 &&
    countryId.length > 0 &&
    startDate.length > 0 &&
    !!regulatoryApprovalDocumentId &&
    regulatoryApprovalDate.length > 0 &&
    !!ethicsApprovalDocumentId &&
    ethicsApprovalDate.length > 0

  const handleSubmit = async () => {
    if (!isValid || !regulatoryApprovalDocumentId || !ethicsApprovalDocumentId) return
    setSubmitting(true)
    setError(null)
    try {
      const trial = await createClinicalTrial({
        trialReference: trialReference.trim(),
        trialName: trialName.trim(),
        sponsor: sponsor.trim() || undefined,
        phase: phase.trim() || undefined,
        blindingType,
        ethicsCommitteeName: ethicsCommitteeName.trim() || undefined,
        ethicsCommitteeContactEmail: ethicsCommitteeContactEmail.trim() || undefined,
        clinicalTrialPortalReference: clinicalTrialPortalReference.trim() || undefined,
        countryId,
        startDate,
        regulatoryApprovalDocumentId,
        regulatoryApprovalDate,
        regulatoryApprovalExpiryDate: regulatoryApprovalExpiryDate || undefined,
        ethicsApprovalDocumentId,
        ethicsApprovalDate,
        ethicsApprovalExpiryDate: ethicsApprovalExpiryDate || undefined,
      })
      router.push(`/clinical-trials/${trial.id}`)
    } catch (err) {
      setError(getErrorMessage(err, t('clinicalTrials.newForm.errorCreate')))
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <button onClick={() => router.push('/clinical-trials')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t('clinicalTrials.newForm.backToList')}
      </button>

      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">{t('clinicalTrials.newForm.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('clinicalTrials.newForm.subtitle')}</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>{t('clinicalTrials.newForm.trialReference')}</label>
            <input value={trialReference} onChange={(e) => setTrialReference(e.target.value)} placeholder="e.g. NCT-0001" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t('clinicalTrials.newForm.phase')}</label>
            <input value={phase} onChange={(e) => setPhase(e.target.value)} placeholder="e.g. Phase II/III" className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>{t('clinicalTrials.newForm.trialName')}</label>
          <input value={trialName} onChange={(e) => setTrialName(e.target.value)} className={inputClass} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>{t('clinicalTrials.newForm.sponsor')}</label>
            <input value={sponsor} onChange={(e) => setSponsor(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t('clinicalTrials.newForm.blinding')}</label>
            <select value={blindingType} onChange={(e) => setBlindingType(e.target.value as ClinicalTrialBlindingType)} className={inputClass}>
              {Object.entries(BLINDING_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>{t('clinicalTrials.newForm.country')}</label>
            <select value={countryId} onChange={(e) => setCountryId(e.target.value)} className={inputClass}>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t('clinicalTrials.newForm.startDate')}</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="border-t border-border pt-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('clinicalTrials.newForm.approvalsRequired')}</p>
          <ApprovalUpload
            label={t('clinicalTrials.newForm.regulatoryAuthorityApproval')}
            companyId={companyId ?? undefined}
            documentId={regulatoryApprovalDocumentId}
            approvalDate={regulatoryApprovalDate}
            expiryDate={regulatoryApprovalExpiryDate}
            onDocumentId={setRegulatoryApprovalDocumentId}
            onApprovalDate={setRegulatoryApprovalDate}
            onExpiryDate={setRegulatoryApprovalExpiryDate}
          />
          <ApprovalUpload
            label={t('clinicalTrials.newForm.ethicsCommitteeApproval')}
            companyId={companyId ?? undefined}
            documentId={ethicsApprovalDocumentId}
            approvalDate={ethicsApprovalDate}
            expiryDate={ethicsApprovalExpiryDate}
            onDocumentId={setEthicsApprovalDocumentId}
            onApprovalDate={setEthicsApprovalDate}
            onExpiryDate={setEthicsApprovalExpiryDate}
          />
        </div>

        <div className="border-t border-border pt-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('clinicalTrials.newForm.ethicsCommitteeAndPortal')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t('clinicalTrials.newForm.ethicsCommitteeName')}</label>
              <input value={ethicsCommitteeName} onChange={(e) => setEthicsCommitteeName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('clinicalTrials.newForm.ethicsCommitteeContactEmail')}</label>
              <input type="email" value={ethicsCommitteeContactEmail} onChange={(e) => setEthicsCommitteeContactEmail(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>{t('clinicalTrials.newForm.portalReference')}</label>
            <input
              value={clinicalTrialPortalReference}
              onChange={(e) => setClinicalTrialPortalReference(e.target.value)}
              placeholder={t('clinicalTrials.newForm.portalReferencePlaceholder')}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-muted-foreground">{t('clinicalTrials.newForm.portalReferenceHelp')}</p>
          </div>
        </div>

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end gap-3 border-t border-border pt-5">
          <button onClick={() => router.push('/clinical-trials')} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('clinicalTrials.newForm.createTrial')}
          </button>
        </div>
      </div>
    </div>
  )
}
