'use client'

import { BulkImportModal } from '@/components/bulk-import/bulk-import-modal'

interface Props {
  onClose: () => void
  onImported: () => void
}

const IMPORT_TYPE = 'risk_management_plan'

const TEMPLATE_CSV = `Product Brand Name,RMP Title,Summary,Next Renewal Due
Amoxil,Amoxil RMP v1,Standard risk minimisation measures,2027-01-01
Panadol,Panadol RMP v1,Standard risk minimisation measures,2027-06-01
`

/**
 * Real-usage request, 22 Sep 2026 (item 8) — "for a client with many
 * products, allow uploading/bulk-importing RMP data." Matches each row
 * to an already-cataloged product by brand name (must exist first —
 * this never creates a product) and creates a new **draft** RMP
 * version for it, exactly like the "New RMP" action on this same
 * screen — activating still happens one at a time, deliberately.
 */
export function BulkImportRmpsModal({ onClose, onImported }: Props) {
  return (
    <BulkImportModal
      importType={IMPORT_TYPE}
      title="Bulk import Risk Management Plans"
      description={
        <>
          Upload a spreadsheet with columns for <strong>Product Brand Name</strong> (must match an already-cataloged
          product exactly) and <strong>RMP Title</strong> — both required. Summary and Next Renewal Due are optional.
          Each row creates a new draft RMP version for that product — you still attach the document and activate it
          one at a time.
        </>
      }
      templateFilename="safemeds-bulk-rmp-import-template.csv"
      templateCsv={TEMPLATE_CSV}
      resultLabel={(committed) => `${committed} draft RMP${committed === 1 ? '' : 's'} created.`}
      onClose={onClose}
      onImported={onImported}
    />
  )
}
