'use client'

import { BulkImportModal } from '@/components/bulk-import/bulk-import-modal'
import { TENANT_ROLES, tenantRoleLabel } from '@/lib/tenant-roles'
import { useTranslation } from '@/lib/i18n/use-translation'

interface Props {
  onClose: () => void
  onImported: () => void
}

const IMPORT_TYPE = 'user_invite'

/**
 * VigiCloud Stage 0.6 — bulk-inviting users by CSV or Excel (email +
 * semicolon-separated role names), reusing the exact same `/invitations`
 * flow the single "Add User" button already drives, just row-by-row from
 * a file instead of one form submission. A thin, importer-specific
 * wrapper around the shared `BulkImportModal` (Stage 2 generalized this
 * from what used to be a user-invite-only component).
 */
export function BulkImportUsersModal({ onClose, onImported }: Props) {
  const { t } = useTranslation()

  // Same labels as the "Add User" modal's role checkboxes — a person
  // preparing this file never needs to know a raw role key like
  // "SUPERINTENDENT_PHARMACIST"; the backend resolves either form.
  const templateCsv = `Email Address,Role(s)\njeff@example.com,${tenantRoleLabel(TENANT_ROLES[2].key, t)}\nrobert@example.com,${tenantRoleLabel(TENANT_ROLES[3].key, t)};${tenantRoleLabel(TENANT_ROLES[5].key, t)}\n`

  return (
    <BulkImportModal
      importType={IMPORT_TYPE}
      title={t('users.bulkImport.title')}
      description={
        <>
          {t('users.bulkImport.descriptionPrefix')} <strong>{t('users.bulkImport.email')}</strong>{' '}
          {t('users.bulkImport.descriptionMiddle')} <strong>{t('users.bulkImport.roles')}</strong> —{' '}
          {t('users.bulkImport.descriptionSuffix')} (
          <code className="bg-[var(--surface-raised)] px-1 rounded">;</code>).
        </>
      }
      helpPanel={{ title: t('users.bulkImport.validRoles'), values: TENANT_ROLES.map((r) => tenantRoleLabel(r.key, t)) }}
      templateFilename="safemeds-bulk-invite-template.csv"
      templateCsv={templateCsv}
      resultLabel={(committed) => (committed === 1 ? t('users.bulkImport.resultLabelOne') : t('users.bulkImport.resultLabelMany', { count: committed }))}
      onClose={onClose}
      onImported={onImported}
    />
  )
}
