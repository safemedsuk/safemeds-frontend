import { get, patch, post, PaginationMeta } from './client'

export interface TenantUser {
  id: string
  email: string
  fullName: string
  status: 'active' | 'deactivated'
  roleKeys: string[]
  isExternal: boolean
  mustChangePassword: boolean
  createdAt: string
}

export interface ListUsersFilters {
  status?: 'active' | 'deactivated'
  role?: string
  page?: number
  limit?: number
}

export interface UsersPage {
  users: TenantUser[]
  meta: PaginationMeta
}

export async function listUsers(filters: ListUsersFilters = {}): Promise<UsersPage> {
  const { data, meta } = await get<TenantUser[]>('/users', filters as Record<string, string | number | boolean | undefined>)
  return { users: data, meta: meta! }
}

export async function updateUserRoles(userId: string, roleKeys: string[], isExternal?: boolean): Promise<TenantUser> {
  const { data } = await patch<TenantUser>(`/users/${userId}/roles`, { roleKeys, isExternal })
  return data
}

export async function deactivateUser(userId: string): Promise<TenantUser> {
  const { data } = await post<TenantUser>(`/users/${userId}/deactivate`)
  return data
}

export async function adminResetPassword(userId: string): Promise<{ reset: boolean }> {
  const { data } = await post<{ reset: boolean }>(`/users/${userId}/reset-password`)
  return data
}
