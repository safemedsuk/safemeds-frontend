import { GeneratedReport } from './reports'
import { post } from './client'

export interface GenerateLineListingInput {
  countryId: string
  /** Both required together for a custom/on-demand range; omit both to use the country's own configured cadence. */
  periodStart?: string
  periodEnd?: string
}

export async function generateLineListing(input: GenerateLineListingInput): Promise<GeneratedReport> {
  const { data } = await post<GeneratedReport>('/reporting/line-listings', input)
  return data
}
