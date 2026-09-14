import { get, post } from './client'

export interface WorkflowState {
  id: string
  stateKey: string
  name: string
  isInitial: boolean
  isTerminal: boolean
}

export interface WorkflowTransitionDef {
  id: string
  fromStateId: string
  toStateId: string
  requiredRoleId: string
  requiresSignature: boolean
}

export interface WorkflowDefinition {
  id: string
  recordType: string
  reportTypeId: string | null
  countryId: string | null
  version: number
  status: 'draft' | 'active' | 'retired'
  states: WorkflowState[]
  transitions: WorkflowTransitionDef[]
}

export interface WorkflowInstance {
  id: string
  definitionId: string
  recordType: string
  recordId: string
  currentStateId: string
  enteredAt: string
  version: number
}

export interface WorkflowInstanceDetail extends WorkflowInstance {
  definition: WorkflowDefinition
  currentState: WorkflowState
}

export interface AvailableTransition {
  id: string
  toStateKey: string
  toStateName: string
  requiredRoleKey: string
  requiresSignature: boolean
  allowed: boolean
}

export async function getWorkflowDefinition(id: string): Promise<WorkflowDefinition> {
  const { data } = await get<WorkflowDefinition>(`/workflow/definitions/${id}`)
  return data
}

export async function instantiateWorkflow(recordType: string, recordId: string, countryId?: string): Promise<WorkflowInstance> {
  const { data } = await post<WorkflowInstance>('/workflow/instances', { recordType, recordId, countryId })
  return data
}

export async function getWorkflowInstance(id: string): Promise<WorkflowInstanceDetail> {
  const { data } = await get<WorkflowInstanceDetail>(`/workflow/instances/${id}`)
  return data
}

export async function getAvailableTransitions(instanceId: string): Promise<AvailableTransition[]> {
  const { data } = await get<AvailableTransition[]>(`/workflow/instances/${instanceId}/available-transitions`)
  return data
}

export async function postTransition(
  instanceId: string,
  toStateKey: string,
  signature?: { signatureToken: string; intentStatement: string },
  note?: string,
  payload?: Record<string, unknown>,
): Promise<WorkflowInstance> {
  const { data } = await post<WorkflowInstance>(`/workflow/instances/${instanceId}/transition`, {
    toStateKey,
    ...(signature ?? {}),
    ...(note ? { note } : {}),
    ...(payload ? { payload } : {}),
  })
  return data
}
