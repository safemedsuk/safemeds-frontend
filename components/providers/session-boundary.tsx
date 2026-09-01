'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { setSessionRefreshedHandler, setUnauthenticatedHandler } from '@/lib/api/client'
import { useAuthStore } from '@/lib/store/auth-store'

/**
 * Registers the API client's session callbacks: a hard-logout handler
 * (a request 401s and the refresh-and-retry fails — clear local state,
 * send the user to /login) and a session-refreshed handler (a silent
 * token refresh succeeded — write the fresh user/roleKeys/permissions
 * back into the store, so a role grant/revoke reflects in the UI on the
 * next API call instead of only after an explicit re-login). Mounted
 * once at the root so both are active everywhere, not just inside the
 * authenticated route groups.
 */
export function SessionBoundary() {
  const router = useRouter()
  const logout = useAuthStore((state) => state.logout)
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser)

  useEffect(() => {
    setUnauthenticatedHandler(() => {
      logout()
      router.push('/login')
    })
    setSessionRefreshedHandler((user) => {
      setCurrentUser(user)
    })
  }, [logout, router, setCurrentUser])

  return null
}
