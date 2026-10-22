'use client'

import { useCallback, useEffect, useState } from 'react'
import { Eye, EyeOff, FlaskConical, Loader2, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { ClinicalTrialWithSubjects, getClinicalTrial, revealTreatmentArm } from '@/lib/api/clinical-trials'
import { SignatureModal } from '@/components/ui/signature-modal'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTranslation } from '@/lib/i18n/use-translation'

interface Props {
  clinicalTrialId: string
  clinicalTrialSubjectId: string | null
}

/**
 * VigiCloud Stage 14 — compact clinical-trial context on the case detail
 * page itself, so a QPPV doing causality assessment on an SAE doesn't
 * have to navigate away to the trial page to reveal the linked subject's
 * treatment arm. Reuses the exact same signature-gated reveal action the
 * trial detail page's own subject roster uses — this is a second
 * consumer of that one mechanism, not a parallel one.
 */
export function ClinicalTrialInfoPanel({ clinicalTrialId, clinicalTrialSubjectId }: Props) {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canUnblind = has('pv.unblind_treatment')

  const [trial, setTrial] = useState<ClinicalTrialWithSubjects | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSignature, setShowSignature] = useState(false)
  const [revealedArm, setRevealedArm] = useState<string | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setTrial(await getClinicalTrial(clinicalTrialId))
    } catch {
      // Best-effort — the case itself already loaded; a trial-context hiccup shouldn't block the page.
    } finally {
      setLoading(false)
    }
  }, [clinicalTrialId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
  }
  if (!trial) return null

  const subject = clinicalTrialSubjectId ? trial.subjects.find((s) => s.id === clinicalTrialSubjectId) : null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-safemeds-teal" />
        <span className="text-sm font-medium text-foreground">{trial.trialReference}</span>
        <span className="text-xs text-muted-foreground">— {trial.trialName}</span>
      </div>

      {subject ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <span className="text-xs text-muted-foreground">
            {t('clinicalTrialInfoPanel.subject')} <span className="font-mono text-foreground">{subject.subjectCode}</span>
          </span>
          {revealedArm !== undefined ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-status-warning">
              <Eye className="h-3.5 w-3.5" /> {t('clinicalTrialInfoPanel.treatmentArm', { arm: revealedArm ?? '' })}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <EyeOff className="h-3.5 w-3.5" /> {t('clinicalTrialInfoPanel.treatmentArmBlinded')}
              {subject.blindingBroken ? t('clinicalTrialInfoPanel.previouslyUnblinded') : ''}
            </span>
          )}
          {canUnblind && revealedArm === undefined && (
            <button onClick={() => setShowSignature(true)} className="text-xs font-medium text-safemeds-teal hover:underline">
              {t('clinicalTrialInfoPanel.revealTreatmentArm')}
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t('clinicalTrialInfoPanel.noSubjectLinked')}</p>
      )}

      {!canUnblind && subject && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldAlert className="h-3.5 w-3.5" /> {t('clinicalTrialInfoPanel.unblindRequiresSignature')}
        </p>
      )}

      {error && <p className="text-xs text-status-error">{error}</p>}

      {showSignature && subject && (
        <SignatureModal
          isOpen={true}
          onClose={() => setShowSignature(false)}
          documentTitle={t('clinicalTrialInfoPanel.revealTitle', { code: subject.subjectCode })}
          documentId={subject.id}
          onSigned={async ({ signatureToken, intentStatement }) => {
            setError(null)
            try {
              const result = await revealTreatmentArm(subject.id, { reason: intentStatement, intentStatement, signatureToken })
              setRevealedArm(result.treatmentArm)
              setShowSignature(false)
            } catch (err) {
              setError(getErrorMessage(err, t('clinicalTrialInfoPanel.errorReveal')))
              throw err
            }
          }}
        />
      )}
    </div>
  )
}
