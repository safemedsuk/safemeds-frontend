'use client'

import { Bell, Search, User, LogOut, Settings } from 'lucide-react'
import { useState } from 'react'
import { LogoMark } from '@/components/ui/logo-mark'
import { ThemeToggle } from '@/components/ui/theme-toggle'

interface TopBarProps {
  companyName?: string
  userName?: string
  onLogout?: () => void
}

export function TopBar({ companyName = 'PharmaTech Solutions', userName = 'John Doe', onLogout }: TopBarProps) {
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

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

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative rounded-lg p-2 hover:bg-[var(--surface-raised)]"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5 text-[var(--text)]" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[var(--bad)]"></span>
            </button>
            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-border bg-card shadow-lg">
                <div className="border-b border-border px-4 py-3">
                  <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {[
                    { title: 'Task Due Soon', message: 'EU import review due in 2 days', type: 'alert' },
                    { title: 'Batch Approved', message: 'B-2024-001 quality tests passed', type: 'success' },
                  ].map((notif, i) => (
                    <div
                      key={i}
                      className="border-b border-border px-4 py-3 hover:bg-muted/50 cursor-pointer"
                    >
                      <p className="text-sm font-medium text-foreground">{notif.title}</p>
                      <p className="text-xs text-muted-foreground">{notif.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

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
                <button className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-muted flex items-center gap-2">
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
