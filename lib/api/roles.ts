import { get } from './client'

export interface PermissionSummary {
  key: string
  description: string
}

export interface RoleWithPermissions {
  key: string
  name: string
  description: string
  isPlatform: boolean
  permissions: PermissionSummary[]
}

export async function getRoleCatalog(): Promise<RoleWithPermissions[]> {
  const { data } = await get<RoleWithPermissions[]>('/roles')
  return data
}
