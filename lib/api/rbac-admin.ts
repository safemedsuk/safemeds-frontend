import { get, patch, post } from './client'

export interface PermissionWithRoles {
  key: string
  description: string
  roleKeys: string[]
}

export async function listPermissionsWithRoles(): Promise<PermissionWithRoles[]> {
  const { data } = await get<PermissionWithRoles[]>('/rbac-admin/permissions')
  return data
}

export async function createPermission(input: { key: string; description: string }): Promise<{ key: string; description: string }> {
  const { data } = await post<{ key: string; description: string }>('/rbac-admin/permissions', input)
  return data
}

export interface CreateRoleInput {
  key: string
  name: string
  description: string
  isPlatform?: boolean
  permissions: string[]
}

export async function createRole(input: CreateRoleInput): Promise<{ key: string; name: string; description: string; isPlatform: boolean; permissions: string[] }> {
  const { data } = await post<{ key: string; name: string; description: string; isPlatform: boolean; permissions: string[] }>('/rbac-admin/roles', input)
  return data
}

export interface RoleImpact {
  roleKey: string
  userCount: number
  companyCount: number
}

export async function getRoleImpact(roleKey: string): Promise<RoleImpact> {
  const { data } = await get<RoleImpact>(`/rbac-admin/roles/${roleKey}/impact`)
  return data
}

/** Always a full replace — the UI submits the complete intended permission set for the role. */
export async function updateRolePermissions(roleKey: string, permissions: string[]): Promise<RoleImpact> {
  const { data } = await patch<RoleImpact>(`/rbac-admin/roles/${roleKey}/permissions`, { permissions })
  return data
}
