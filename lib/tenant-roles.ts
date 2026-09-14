/** Mirrors `TENANT_ROLE_KEYS` on the backend (`src/common/tenant-roles.const.ts`) — Phase 2 will replace this with a fetched `/roles` catalog. */
export const TENANT_ROLES = [
  { key: 'SYSTEM_ADMINISTRATOR', label: 'System Administrator' },
  { key: 'DISPENSING_PHARMACIST', label: 'Dispensing Pharmacist' },
  { key: 'SUPERINTENDENT_PHARMACIST', label: 'Superintendent Pharmacist' },
  { key: 'QPPV', label: 'QPPV (PV Contact)' },
  { key: 'QUALITY_ASSOCIATE', label: 'Quality Associate' },
  { key: 'QUALITY_MANAGER', label: 'Quality Manager' },
  { key: 'REGULATORY_AFFAIRS_OFFICER', label: 'Regulatory Affairs Officer' },
  { key: 'EXECUTIVE_READONLY', label: 'Executive (Read-only)' },
] as const

export function tenantRoleLabel(key: string): string {
  return TENANT_ROLES.find((r) => r.key === key)?.label ?? key
}
