'use client'

import { useState } from 'react'
import { AlertCircle, Loader2, X } from 'lucide-react'
import { ApiRequestError } from '@/lib/api/client'
import { createInvitation } from '@/lib/api/invitations'
import { TENANT_ROLES } from '@/lib/tenant-roles'

interface Props {
  onClose: () => void
  onInvited: () => void
}

export function InviteUserModal({ onClose, onInvited }: Props) {
  const [email, setEmail] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [isExternal, setIsExternal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const toggleRole = (key: string) => {
    setSelectedRoles((prev) => (prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]))
  }

  const handleSubmit = async () => {
    if (!isEmailValid || selectedRoles.length === 0) return
    setError(null)
    setLoading(true)
    try {
      await createInvitation(email, selectedRoles, isExternal)
      onInvited()
      onClose()
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(
          err.code === 'EMAIL_ALREADY_REGISTERED'
            ? 'An account already exists for this email address.'
            : err.code === 'INVITATION_ALREADY_PENDING'
              ? 'An invitation is already pending for this email address.'
              : err.message,
        )
      } else {
        setError('Could not send the invitation. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xl">
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text)]">Invite a team member</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-status-error/10 border border-status-error text-status-error text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-medium text-[var(--text)]">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-[var(--text)]">Roles</label>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {TENANT_ROLES.map((role) => (
                <label
                  key={role.key}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-raised)] cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role.key)}
                    onChange={() => toggleRole(role.key)}
                    className="h-4 w-4 rounded border-[var(--border)]"
                  />
                  <span className="text-[var(--text)]">{role.label}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isExternal} onChange={(e) => setIsExternal(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-[var(--border)]" />
            <span>
              <span className="block text-[var(--text)]">External consultant</span>
              <span className="block text-xs text-[var(--text-muted)]">An outsourced professional rather than your own direct employee — e.g. a regulatory consultant working across several companies.</span>
            </span>
          </label>
        </div>

        <div className="p-5 border-t border-[var(--border)] flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={!isEmailValid || selectedRoles.length === 0 || loading}
            className="flex-1 h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Send invitation
          </button>
          <button
            onClick={onClose}
            className="px-4 h-9 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-raised)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
