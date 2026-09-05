import { get } from './client'

export interface BenefitRiskSummary {
  subjectId: string
  periodStart: string | null
  periodEnd: string | null
  caseCount: number
  seriousnessBreakdown: Record<string, number>
  expectednessBreakdown: Record<string, number>
  adverseEventOutcomeBreakdown: Record<string, number>
  causalityBreakdown: Record<string, number>
}

export async function getBenefitRiskSummary(productId: string, periodStart?: string, periodEnd?: string): Promise<BenefitRiskSummary> {
  const { data } = await get<BenefitRiskSummary>(`/reporting/benefit-risk/${productId}`, { periodStart, periodEnd })
  return data
}
