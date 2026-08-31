'use client'

import { Bell, Search, User, LogOut, Settings, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogoMark } from '@/components/ui/logo-mark'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { getUnreadCount, listNotifications, markNotificationRead, type Notification } from '@/lib/api/notifications'

interface TopBarProps {
  companyName?: string
  userName?: string
  onLogout?: () => void
  /** Notifications are tenant-scoped (Phase 9) — platform staff have no companyId and would 403 forever polling this. */
  enableNotifications?: boolean
}

export function TopBar({ companyName = 'PharmaTech Solutions', userName = 'John Doe', onLogout, enableNotifications = true }: TopBarProps) {
  const router = useRouter()
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(false)

  const refreshUnreadCount = useCallback(() => {
    getUnreadCount()
      .then(setUnreadCount)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!enableNotifications) return
    refreshUnreadCount()
    // Polling is the simplest correct way to keep the bell's count fresh
    // without standing up a websocket/SSE channel for what's currently a
    // low-frequency signal (task/deadline events, not chat) — worth
    // revisiting if notification volume grows enough that a minute of
    // staleness stops being acceptable.
    const interval = setInterval(refreshUnreadCount, 60_000)
    return () => clearInterval(interval)
  }, [enableNotifications, refreshUnreadCount])

  const handleOpenNotifications = () => {
    const next = !showNotifications
    setShowNotifications(next)
    if (next) {
      setLoadingNotifications(true)
      listNotifications({ unreadOnly: false })
        .then(({ rows }) => setNotifications(rows.slice(0, 8)))
        .catch(() => {})
        .finally(() => setLoadingNotifications(false))
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.readAt) {
      try {
        await markNotificationRead(notification.id)
        setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)))
        refreshUnreadCount()
      } catch {
        // Best-effort — the notification is still visible either way, not worth surfacing an error for a read-receipt.
      }
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Logo & Company */}
        <div className="flex items-center gap-3">
          <LogoMark size="sm" />
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-[var(--text)]">SafeMeds</p>
            <p className="text-xs text-[var(--text-muted)]">{companyName}</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="hidden flex-1 max-w-md md:flex">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products, batches, tasks..."
              className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-4 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-safemeds-teal"
            />
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications — tenant-scoped, platform staff have no companyId to scope them to */}
          {enableNotifications && (
          <div className="relative">
            <button
              onClick={handleOpenNotifications}
              className="relative rounded-lg p-2 hover:bg-[var(--surface-raised)]"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5 text-[var(--text)]" />
              {unreadCount > 0 && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[var(--bad)]"></span>}
            </button>
            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-border bg-card shadow-lg">
                <div className="border-b border-border px-4 py-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                  {unreadCount > 0 && <span className="text-xs text-[var(--text-muted)]">{unreadCount} unread</span>}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {loadingNotifications ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing yet.</p>
                  ) : (
                    notifications.map((notif) => (
                      <button
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`w-full text-left border-b border-border px-4 py-3 hover:bg-muted/50 cursor-pointer ${!notif.readAt ? 'bg-[var(--primary)]/5' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{notif.title}</p>
                          {!notif.readAt && <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] mt-1.5 flex-shrink-0" />}
                        </div>
                        {notif.body && <p className="text-xs text-muted-foreground mt-0.5">{notif.body}</p>}
                        <p className="text-[11px] text-muted-foreground mt-1">{new Date(notif.createdAt).toLocaleString()}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          )}

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 rounded-lg p-2 hover:bg-muted"
              aria-label="User menu"
            >
              <div className="h-8 w-8 rounded-full bg-safemeds-gold flex items-center justify-center text-xs font-bold text-safemeds-spruce">
                {userName
                  .split(' ')
                  .map(n => n[0])
                  .join('')}
              </div>
              <span className="hidden sm:inline text-sm font-medium text-foreground">{userName}</span>
            </button>
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-border bg-card shadow-lg">
                <button className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-muted flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Profile
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    router.push('/settings')
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-muted flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </button>
                <hr className="my-1 border-border" />
                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    onLogout?.()
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-status-error hover:bg-muted flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
