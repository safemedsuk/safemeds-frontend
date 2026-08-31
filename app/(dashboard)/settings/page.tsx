'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, Fingerprint, Laptop, Loader2, LogOut, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { getSessions, revokeAllOtherSessions, revokeSession, type SessionInfo } from '@/lib/api/auth'
import { ChangePasswordSection } from '@/components/settings/change-password-section'
import { DataPrivacySection } from '@/components/settings/data-privacy-section'
import { MfaSection } from '@/components/settings/mfa-section'

function SettingsContent() {
  const searchParams = useSearchParams()
  const forceChangePassword = searchParams.get('forceChangePassword') === '1'
  const forceMfaSetup = searchParams.get('forceMfaSetup') === '1'

  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [revokingAll, setRevokingAll] = useState(false)

  const loadSessions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { sessions } = await getSessions()
      setSessions(sessions)
    } catch {
      setError('Could not load your active sessions. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  const handleRevoke = async (id: string) => {
    setRevokingId(id)
    setError(null)
    try {
      await revokeSession(id)
      await loadSessions()
    } catch {
      setError('Could not sign out that device. Please try again.')
    } finally {
      setRevokingId(null)
    }
  }

  const handleRevokeAllOthers = async () => {
    if (!window.confirm('Sign out every other session on this account?')) return
    setRevokingAll(true)
    setError(null)
    try {
      await revokeAllOtherSessions()
      await loadSessions()
    } catch {
      setError('Could not sign out other sessions. Please try again.')
    } finally {
      setRevokingAll(false)
    }
  }

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length

  return (
    <div className="min-h-screen bg-[var(--bg)] p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <PageHeader
          title="Security Settings"
          description="Manage your password, multi-factor authentication, and active sessions"
          breadcrumb={[{ label: 'Settings' }]}
        />

        {(forceChangePassword || forceMfaSetup) && (
          <div className="p-4 rounded-lg bg-status-warning/10 border border-status-warning/30 text-status-warning flex gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm">
              {forceChangePassword
                ? 'An administrator requires you to set a new password before continuing.'
                : 'Your company policy requires multi-factor authentication for your role. Please set it up below.'}
            </p>
          </div>
        )}

        <ChangePasswordSection />

        <MfaSection autoOpenSetup={forceMfaSetup} />

        <CollapsibleSection title="Data Privacy" icon={<Fingerprint className="h-4 w-4 text-[var(--primary)]" />}>
          <DataPrivacySection />
        </CollapsibleSection>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-[var(--primary)]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[var(--text)]">Active Sessions</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Devices currently signed in to your SafeMeds account
                </p>
              </div>
            </div>

            {otherSessionsCount > 0 && (
              <button
                onClick={handleRevokeAllOthers}
                disabled={revokingAll}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-raised)] transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {revokingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                Sign out other sessions
              </button>
            )}
          </div>

          {error && (
            <div className="m-5 p-3 rounded-lg bg-status-error/10 border border-status-error text-status-error text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16 text-[var(--text-muted)]">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading sessions…
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-16 text-center text-sm text-[var(--text-muted)]">No active sessions found.</div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {sessions.map((session) => (
                <li key={session.id} className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-[var(--surface-raised)] flex items-center justify-center flex-shrink-0">
                      <Laptop className="h-4 w-4 text-[var(--text-muted)]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[var(--text)] truncate">{session.device}</p>
                        {session.isCurrent && (
                          <span className="px-2 py-0.5 rounded-full bg-[var(--ok-bg)] text-[var(--ok)] text-[10px] font-medium uppercase tracking-wide flex-shrink-0">
                            This device
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] truncate">
                        {session.ip ?? 'Unknown IP'} · Signed in {new Date(session.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {!session.isCurrent && (
                    <button
                      onClick={() => handleRevoke(session.id)}
                      disabled={revokingId === session.id}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-raised)] transition-colors disabled:opacity-50 flex-shrink-0 flex items-center gap-1.5"
                    >
                      {revokingId === session.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Sign out
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  )
}
