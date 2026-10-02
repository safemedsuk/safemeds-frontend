import { API_BASE_URL } from './client'

/**
 * QualCloud (Phase 13) Stage 10.4 — the public, no-auth portal client.
 * Deliberately separate from `recall-stage10.ts` (which assumes an
 * authenticated tenant session) — every call here carries only the
 * token, matching `lib/api/public-reporting.ts`'s own precedent for
 * VigiCloud's public reporting form.
 */

export interface RecallPortalContext {
  recallRef: string | null
  productName: string
  reason: string
  stakeholderOrgName: string
  language: string
  isDrill: boolean
}

async function publicRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const body = await res.json()
  if (!res.ok) {
    throw new Error(body?.error?.message ?? 'Something went wrong.')
  }
  return body.data as T
}

export async function getRecallPortalContext(token: string): Promise<RecallPortalContext> {
  return publicRequest<RecallPortalContext>(`/recall-portal/${token}/context`)
}

export async function submitRecallPortalAction(
  token: string,
  action: 'ack' | 'stop_sale' | 'quarantine' | 'count' | 'downstream' | 'evidence' | 'return_request',
  payload: Record<string, unknown> | undefined,
  idempotencyKey: string,
): Promise<{ id: string }> {
  return publicRequest<{ id: string }>(`/recall-portal/${token}/actions`, {
    method: 'POST',
    body: JSON.stringify({ action, payload, idempotencyKey, clientTimestamp: new Date().toISOString() }),
  })
}
