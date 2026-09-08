import { get, PaginationMeta, post } from './client'

/**
 * RegCloud (Phase 12) Stage 14 — Post-Market & Recall (cross-module).
 * RegCloud's own honest slice of a genuinely three-module event — the
 * regulator-facing half lives here. Cross-module integration to PV's own
 * Case rows and QualCloud's own future root-cause CAPA is a plain FK/
 * lookup link, never a shared workflow instance. Lifecycle transitions
 * (`reported → investigating → notified_to_authority → in_progress →
 * closed`) go through the generic `WorkflowActionsPanel`/`postTransition()`
 * mechanism, exactly like PV Cases and Signals.
 */

export interface LinkedRecallCaseSummary {
  id: string
  referenceNumber: string
  status: string
}

export interface TransitionLogEntry {
  fromStateKey: string | null
  toStateKey: string
  note: string | null
  actorName: string | null
  occurredAt: string
}

export interface Recall {
  id: string
  companyId: string
  productId: string
  product: { brandName: string }
  initiatedBy: string | null
  recallClass: string | null
  reason: string
  status: string
  authorityNotifiedAt: string | null
  rootCauseCapaId: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface RecallDetail extends Recall {
  linkedCases: LinkedRecallCaseSummary[]
  workflowInstanceId: string | null
  transitionHistory: TransitionLogEntry[]
}

export interface RecallPage {
  rows: Recall[]
  meta: PaginationMeta
}

export const RECALL_STATUS_LABELS: Record<string, string> = {
  reported: 'Reported',
  investigating: 'Investigating',
  notified_to_authority: 'Notified to Authority',
  in_progress: 'In Progress',
  closed: 'Closed',
}

export async function listRecalls(params: { productId?: string; status?: string; page?: number; limit?: number } = {}): Promise<RecallPage> {
  const { data, meta } = await get<Recall[]>('/recalls', params as Record<string, string | number | undefined>)
  return { rows: data, meta: meta! }
}

export async function getRecall(id: string): Promise<RecallDetail> {
  const { data } = await get<RecallDetail>(`/recalls/${id}`)
  return data
}

export async function createRecall(payload: { productId: string; reason: string; recallClass?: string; caseIds?: string[]; rootCauseCapaId?: string }): Promise<RecallDetail> {
  const { data } = await post<RecallDetail>('/recalls', payload)
  return data
}

export async function linkRecallCases(id: string, caseIds: string[]): Promise<RecallDetail> {
  const { data } = await post<RecallDetail>(`/recalls/${id}/link-cases`, { caseIds })
  return data
}
