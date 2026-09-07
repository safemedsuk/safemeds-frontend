import { del, get, post } from './client'

export type LocationScopeLevel = 'market' | 'facility'

export interface LocationScope {
  id: string
  companyId: string
  userId: string
  level: LocationScopeLevel
  countryId: string | null
  facilityId: string | null
  countryName: string | null
  facilityName: string | null
  grantedBy: string
  createdAt: string
}

export interface EffectiveAccess {
  /** `true` means "sees every facility in the company" — either a System Administrator, or a user with no scope rows granted yet (the default). */
  unrestricted: boolean
  facilityIds: string[]
}

export interface GrantLocationScopePayload {
  level: LocationScopeLevel
  /** Required when level is "market" — expands dynamically to every facility currently in this country. */
  countryId?: string
  /** Required when level is "facility". */
  facilityId?: string
}

export async function getMyLocationAccess(): Promise<EffectiveAccess> {
  const { data } = await get<EffectiveAccess>('/location-scopes/mine')
  return data
}

export async function listUserLocationScopes(userId: string): Promise<LocationScope[]> {
  const { data } = await get<LocationScope[]>(`/users/${userId}/location-scopes`)
  return data
}

export async function grantLocationScope(userId: string, payload: GrantLocationScopePayload): Promise<LocationScope> {
  const { data } = await post<LocationScope>(`/users/${userId}/location-scopes`, payload)
  return data
}

export async function revokeLocationScope(scopeId: string): Promise<void> {
  await del<{ revoked: boolean }>(`/location-scopes/${scopeId}`)
}
