import { get, patch, post } from './client'

export interface ProductClass {
  id: string
  authorityId: string | null
  classKey: string
  label: string
  description: string | null
  sourceReference: string | null
  sortOrder: number
  active: boolean
  createdAt: string
  updatedAt: string
}

/** `authorityId` omitted returns only the generic (authority-agnostic) rows — always pass it when populating a picker scoped to one authority. */
export async function listProductClasses(params: { authorityId?: string; includeInactive?: boolean } = {}): Promise<ProductClass[]> {
  const { data } = await get<ProductClass[]>('/product-classes', {
    authorityId: params.authorityId,
    includeInactive: params.includeInactive ? 'true' : undefined,
  })
  return data
}

export interface CreateProductClassInput {
  authorityId?: string
  classKey: string
  label: string
  description?: string
  sourceReference?: string
  sortOrder?: number
}

export async function createProductClass(input: CreateProductClassInput): Promise<ProductClass> {
  const { data } = await post<ProductClass>('/product-classes', input)
  return data
}

export interface UpdateProductClassInput {
  label?: string
  description?: string
  sourceReference?: string
  sortOrder?: number
  active?: boolean
}

export async function updateProductClass(id: string, input: UpdateProductClassInput): Promise<ProductClass> {
  const { data } = await patch<ProductClass>(`/product-classes/${id}`, input)
  return data
}
