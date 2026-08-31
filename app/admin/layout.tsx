'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ClipboardList, FileText, GraduationCap, Globe, KeyRound, LayoutDashboard, Link2, Lock, ShieldCheck } from 'lucide-react'
import { TopBar } from '@/components/layout/top-bar'
import { IdleTimeoutGuard } from '@/components/auth/idle-timeout-guard'
import { useAuthStore } from '@/lib/store/auth-store'
import { logout as apiLogout } from '@/lib/api/auth'
import { usePermissions } from '@/lib/hooks/use-permissions'

// Platform staff have no `SecurityPolicy` row (a tenant-only concept),
// so a fixed default applies — matches the backend's
// `PLATFORM_STAFF_IDLE_TIMEOUT_MINUTES` in `session.service.ts`.
const PLATFORM_STAFF_IDLE_TIMEOUT_MINUTES = 5

const BASE_NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Registrations', href: '/admin/registrations', icon: FileText },
  { label: 'Licenses', href: '/admin/licenses', icon: ShieldCheck },
  { label: 'Entitlements', href: '/admin/entitlements', icon: KeyRound },
  // testing-todo 15.1 — same `@PlatformOnly('super_admin')` backend gate
  // shape as Entitlements above (a hardcoded role check, not an RBAC
  // permission), so it gets the same treatment: always in nav for any
  // platform staff member, the backend's own 403 is the real gate.
  { label: 'Distributor Linking', href: '/admin/distributor-linking', icon: Link2 },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { currentUser, isAuthenticated, hasHydrated, logout } = useAuthStore()
  const { has } = usePermissions()

  // Admin Configuration Console — country config (reporting rules,
  // regulatory authorities) and the audit-requirement catalog are both
  // gated `platform.config.manage`; RBAC administration is its own,
  // narrower `platform.rbac.manage`. Hidden from nav when absent (tidiness
  // only) — each page still enforces its own gate on direct URL access,
  // matching this project's established "nav hides, page enforces" rule.
  const NAV_ITEMS = [
    ...BASE_NAV_ITEMS,
    ...(has('platform.config.manage') ? [{ label: 'Country Rules', href: '/admin/country-rules', icon: Globe }] : []),
    ...(has('platform.config.manage') ? [{ label: 'Audit Checklist', href: '/admin/audit-checklist', icon: ClipboardList }] : []),
    ...(has('platform.config.manage') ? [{ label: 'Training Types', href: '/admin/training-types', icon: GraduationCap }] : []),
    ...(has('platform.rbac.manage') ? [{ label: 'RBAC', href: '/admin/rbac', icon: Lock }] : []),
  ]

  useEffect(() => {
    // See lib/store/auth-store.ts's hasHydrated comment — must wait for
    // rehydration before trusting isAuthenticated, or a hard refresh on
    // an admin page bounces an already-logged-in platform user to /login.
    if (!hasHydrated) return

    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    if (!currentUser?.platformRole) {
      router.push('/tasks')
    }
  }, [hasHydrated, isAuthenticated, currentUser, router])

  const isChecking = !hasHydrated || !isAuthenticated || !currentUser?.platformRole

  const handleLogout = async () => {
    try {
      await apiLogout()
    } finally {
      logout()
      router.push('/login')
    }
  }

  if (isChecking) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg)]">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
          <p className="mt-4 text-[var(--text)] font-medium">Loading SafeMeds...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--bg)]">
      <IdleTimeoutGuard timeoutMinutes={PLATFORM_STAFF_IDLE_TIMEOUT_MINUTES} onLogout={handleLogout} />

      <TopBar
        companyName="SafeMeds Platform"
        userName={currentUser?.fullName || 'Platform Staff'}
        onLogout={handleLogout}
        enableNotifications={false}
      />

      <div className="flex flex-1 overflow-hidden">
        <nav className="w-56 flex-shrink-0 border-r border-[var(--border)] bg-[var(--surface)] p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </a>
            )
          })}
        </nav>

        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
