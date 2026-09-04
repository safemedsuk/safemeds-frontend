import { ArrowRight, ShieldCheck } from 'lucide-react'
import type { AvailableTransition, WorkflowState } from '@/lib/api/workflow'

interface WorkflowStepperProps {
  states: WorkflowState[]
  currentStateId: string
  availableTransitions: AvailableTransition[]
  onTransitionClick: (transition: AvailableTransition) => void
  busy?: boolean
}

/**
 * Shared stage-flow visual (adapted from the original mock-only
 * workflow-viewer's stage diagram) plus the real action-button row driven
 * by `GET /workflow/instances/:id/available-transitions`. A transition the
 * actor's roles don't satisfy is shown disabled with a tooltip explaining
 * why, rather than hidden — so a user can see what the next step requires
 * even if they can't perform it themselves.
 */
export function WorkflowStepper({ states, currentStateId, availableTransitions, onTransitionClick, busy }: WorkflowStepperProps) {
  const currentIndex = states.findIndex((s) => s.id === currentStateId)

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-4">
          {states.map((state, index) => {
            const isCompleted = currentIndex >= 0 && index < currentIndex
            const isCurrent = state.id === currentStateId

            return (
              <div key={state.id} className="flex items-center gap-2 flex-shrink-0">
                <div
                  className={`rounded-full p-3 text-center min-w-24 border-2 ${
                    isCompleted
                      ? 'bg-status-success/10 text-status-success border-status-success'
                      : isCurrent
                        ? 'bg-status-warning/10 text-status-warning border-status-warning'
                        : 'bg-muted text-muted-foreground border-border'
                  }`}
                >
                  <p className="text-xs font-medium">{state.name}</p>
                </div>

                {index < states.length - 1 && (
                  <ArrowRight className={`h-5 w-5 flex-shrink-0 ${isCompleted ? 'text-status-success' : 'text-muted-foreground'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-foreground text-sm">Available Actions</h3>
        {availableTransitions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No transitions available from the current state — this may be a terminal state, or none of your roles are
            authorized to act on it.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableTransitions.map((t) => (
              <button
                key={t.id}
                disabled={!t.allowed || busy}
                onClick={() => onTransitionClick(t)}
                title={!t.allowed ? `Requires the ${t.requiredRoleKey} role` : undefined}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                  t.allowed
                    ? 'bg-safemeds-teal text-white hover:bg-safemeds-spruce disabled:cursor-not-allowed'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
              >
                {t.requiresSignature && <ShieldCheck className="h-4 w-4" />}
                Move to {t.toStateName}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
