import { get, patch, post } from './client'

export interface TrainingType {
  id: string
  countryId: string | null
  typeKey: string
  label: string
  sortOrder: number
  active: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Special Corner SC-8 — `countryId` omitted resolves to the caller's
 * own tenant home country server-side (what `LogTrainingModal` uses);
 * pass it explicitly for the admin screen, which has no home country
 * of its own.
 */
export async function listTrainingTypes(params: { countryId?: string; includeInactive?: boolean } = {}): Promise<TrainingType[]> {
  const { data } = await get<TrainingType[]>('/training-types', {
    countryId: params.countryId,
    includeInactive: params.includeInactive ? 'true' : undefined,
  })
  return data
}

export interface CreateTrainingTypeInput {
  countryId?: string
  typeKey: string
  label: string
  sortOrder?: number
}

export async function createTrainingType(input: CreateTrainingTypeInput): Promise<TrainingType> {
  const { data } = await post<TrainingType>('/training-types', input)
  return data
}

export interface UpdateTrainingTypeInput {
  label?: string
  sortOrder?: number
  active?: boolean
}

export async function updateTrainingType(id: string, input: UpdateTrainingTypeInput): Promise<TrainingType> {
  const { data } = await patch<TrainingType>(`/training-types/${id}`, input)
  return data
}
