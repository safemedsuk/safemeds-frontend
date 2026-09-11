import { get } from './client'

export interface ReportType {
  id: string
  typeKey: string
  name: string
  moduleKey: string
}

export async function listReportTypes(moduleKey?: string): Promise<ReportType[]> {
  const { data } = await get<ReportType[]>('/report-types', moduleKey ? { moduleKey } : undefined)
  return data
}
