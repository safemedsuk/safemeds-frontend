'use client'

import { BulkImportModal } from '@/components/bulk-import/bulk-import-modal'
import { TENANT_ROLES } from '@/lib/tenant-roles'

interface Props {
  onClose: () => void
  onImported: () => void
}

const IMPORT_TYPE = 'user_invite'

// Same labels as the "Add User" modal's role checkboxes — a person
// preparing this file never needs to know a raw role key like
// "SUPERINTENDENT_PHARMACIST"; the backend resolves either form.
const TEMPLATE_CSV = `Email Address,Role(s)\njeff@example.com,${TENANT_ROLES[2].label}\nrobert@example.com,${TENANT_ROLES[3].label};${TENANT_ROLES[5].label}\n`

/**
 * VigiCloud Stage 0.6 — bulk-inviting users by CSV or Excel (email +
 * semicolon-separated role names), reusing the exact same `/invitations`
 * flow the single "Add User" button already drives, just row-by-row from
 * a file instead of one form submission. A thin, importer-specific
 * wrapper around the shared `BulkImportModal` (Stage 2 generalized this
 * from what used to be a user-invite-only component).
 */
export function BulkImportUsersModal({ onClose, onImported }: Props) {
  return (
    <BulkImportModal
      importType={IMPORT_TYPE}
      title="Bulk invite users"
      description={
        <>
          Upload a spreadsheet with a column for <strong>email</strong> and a column for <strong>role(s)</strong> — the
          column headers don&apos;t have to match exactly (e.g. &quot;Email Address&quot; or &quot;Roles&quot; both work).
          For more than one role in a cell, separate them with a semicolon (<code className="bg-[var(--surface-raised)] px-1 rounded">;</code>).
        </>
      }
      helpPanel={{ title: 'Valid roles', values: TENANT_ROLES.map((r) => r.label) }}
      templateFilename="safemeds-bulk-invite-template.csv"
      templateCsv={TEMPLATE_CSV}
      resultLabel={(committed) => `${committed} invitation${committed === 1 ? '' : 's'} sent.`}
      onClose={onClose}
      onImported={onImported}
    />
  )
}
