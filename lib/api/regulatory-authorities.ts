import { get, patch, post } from './client'

export interface RegulatoryAuthority {
  id: string
  countryId: string
  code: string
  name: string
  formCode: string | null
  ministryName: string | null
  poBoxAddress: string | null
  phone: string | null
  contactEmail: string | null
  emblemAssetKey: string | null
  /** Real-usage feedback, 19 Aug 2026 — an admin-uploaded emblem image; takes priority over `emblemAssetKey` on generated PDFs when set. */
  emblemObjectKey: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateRegulatoryAuthorityInput {
  countryId: string
  code: string
  name: string
  formCode?: string
  ministryName?: string
  poBoxAddress?: string
  phone?: string
  contactEmail?: string
  emblemAssetKey?: string
}

export interface UpdateRegulatoryAuthorityInput {
  code?: string
  name?: string
  formCode?: string
  ministryName?: string
  poBoxAddress?: string
  phone?: string
  contactEmail?: string
  /** Pass an empty string to clear it back to null. */
  emblemAssetKey?: string
}

export async function listRegulatoryAuthorities(countryId?: string): Promise<RegulatoryAuthority[]> {
  const { data } = await get<RegulatoryAuthority[]>('/regulatory-authorities', countryId ? { countryId } : undefined)
  return data
}

/** The bundled, version-controlled emblem image keys actually present in the codebase — populates the emblem picker so an admin only ever selects a real, renderable key. */
export async function listAvailableEmblemAssetKeys(): Promise<string[]> {
  const { data } = await get<string[]>('/regulatory-authorities/emblem-assets')
  return data
}

export async function createRegulatoryAuthority(input: CreateRegulatoryAuthorityInput): Promise<RegulatoryAuthority> {
  const { data } = await post<RegulatoryAuthority>('/regulatory-authorities', input)
  return data
}

export async function updateRegulatoryAuthority(id: string, input: UpdateRegulatoryAuthorityInput): Promise<RegulatoryAuthority> {
  const { data } = await patch<RegulatoryAuthority>(`/regulatory-authorities/${id}`, input)
  return data
}

/** Real-usage feedback, 19 Aug 2026 — server-proxied straight to R2 via `StorageService.putObject()`, same pattern as every other upload in this app (no R2 bucket CORS needed). */
export async function uploadRegulatoryAuthorityEmblem(id: string, file: File): Promise<RegulatoryAuthority> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await post<RegulatoryAuthority>(`/regulatory-authorities/${id}/emblem`, formData)
  return data
}

export async function removeRegulatoryAuthorityEmblem(id: string): Promise<RegulatoryAuthority> {
  const { data } = await post<RegulatoryAuthority>(`/regulatory-authorities/${id}/emblem/remove`)
  return data
}
