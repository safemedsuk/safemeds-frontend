'use client'

import { BulkImportModal } from '@/components/bulk-import/bulk-import-modal'

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
  return (
    <BulkImportModal
      importType={IMPORT_TYPE}
      title="Bulk import trial subjects"
      description={
        <>
          Upload a spreadsheet with columns for <strong>Trial Reference</strong> (must match an existing trial&apos;s
          reference exactly), <strong>Subject Code</strong>, and <strong>Enrollment Date</strong> — those three are
          required. Sex and Age are optional. This does not set a treatment-arm assignment — enroll with a known
          arm one subject at a time on the trial page instead.
        </>
      }
      templateFilename="safemeds-bulk-trial-subject-import-template.csv"
      templateCsv={TEMPLATE_CSV}
      resultLabel={(committed) => `${committed} subject${committed === 1 ? '' : 's'} enrolled.`}
      onClose={onClose}
      onImported={onImported}
    />
  )
}
