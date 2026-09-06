import { get, post, type PaginationMeta } from './client'

export type ContactTestChannel = 'email' | 'phone'
export type ContactTestStatus = 'pending_attempt_1' | 'pending_attempt_2' | 'reached' | 'unsuccessful'
export type ContactTestAttemptOutcome = 'reached' | 'no_response'

export const CONTACT_TEST_CHANNEL_LABELS: Record<ContactTestChannel, string> = {
  email: 'Email',
  phone: 'Phone',
}

export const CONTACT_TEST_STATUS_LABELS: Record<ContactTestStatus, string> = {
  pending_attempt_1: 'Pending — attempt 1',
  pending_attempt_2: 'Pending — attempt 2',
  reached: 'Reached',
  unsuccessful: 'Unsuccessful',
}

export interface ContactTest {
  id: string
  companyId: string
  channel: ContactTestChannel
  contactValue: string
  purpose: string | null
  status: ContactTestStatus
  attemptCount: number
  windowDueAt: string
  initiatedBy: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ContactTestAttempt {
  id: string
  contactTestId: string
  attemptNumber: number
  outcome: ContactTestAttemptOutcome
  loggedBy: string | null
  note: string | null
  occurredAt: string
}

export interface ContactTestWithAttempts extends ContactTest {
  attempts: ContactTestAttempt[]
}

export interface StartContactTestInput {
  channel: ContactTestChannel
  contactValue: string
  purpose?: string
}

export interface LogContactTestAttemptInput {
  outcome: ContactTestAttemptOutcome
  note?: string
}

export async function startContactTest(input: StartContactTestInput): Promise<ContactTest> {
  const { data } = await post<ContactTest>('/contact-tests', input)
  return data
}

export interface ListContactTestsResult {
  tests: ContactTest[]
  meta: PaginationMeta
}

export async function listContactTests(page = 1, limit = 10): Promise<ListContactTestsResult> {
  const { data, meta } = await get<ContactTest[]>('/contact-tests', { page, limit })
  return { tests: data, meta: meta ?? { page: 1, limit, total: data.length, totalPages: 1 } }
}

export async function getContactTest(id: string): Promise<ContactTestWithAttempts> {
  const { data } = await get<ContactTestWithAttempts>(`/contact-tests/${id}`)
  return data
}

export async function logContactTestAttempt(id: string, input: LogContactTestAttemptInput): Promise<ContactTest> {
  const { data } = await post<ContactTest>(`/contact-tests/${id}/log-attempt`, input)
  return data
}
