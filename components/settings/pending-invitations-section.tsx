'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Mail, RotateCw, X } from 'lucide-react'
import { listInvitations, resendInvitation, revokeInvitation, type Invitation, type InvitationStatus } from '@/lib/api/invitations'
import { tenantRoleLabel } from '@/lib/tenant-roles'

const STATUS_STYLES: Record<InvitationStatus, string> = {
  pending: 'bg-status-info/10 text-status-info',
  accepted: 'bg-status-success/10 text-status-success',
  expired: 'bg-status-warning/10 text-status-warning',
  revoked: 'bg-status-error/10 text-status-error',
}

export function PendingInvitationsSection({ refreshKey }: { refreshKey: number }) {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { invitations } = await listInvitations()
      // "Pending Invitations" means actionable ones — accepted invitations
      // are just active users now (visible on the Users list instead), and
      // revoked ones are dead ends; keeping either here forever would make
      // this list grow without bound and stop meaning what its title says.
      setInvitations(invitations.filter((invitation) => invitation.status === 'pending' || invitation.status === 'expired'))
    } catch {
      // Non-fatal — section just stays empty; the invite modal surfaces its own errors.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const handleResend = async (id: string) => {
    setBusyId(id)
    try {
      await resendInvitation(id)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const handleRevoke = async (id: string) => {
    if (!window.confirm('Revoke this invitation?')) return
    setBusyId(id)
    try {
      await revokeInvitation(id)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-[var(--text-muted)] text-sm">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading invitations…
      </div>
    )
  }

  if (invitations.length === 0) {
    return <div className="py-10 text-center text-sm text-[var(--text-muted)]">No invitations sent yet.</div>
  }

  return (
    <ul className="divide-y divide-[var(--border)]">
      {invitations.map((invitation) => (
        <li key={invitation.id} className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-[var(--surface-raised)] flex items-center justify-center flex-shrink-0">
              <Mail className="h-4 w-4 text-[var(--text-muted)]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--text)] truncate">{invitation.email}</p>
              <p className="text-xs text-[var(--text-muted)] truncate">
                {invitation.roleKeys.map(tenantRoleLabel).join(', ')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide ${STATUS_STYLES[invitation.status]}`}>
              {invitation.status}
            </span>
            {invitation.status === 'pending' && (
              <>
                <button
                  onClick={() => handleResend(invitation.id)}
                  disabled={busyId === invitation.id}
                  title="Resend invitation"
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)] disabled:opacity-50"
                >
                  {busyId === invitation.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => handleRevoke(invitation.id)}
                  disabled={busyId === invitation.id}
                  title="Revoke invitation"
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-status-error/10 hover:text-status-error disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            {invitation.status === 'expired' && (
              <button
                onClick={() => handleResend(invitation.id)}
                disabled={busyId === invitation.id}
                className="px-2 py-1 rounded-lg text-[10px] font-medium border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-raised)] disabled:opacity-50"
              >
                Resend
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
