import type { MessageKey } from './i18n/messages/en'

/** Mirrors `TENANT_ROLE_KEYS` on the backend (`src/common/tenant-roles.const.ts`) — Phase 2 will replace this with a fetched `/roles` catalog. */
export const TENANT_ROLES = [
  { key: 'SYSTEM_ADMINISTRATOR', labelKey: 'role.systemAdministrator' as MessageKey },
  { key: 'DISPENSING_PHARMACIST', labelKey: 'role.dispensingPharmacist' as MessageKey },
  { key: 'SUPERINTENDENT_PHARMACIST', labelKey: 'role.superintendentPharmacist' as MessageKey },
  { key: 'QPPV', labelKey: 'role.qppv' as MessageKey },
  { key: 'QUALITY_ASSOCIATE', labelKey: 'role.qualityAssociate' as MessageKey },
  { key: 'QUALITY_MANAGER', labelKey: 'role.qualityManager' as MessageKey },
  { key: 'REGULATORY_AFFAIRS_OFFICER', labelKey: 'role.regulatoryAffairsOfficer' as MessageKey },
  { key: 'EXECUTIVE_READONLY', labelKey: 'role.executiveReadonly' as MessageKey },
] as const

/**
 * A plain module, not a component — can't call `useTranslation()`
 * itself — so every caller passes its own `t()` in. Falls back to the
 * raw key if it's ever called with an unrecognized role (shouldn't
 * happen against a real backend-issued roleKeys array).
 */
export function tenantRoleLabel(key: string, t: (k: MessageKey) => string): string {
  const role = TENANT_ROLES.find((r) => r.key === key)
  return role ? t(role.labelKey) : key
}
