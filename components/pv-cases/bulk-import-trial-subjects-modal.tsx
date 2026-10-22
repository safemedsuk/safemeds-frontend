'use client'

import { BulkImportModal } from '@/components/bulk-import/bulk-import-modal'
import { useTranslation } from '@/lib/i18n/use-translation'

interface Props {
  onClose: () => void
  onImported: () => void
}

const IMPORT_TYPE = 'clinical_trial_patient'

const TEMPLATE_CSV = `Trial Reference,Subject Code,Sex,Age,Enrollment Date
NCT-0001,SUBJ-01,Female,34,2026-01-15
NCT-0001,SUBJ-02,Male,52,2026-01-18
`

/**
 * VigiCloud Stage 14 — "Bulk import of clinical-trial patient sets."
 * Deliberately has no treatment-arm column — a bulk spreadsheet is not
 * the place to introduce a blinded value into the system; enroll with
 * a known treatment arm one subject at a time via the trial detail
 * page instead. Thin wrapper around the shared `BulkImportModal`, same
 * pattern as `BulkImportProductsModal`.
 */
export function BulkImportTrialSubjectsModal({ onClose, onImported }: Props) {
  const { t } = useTranslation()
  return (
    <BulkImportModal
      importType={IMPORT_TYPE}
      title={t('bulkImportTrialSubjects.title')}
      description={
        <>
          {t('bulkImportTrialSubjects.descriptionPrefix')} <strong>{t('bulkImportTrialSubjects.trialReference')}</strong>{' '}
          {t('bulkImportTrialSubjects.descriptionMiddle')} <strong>{t('bulkImportTrialSubjects.subjectCode')}</strong>, {t('bulkImportTrialSubjects.descriptionAnd')}{' '}
          <strong>{t('bulkImportTrialSubjects.enrollmentDate')}</strong> {t('bulkImportTrialSubjects.descriptionSuffix')}
        </>
      }
      templateFilename="safemeds-bulk-trial-subject-import-template.csv"
      templateCsv={TEMPLATE_CSV}
      resultLabel={(committed) =>
        committed === 1 ? t('bulkImportTrialSubjects.resultLabelSingular', { count: committed }) : t('bulkImportTrialSubjects.resultLabelPlural', { count: committed })
      }
      onClose={onClose}
      onImported={onImported}
    />
  )
}
