import { get, post } from './client'

export interface DashboardOverview {
  totalCompanies: number
  activeCompanies: number
  suspendedCompanies: number
  registrationsByStatus: Record<string, number>
  medianApprovalHours: number | null
}

export interface RegulatoryCoverageRow {
  authorityId: string
  authorityCode: string
  authorityName: string
  countryName: string
  totalReportTypes: number
  reportTypesWithActiveRule: number
  reportTypesWithActiveFormSchema: number
  reportTypesWithActiveSubmissionFormat: number
}

export interface QueueDepth {
  waiting: number
  active: number
  delayed: number
  failed: number
}

export interface SystemHealth {
  database: { status: string; message?: string }
  redis: { status: string; message?: string }
  queues: { deadlineEscalation: QueueDepth; notificationEmail: QueueDepth }
}

export interface DeadlineScanResult {
  breached: number
  t24: number
  t72: number
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const { data } = await get<DashboardOverview>('/platform/dashboard/overview')
  return data
}

export async function getRegulatoryCoverage(): Promise<RegulatoryCoverageRow[]> {
  const { data } = await get<RegulatoryCoverageRow[]>('/platform/dashboard/regulatory-coverage')
  return data
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const { data } = await get<SystemHealth>('/platform/ops/system-health')
  return data
}

export async function runDeadlineScan(): Promise<DeadlineScanResult> {
  const { data } = await post<DeadlineScanResult>('/platform/ops/deadline-scan')
  return data
}
