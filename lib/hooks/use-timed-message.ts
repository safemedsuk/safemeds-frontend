import { useEffect, useRef, useState } from 'react'

/**
 * A piece of state that clears itself after `timeoutMs` — for transient
 * success banners ("Moved to X.") that shouldn't linger on screen
 * indefinitely. Setting a new value restarts the timer; setting `null`
 * (or calling `clear()`) dismisses it immediately.
 */
export function useTimedMessage(timeoutMs = 4000) {
  const [message, setMessageState] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const setMessage = (value: string | null) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setMessageState(value)
    if (value !== null) {
      timerRef.current = setTimeout(() => setMessageState(null), timeoutMs)
    }
  }

  return [message, setMessage] as const
}
