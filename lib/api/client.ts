/**
 * Real backend API client. credentials:'include' so httpOnly auth/refresh
 * cookies flow automatically; on a 401 it transparently calls
 * /auth/refresh and retries the original request once before giving up
 * and triggering a hard logout (see setUnauthenticatedHandler).
 *
 * Success responses unwrap to `{ data, meta? }` per the backend's
 * envelope convention; errors normalize to ApiRequestError.
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ApiEnvelope<T> {
  data: T
  meta?: PaginationMeta
}

export interface ApiErrorBody {
  code: string
  message: string
  details?: unknown
  /** Correlates this error to a specific backend log line — always present, safe to show/report even in production. */
  requestId?: string
  /** Only ever sent by the backend when it's running with NODE_ENV !== 'production' — the real exception for a 500, never present against a production API. */
  debug?: { name: string; message: string; stack?: string }
}

export class ApiRequestError extends Error {
  status: number
  code: string
  details?: unknown
  requestId?: string
  debug?: ApiErrorBody['debug']

  constructor(status: number, error: ApiErrorBody) {
    super(error.message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = error.code
    this.details = error.details
    this.requestId = error.requestId
    this.debug = error.debug

    // The backend only ever includes `debug` outside production — surface
    // it straight to the console so a dev sees the real cause immediately,
    // without needing to dig into server logs or inspect the network tab.
    if (error.debug) {
      // eslint-disable-next-line no-console -- intentional dev-only diagnostic surface, mirrors the backend's own dev-mode debug field
      console.error(
        `[API ${status} ${error.code}] ${error.debug.name}: ${error.debug.message}${error.requestId ? ` (requestId: ${error.requestId})` : ''}`,
        error.debug.stack,
      )
    }
  }
}

/**
 * Extracts a user-facing message from anything an API call might throw.
 * `ApiRequestError` messages are always backend-authored and safe to show
 * directly; for anything else (network failure, a bug elsewhere) there's
 * no structured message to trust, so callers supply a fallback instead of
 * risking a raw JS error leaking to the UI.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiRequestError) {
    if (Array.isArray(err.details) && err.details.every((item) => typeof item === 'string')) {
      return (err.details as string[]).join(' ')
    }
    return err.message
  }
  return fallback
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const NO_RETRY_PATHS = new Set(['/auth/refresh', '/auth/login'])

let onUnauthenticated: (() => void) | null = null

/** Registered once (typically in the root layout) to clear client state and redirect to /login on an unrecoverable 401. */
export function setUnauthenticatedHandler(handler: () => void): void {
  onUnauthenticated = handler
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let onSessionRefreshed: ((user: any) => void) | null = null

/**
 * Registered once (typically in the root layout) to write a silently
 * refreshed access token's fresh `user` (roleKeys/permissions included)
 * back into the auth store. Without this, a role grant only takes
 * effect on the *server* the moment the token refreshes — the UI keeps
 * showing stale permission-gated buttons as disabled until an explicit
 * re-login re-populates the store, even though the next real API call
 * would already succeed server-side.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setSessionRefreshedHandler(handler: (user: any) => void): void {
  onSessionRefreshed = handler
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${API_BASE_URL}${path}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

async function rawFetch(path: string, options: RequestOptions): Promise<Response> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = {}
  let body: BodyInit | undefined

  if (options.body instanceof FormData) {
    body = options.body
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }

  if (!SAFE_METHODS.has(method)) {
    const csrfToken = getCookie('csrf')
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken
  }

  return fetch(buildUrl(path, options.query), {
    method,
    headers,
    body,
    credentials: 'include',
  })
}

let refreshPromise: Promise<boolean> | null = null

function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = rawFetch('/auth/refresh', { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) return false
        try {
          const body = await res.json()
          if (body?.data?.user) onSessionRefreshed?.(body.data.user)
        } catch {
          // Refresh itself still succeeded — a malformed body just means
          // the store won't get the freshest roleKeys until next login.
        }
        return true
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
  _isRetry = false,
): Promise<ApiEnvelope<T>> {
  const response = await rawFetch(path, options)

  if (response.status === 401 && !_isRetry && !NO_RETRY_PATHS.has(path)) {
    const refreshed = await refreshSession()
    if (refreshed) {
      return apiRequest<T>(path, options, true)
    }
    onUnauthenticated?.()
  }

  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json') ? await response.json() : null

  if (!response.ok) {
    const error: ApiErrorBody = payload?.error ?? { code: 'UNKNOWN_ERROR', message: 'Request failed' }
    throw new ApiRequestError(response.status, error)
  }

  return payload as ApiEnvelope<T>
}

export function get<T>(path: string, query?: RequestOptions['query']): Promise<ApiEnvelope<T>> {
  return apiRequest<T>(path, { method: 'GET', query })
}

export function post<T>(path: string, body?: unknown): Promise<ApiEnvelope<T>> {
  return apiRequest<T>(path, { method: 'POST', body })
}

export function patch<T>(path: string, body?: unknown): Promise<ApiEnvelope<T>> {
  return apiRequest<T>(path, { method: 'PATCH', body })
}

export function del<T>(path: string): Promise<ApiEnvelope<T>> {
  return apiRequest<T>(path, { method: 'DELETE' })
}
