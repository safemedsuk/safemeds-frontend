'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const
const CHECK_INTERVAL_MS = 5000
const WARNING_WINDOW_MINUTES = 1

interface UseIdleTimeoutOptions {
  /** Minutes of inactivity allowed before auto-logout. `null` disables the timer entirely (e.g. while the real policy value is still loading). */
  timeoutMinutes: number | null
  onTimeout: () => void
}

interface UseIdleTimeoutResult {
  showWarning: boolean
  secondsRemaining: number
  /** Call when the user confirms presence (button click, or dismissing the warning) — resets the idle clock and hides the warning. */
  stayActive: () => void
}

/**
 * VigiCloud Stage 0.7 — this hook is the real enforcement; the backend's
 * `SessionActivityService` check (on refresh) is only a coarse-grained
 * backstop, since a 15-minute access token can otherwise sit idle for
 * up to 15 minutes past the configured timeout before that backstop
 * ever runs. Warns the user `WARNING_WINDOW_MINUTES` before the
 * configured timeout, then calls `onTimeout` if no activity follows.
 */
export function useIdleTimeout({ timeoutMinutes, onTimeout }: UseIdleTimeoutOptions): UseIdleTimeoutResult {
  const lastActivityRef = useRef(Date.now())
  const hasFiredRef = useRef(false)
  const [showWarning, setShowWarning] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(0)
  const onTimeoutRef = useRef(onTimeout)
  onTimeoutRef.current = onTimeout

  const stayActive = useCallback(() => {
    lastActivityRef.current = Date.now()
    hasFiredRef.current = false
    setShowWarning(false)
  }, [])

  useEffect(() => {
    if (!timeoutMinutes || timeoutMinutes <= 0) return

    // While the warning is showing, page-wide mouse/keyboard noise no
    // longer counts as "still here" — only an explicit stayActive()
    // (the modal's button, or dismissing it) does. Otherwise a stray
    // cursor drift over the page behind the modal would silently
    // dismiss a warning the user never actually saw.
    const handleActivity = () => {
      if (showWarning) return
      lastActivityRef.current = Date.now()
    }

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }))

    const intervalId = setInterval(() => {
      if (hasFiredRef.current) return
      const idleMinutes = (Date.now() - lastActivityRef.current) / (60 * 1000)
      const warningAtMinutes = Math.max(timeoutMinutes - WARNING_WINDOW_MINUTES, 0)

      if (idleMinutes >= timeoutMinutes) {
        hasFiredRef.current = true
        setShowWarning(false)
        onTimeoutRef.current()
      } else if (idleMinutes >= warningAtMinutes) {
        setShowWarning(true)
        setSecondsRemaining(Math.max(0, Math.round((timeoutMinutes - idleMinutes) * 60)))
      }
    }, CHECK_INTERVAL_MS)

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, handleActivity))
      clearInterval(intervalId)
    }
  }, [timeoutMinutes, showWarning])

  return { showWarning, secondsRemaining, stayActive }
}
