'use client'

import { useState } from 'react'
import { ArrowRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import type { WorkflowDefinition, WorkflowInstance } from '@/lib/types'

const mockWorkflowDefinitions: WorkflowDefinition[] = [
  {
    id: 'wf-1',
    name: 'Product Registration',
    version: 2,
    stages: [
      { id: 's1', order: 1, name: 'Submission', description: 'Initial product data entry', requiredApprovals: 1, timeoutDays: 7 },
      { id: 's2', order: 2, name: 'Regulatory Review', description: 'Compliance officer review', requiredApprovals: 1, timeoutDays: 14 },
      { id: 's3', order: 3, name: 'Management Approval', description: 'Manager sign-off', requiredApprovals: 2, timeoutDays: 7 },
      { id: 's4', order: 4, name: 'Published', description: 'Live in the system', requiredApprovals: 0, timeoutDays: 0 },
    ],
    createdAt: new Date(Date.now() - 86400000 * 180).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'wf-2',
    name: 'Batch Release',
    version: 1,
    stages: [
      { id: 's1', order: 1, name: 'Quality Check', description: 'Lab testing', requiredApprovals: 1, timeoutDays: 5 },
      { id: 's2', order: 2, name: 'Documentation', description: 'Verify paperwork', requiredApprovals: 1, timeoutDays: 3 },
      { id: 's3', order: 3, name: 'Released', description: 'Ready for distribution', requiredApprovals: 0, timeoutDays: 0 },
    ],
    createdAt: new Date(Date.now() - 86400000 * 90).toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

const mockWorkflowInstances: WorkflowInstance[] = [
  {
    id: 'inst-1',
    workflowId: 'wf-1',
    entityId: 'product-1',
    entityType: 'product',
    currentStage: 2,
    state: 'in_review',
    progress: 50,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    createdBy: 'user-1',
  },
  {
    id: 'inst-2',
    workflowId: 'wf-2',
    entityId: 'batch-1',
    entityType: 'batch',
    currentStage: 1,
    state: 'in_review',
    progress: 33,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
    createdBy: 'user-2',
  },
]

const getStateIcon = (state: string) => {
  switch (state) {
    case 'approved':
      return <CheckCircle2 className="h-5 w-5 text-status-success" />
    case 'in_review':
      return <Clock className="h-5 w-5 text-status-warning" />
    case 'rejected':
      return <AlertCircle className="h-5 w-5 text-status-error" />
    default:
      return <Clock className="h-5 w-5 text-muted-foreground" />
  }
}

export function WorkflowViewer() {
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('wf-1')
  const [selectedInstance, setSelectedInstance] = useState<string>('inst-1')

  const workflow = mockWorkflowDefinitions.find(w => w.id === selectedWorkflow)
  const instances = mockWorkflowInstances.filter(i => i.workflowId === selectedWorkflow)
  const activeInstance = instances.find(i => i.id === selectedInstance) || instances[0]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Workflow Viewer</h1>
        <p className="mt-1 text-sm text-muted-foreground">Monitor and manage document workflows</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Workflow Selection */}
        <div className="lg:col-span-1 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Workflow Type
            </label>
            <div className="space-y-2">
              {mockWorkflowDefinitions.map(wf => (
                <button
                  key={wf.id}
                  onClick={() => {
                    setSelectedWorkflow(wf.id)
                    setSelectedInstance('')
                  }}
                  className={`w-full rounded-lg px-4 py-3 text-left transition-colors ${
                    selectedWorkflow === wf.id
                      ? 'bg-safemeds-teal/10 border border-safemeds-teal text-safemeds-teal'
                      : 'border border-border text-foreground hover:bg-muted'
                  }`}
                >
                  <p className="font-medium text-sm">{wf.name}</p>
                  <p className="text-xs text-muted-foreground">{wf.stages.length} stages</p>
                </button>
              ))}
            </div>
          </div>

          {/* Active Instances */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Active Instances
            </label>
            <div className="space-y-2">
              {instances.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/50">No active workflows</p>
              ) : (
                instances.map(inst => (
                  <button
                    key={inst.id}
                    onClick={() => setSelectedInstance(inst.id)}
                    className={`w-full rounded-lg px-4 py-3 text-left transition-colors ${
                      selectedInstance === inst.id
                        ? 'bg-safemeds-teal/10 border border-safemeds-teal'
                        : 'border border-border hover:bg-muted'
                    }`}
                  >
                    <p className="font-medium text-sm text-foreground">{inst.entityId}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">{inst.state}</p>
                      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-safemeds-teal transition-all"
                          style={{ width: `${inst.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Workflow Visualization */}
        <div className="lg:col-span-2">
          {workflow && (
            <div className="space-y-6">
              {/* Workflow Info */}
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display font-bold text-lg text-foreground">{workflow.name}</h2>
                  <span className="text-xs font-medium bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full">
                    v{workflow.version}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{workflow.stages.length} stage workflow</p>
              </div>

              {/* Flow Diagram */}
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="flex items-center justify-between gap-2 overflow-x-auto pb-4">
                  {workflow.stages.map((stage, index) => {
                    const isCompleted = activeInstance && stage.order < activeInstance.currentStage
                    const isCurrent = activeInstance && stage.order === activeInstance.currentStage
                    const isUpcoming = activeInstance && stage.order > activeInstance.currentStage

                    return (
                      <div key={stage.id} className="flex items-center gap-2 flex-shrink-0">
                        <div
                          className={`rounded-full p-3 text-center min-w-20 ${
                            isCompleted
                              ? 'bg-status-success/10 text-status-success border-2 border-status-success'
                              : isCurrent
                                ? 'bg-status-warning/10 text-status-warning border-2 border-status-warning'
                                : isUpcoming
                                  ? 'bg-muted text-muted-foreground border-2 border-border'
                                  : 'bg-muted text-muted-foreground border-2 border-border'
                          }`}
                        >
                          <p className="font-bold text-sm">{stage.order}</p>
                          <p className="text-xs font-medium">{stage.name}</p>
                        </div>

                        {index < workflow.stages.length - 1 && (
                          <ArrowRight
                            className={`h-5 w-5 ${
                              isCompleted ? 'text-status-success' : 'text-muted-foreground'
                            } flex-shrink-0`}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Stage Details */}
              {activeInstance && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground">Current Stage Details</h3>
                  {workflow.stages.map(stage => {
                    if (stage.order !== activeInstance.currentStage) return null

                    return (
                      <div key={stage.id} className="rounded-lg border border-border bg-card p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-foreground">{stage.name}</h4>
                            <p className="text-sm text-muted-foreground mt-1">{stage.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStateIcon(activeInstance.state)}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Approvals Required</p>
                            <p className="font-semibold text-foreground mt-1">{stage.requiredApprovals}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Timeout</p>
                            <p className="font-semibold text-foreground mt-1">{stage.timeoutDays} days</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Overall Progress</p>
                            <div className="mt-1 w-full h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full bg-safemeds-teal"
                                style={{ width: `${activeInstance.progress}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
