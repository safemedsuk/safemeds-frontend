'use client'

import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { useIdleTimeout } from '@/lib/hooks/use-idle-timeout'

interface IdleTimeoutGuardProps {
  /** Minutes of inactivity allowed before auto-logout; `null` while still loading (no warning shown). */
  timeoutMinutes: number | null
  onLogout: () => void
}

/** Mounted once inside an authenticated layout — shows a "your session is about to expire" modal ~1 minute before the configured idle timeout, then signs the user out automatically if they don't respond. */
export function IdleTimeoutGuard({ timeoutMinutes, onLogout }: IdleTimeoutGuardProps) {
  const { showWarning, secondsRemaining, stayActive } = useIdleTimeout({ timeoutMinutes, onTimeout: onLogout })

  if (!showWarning) return null

  const minutes = Math.floor(secondsRemaining / 60)
  const seconds = secondsRemaining % 60

  return (
    <Modal title="Your session is about to expire" onClose={stayActive} maxWidth="max-w-md">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bad-bg)]">
          <AlertTriangle className="h-6 w-6 text-[var(--bad)]" />
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          You&apos;ve been inactive for a while. For your security, you&apos;ll be signed out in{' '}
          <span className="font-semibold text-[var(--text)] tabular-nums">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>{' '}
          unless you stay active.
        </p>
        <button
          onClick={stayActive}
          className="w-full rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] transition-colors"
        >
          Stay signed in
        </button>
      </div>
    </Modal>
  )
}
