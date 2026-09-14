import { useMemo } from 'react'
import { useAuthStore } from '@/lib/store/auth-store'

/**
 * Reads the permission set resolved server-side at login/refresh
 * (`SafeUser.permissions`) — used to hide/disable UI the user can't act
 * on. This is a UX convenience only: every mutating endpoint enforces its
 * own `@RequirePermissions()` independently, so a stale or tampered
 * client-side check can never grant real access.
 */
export function usePermissions() {
  const currentUser = useAuthStore((state) => state.currentUser)
  const permissions = useMemo(() => new Set(currentUser?.permissions ?? []), [currentUser])

  return {
    permissions,
    has: (permission: string) => permissions.has(permission),
    hasAny: (...perms: string[]) => perms.some((p) => permissions.has(p)),
    hasAll: (...perms: string[]) => perms.every((p) => permissions.has(p)),
  }
}
