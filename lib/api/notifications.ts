import { get, patch, post } from './client'

export type NotificationCategory = 'task_assigned' | 'deadline_approaching' | 'deadline_breached' | 'workflow_update'

export interface Notification {
  id: string
  companyId: string
  userId: string
  category: NotificationCategory
  title: string
  body: string | null
  recordType: string | null
  recordId: string | null
  readAt: string | null
  createdAt: string
}

export interface NotificationPreference {
  userId: string
  emailTaskAssigned: boolean
  emailDeadline: boolean
  emailWorkflowUpdate: boolean
  updatedAt: string
}

export async function listNotifications(params: { cursor?: string; unreadOnly?: boolean } = {}): Promise<{ rows: Notification[]; nextCursor: string | null }> {
  const { data } = await get<{ rows: Notification[]; nextCursor: string | null }>('/notifications', {
    ...(params.cursor ? { cursor: params.cursor } : {}),
    ...(params.unreadOnly ? { unreadOnly: 'true' } : {}),
  })
  return data
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await get<{ count: number }>('/notifications/unread-count')
  return data.count
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const { data } = await post<Notification>(`/notifications/${id}/read`)
  return data
}

export async function getNotificationPreference(): Promise<NotificationPreference> {
  const { data } = await get<NotificationPreference>('/notifications/preferences')
  return data
}

export async function updateNotificationPreference(payload: Partial<Pick<NotificationPreference, 'emailTaskAssigned' | 'emailDeadline' | 'emailWorkflowUpdate'>>): Promise<NotificationPreference> {
  const { data } = await patch<NotificationPreference>('/notifications/preferences', payload)
  return data
}
