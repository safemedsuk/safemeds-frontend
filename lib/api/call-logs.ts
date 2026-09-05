import { get, post } from './client'
import type { CreatePvCaseInput } from './pv-cases'

export type CallOutcome = 'case_created' | 'information_only' | 'follow_up_required' | 'unable_to_reach'

export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  case_created: 'Case created',
  information_only: 'Information only — no case',
  follow_up_required: 'Follow-up required',
  unable_to_reach: 'Unable to reach caller',
}

export interface CallLog {
  id: string
  companyId: string
  callerNumber: string
  occurredAt: string
  durationSeconds: number | null
  outcome: CallOutcome
  notes: string | null
  caseId: string | null
  loggedBy: string
  createdAt: string
  /** Stage 21 — a missed call/voicemail rather than a live-answered call. */
  isVoicemail: boolean
  audioDocumentId: string | null
  /** Decrypted server-side; the raw encrypted column never leaves the backend. */
  transcriptionNote: string | null
  /** Computed live from `occurredAt` against fixed 08:00-18:00 UTC Mon-Fri business hours — never stored. */
  isAfterHours: boolean
}

export interface LogCallInput {
  callerNumber: string
  occurredAt: string
  durationSeconds?: number
  outcome: CallOutcome
  notes?: string
  /** Required when outcome is "case_created", disallowed otherwise — the exact same graph POST /pv/cases accepts; `channel` is forced to `hotline_phone` server-side regardless of what's sent here. */
  case?: CreatePvCaseInput
  /** Stage 21 fields — a missed call/voicemail rather than a live-answered call. */
  isVoicemail?: boolean
  audioDocumentId?: string
  transcriptionNote?: string
}

export interface ListCallLogsParams {
  page?: number
  limit?: number
  search?: string
}

export interface ListCallLogsResult {
  callLogs: CallLog[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export async function logCall(input: LogCallInput): Promise<CallLog> {
  const { data } = await post<CallLog>('/pv/call-logs', input)
  return data
}

export async function listCallLogs(params: ListCallLogsParams = {}): Promise<ListCallLogsResult> {
  const { data, meta } = await get<CallLog[]>('/pv/call-logs', { ...params })
  return { callLogs: data, meta: meta ?? { page: 1, limit: 25, total: data.length, totalPages: 1 } }
}
