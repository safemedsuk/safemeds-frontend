import { get, post, PaginationMeta } from './client'

export type TaskStatus = 'open' | 'claimed' | 'closed'
export type TaskUrgency = 'normal' | 'due_soon' | 'overdue'

export interface Task {
  id: string
  companyId: string
  recordType: string
  recordId: string
  title: string
  status: TaskStatus
  assignedRoleKey: string | null
  assignedUserId: string | null
  claimedBy: string | null
  claimedAt: string | null
  urgency: TaskUrgency
  closedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface TaskSummary {
  me: number
  role: number
}

export interface TaskPage {
  rows: Task[]
  meta: PaginationMeta
}

export async function listTasks(params: {
  scope?: 'me' | 'role' | 'all'
  recordType?: string
  recordId?: string
  urgency?: string
  status?: string
  page?: number
  limit?: number
} = {}): Promise<TaskPage> {
  const { data, meta } = await get<Task[]>('/tasks', params as Record<string, string | number | undefined>)
  return { rows: data, meta: meta! }
}

export async function getTaskSummary(): Promise<TaskSummary> {
  const { data } = await get<TaskSummary>('/tasks/summary')
  return data
}

export async function claimTask(id: string): Promise<Task> {
  const { data } = await post<Task>(`/tasks/${id}/claim`)
  return data
}

/** Special Corner SC-6 — puts a claimed task back into its open role queue for a teammate to claim; only the person who claimed it can release it. */
export async function releaseTask(id: string): Promise<Task> {
  const { data } = await post<Task>(`/tasks/${id}/release`)
  return data
}

/**
 * Special Corner SC-6 — maps a task's `recordType` to the record's own
 * detail page, so a task row (or a "Tasks for this record" panel) can
 * click straight through to where the actual work happens, rather than
 * leaving the user to go find the record themselves. Company-wide
 * reminder types (their `recordId` is the company's own id, not a
 * specific navigable item) route to the closest matching screen
 * instead of a nonexistent per-record page.
 */
export function taskRecordHref(recordType: string, recordId: string): string | null {
  switch (recordType) {
    case 'pv_case':
      return `/pv-cases/${recordId}`
    case 'signal':
      return `/pv-signals/${recordId}`
    case 'clinical_trial_annual_renewal':
      return `/clinical-trials/${recordId}`
    case 'product_list_review':
      return '/master-data'
    case 'audit_requirement_reminder':
      return '/audit-readiness'
    case 'literature_monitoring_reminder':
      return '/literature-monitoring'
    case 'phone_reachability_reminder':
      return '/pv-cases/call-logs'
    case 'sdea_renewal':
      return '/sdea'
    case 'training_record':
      return '/training'
    // RegCloud (Phase 12) Stage 1 — a dossier's own detail page.
    case 'reg_registration':
      return `/reg-dossiers/${recordId}`
    // RegCloud Stage 0.4/0.5 — neither has a dedicated per-record detail
    // page yet (a renewal deadline lives on the registration itself,
    // Product Wallet-style, Stage 6; a fee invoice lives in Master
    // Data's own Fee Ledger tab) — route to the closest matching screen,
    // same pattern as `product_list_review` above.
    case 'reg_registration_renewal':
    case 'reg_fee_invoice':
      return '/master-data'
    // RegCloud (Phase 12) Stage 13 — no dedicated per-record detail page
    // (a deliberately lightweight tab inside Master Data), same routing
    // precedent as the fee ledger/renewal cases above.
    case 'promotional_material':
      return '/master-data'
    // RegCloud (Phase 12) Stage 14 — a recall's own detail page.
    case 'recall':
      return `/recalls/${recordId}`
    default:
      return null
  }
}
