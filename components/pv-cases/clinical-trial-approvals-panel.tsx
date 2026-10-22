'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, RefreshCw, ShieldAlert, UploadCloud } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { ApprovalStatus, ClinicalTrial, renewClinicalTrialApproval } from '@/lib/api/clinical-trials'
import { uploadDocument } from '@/lib/api/documents'
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

const CLINICAL_TRIAL_APPROVAL_RECORD_TYPE = 'clinical_trial'

const STATUS_STYLES: Record<ApprovalStatus, string> = {
  valid: 'bg-status-success/10 text-status-success',
  no_expiry: 'bg-status-success/10 text-status-success',
  expiring: 'bg-status-warning/10 text-status-warning',
  expired: 'bg-status-error/10 text-status-error',
  missing: 'bg-status-error/10 text-status-error',
}

const STATUS_LABEL_KEYS: Record<ApprovalStatus, MessageKey> = {
  valid: 'clinicalTrialApprovalsPanel.statusValid',
  no_expiry: 'clinicalTrialApprovalsPanel.statusNoExpiry',
  expiring: 'clinicalTrialApprovalsPanel.statusExpiring',
  expired: 'clinicalTrialApprovalsPanel.statusExpired',
  missing: 'clinicalTrialApprovalsPanel.statusMissing',
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

interface Props {
  trial: ClinicalTrial
  companyId: string | undefined
  canManage: boolean
  onRenewed: (updated: ClinicalTrial) => void
}

/**
 * Real-usage request, 22 Sep 2026 (items 19/20) — the trial detail
 * page's own view of both required approvals: live expiring/expired
 * status (mirroring `sdea.tsx`'s own distributor-status pill exactly)
 * plus a renewal action per approval, independent of the other.
 */
export function ClinicalTrialApprovalsPanel({ trial, companyId, canManage, onRenewed }: Props) {
  const { t } = useTranslation()
  const [renewing, setRenewing] = useState<'regulatory' | 'ethics' | null>(null)

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="text-sm font-semibold text-foreground mb-4">{t('clinicalTrialApprovalsPanel.approvals')}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <ApprovalCard
          label={t('clinicalTrialApprovalsPanel.regulatoryAuthorityApproval')}
          approvalDate={trial.regulatoryApprovalDate}
          expiryDate={trial.regulatoryApprovalExpiryDate}
          status={trial.regulatoryApprovalStatus}
          canManage={canManage}
          onRenew={() => setRenewing('regulatory')}
        />
        <ApprovalCard
          label={t('clinicalTrialApprovalsPanel.ethicsCommitteeApproval')}
          approvalDate={trial.ethicsApprovalDate}
          expiryDate={trial.ethicsApprovalExpiryDate}
          status={trial.ethicsApprovalStatus}
          canManage={canManage}
          onRenew={() => setRenewing('ethics')}
        />
      </div>

      {renewing && companyId && (
        <RenewApprovalModal
          approvalType={renewing}
          trial={trial}
          companyId={companyId}
          onClose={() => setRenewing(null)}
          onRenewed={(updated) => {
            onRenewed(updated)
            setRenewing(null)
          }}
        />
      )}
    </div>
  )
}

function ApprovalCard({
  label,
  approvalDate,
  expiryDate,
  status,
  canManage,
  onRenew,
}: {
  label: string
  approvalDate: string | null
  expiryDate: string | null
  status: ApprovalStatus
  canManage: boolean
  onRenew: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="rounded-lg border border-border p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
          {status === 'expired' || status === 'missing' ? <ShieldAlert className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
          {t(STATUS_LABEL_KEYS[status])}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{t('clinicalTrialApprovalsPanel.approved', { date: formatDate(approvalDate) })}</p>
      <p className="text-xs text-muted-foreground">{expiryDate ? t('clinicalTrialApprovalsPanel.expires', { date: formatDate(expiryDate) }) : t('clinicalTrialApprovalsPanel.noExpiryDate')}</p>
      {canManage && (
        <button onClick={onRenew} className="flex items-center gap-1.5 text-xs font-medium text-safemeds-teal hover:underline">
          <RefreshCw className="h-3.5 w-3.5" /> {t('clinicalTrialApprovalsPanel.renew')}
        </button>
      )}
    </div>
  )
}

function RenewApprovalModal({
  approvalType,
  trial,
  companyId,
  onClose,
  onRenewed,
}: {
  approvalType: 'regulatory' | 'ethics'
  trial: ClinicalTrial
  companyId: string
  onClose: () => void
  onRenewed: (updated: ClinicalTrial) => void
}) {
  const { t } = useTranslation()
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [approvalDate, setApprovalDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const label = approvalType === 'regulatory' ? t('clinicalTrialApprovalsPanel.regulatoryAuthorityApproval') : t('clinicalTrialApprovalsPanel.ethicsCommitteeApproval')

  const handleFile = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const version = await uploadDocument(CLINICAL_TRIAL_APPROVAL_RECORD_TYPE, companyId, file, { title: t('clinicalTrialApprovalsPanel.renewedTitle', { label }) })
      setDocumentId(version.documentId)
      setFileName(file.name)
    } catch (err) {
      setError(getErrorMessage(err, t('clinicalTrialApprovalsPanel.errorUpload')))
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    if (!documentId || !approvalDate) return
    setSubmitting(true)
    setError(null)
    try {
      const updated = await renewClinicalTrialApproval(trial.id, {
        approvalType,
        documentId,
        approvalDate,
        expiryDate: expiryDate || undefined,
      })
      onRenewed(updated)
    } catch (err) {
      setError(getErrorMessage(err, t('clinicalTrialApprovalsPanel.errorRenew')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">{t('clinicalTrialApprovalsPanel.renewTitle', { label })}</h3>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{t('clinicalTrialApprovalsPanel.newApprovalDocument')}</p>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              disabled={uploading}
              className="block flex-1 text-xs text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
            />
            {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          {documentId && !uploading && (
            <p className="flex items-center gap-1 text-xs text-status-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> {fileName ?? t('clinicalTrialApprovalsPanel.uploaded')}
            </p>
          )}
          {!documentId && !uploading && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <UploadCloud className="h-3.5 w-3.5" /> {t('clinicalTrialApprovalsPanel.requiredBeforeSave')}
            </p>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('clinicalTrialApprovalsPanel.newApprovalDate')}</label>
            <input type="date" value={approvalDate} onChange={(e) => setApprovalDate(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('clinicalTrialApprovalsPanel.newExpiryDate')}</label>
            <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" />
          </div>
        </div>
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
            {t('clinicalTrialApprovalsPanel.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!documentId || !approvalDate || submitting}
            className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t('clinicalTrialApprovalsPanel.saveRenewal')}
          </button>
        </div>
      </div>
    </div>
  )
}
