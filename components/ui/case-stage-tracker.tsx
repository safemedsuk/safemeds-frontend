import { Check } from 'lucide-react'

export interface StageTrackerStage {
  key: string
  /** Short label under the node — kept to one or two words so 8 stages fit on one line without wrapping. */
  label: string
}

interface Props {
  stages: StageTrackerStage[]
  currentKey: string
}

/**
 * Real-usage request, 11 Sep 2026 ("Validity is part of the workflow for
 * pv... we have a series of steps that should show one at a time") —
 * a purely visual "1----2----3...N" progress track showing which of the
 * record's own real workflow states it's currently on, so the Validity
 * Gate reads as what it actually is: the first stage in that lifecycle,
 * not a buried content section. Deliberately does **not** duplicate
 * `WorkflowStepper`'s own action-button row (`WorkflowActionsPanel`
 * already owns that on this page) — this is the numbered-track half
 * alone, reusable anywhere a record's own lifecycle needs the same
 * "show me exactly where this is" indicator without a second copy of
 * the transition buttons.
 */
export function CaseStageTracker({ stages, currentKey }: Props) {
  const currentIndex = stages.findIndex((s) => s.key === currentKey)

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start overflow-x-auto">
        {stages.map((stage, index) => {
          const isDone = currentIndex >= 0 && index < currentIndex
          const isCurrent = index === currentIndex

          return (
            <div key={stage.key} className={`flex items-center ${index < stages.length - 1 ? 'flex-1 min-w-[72px]' : ''}`}>
              <div className="flex flex-shrink-0 flex-col items-center gap-1.5">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                    isDone
                      ? 'border-safemeds-teal bg-safemeds-teal text-white'
                      : isCurrent
                        ? 'border-safemeds-teal bg-safemeds-teal/10 text-safemeds-teal'
                        : 'border-border bg-muted text-muted-foreground'
                  }`}
                >
                  {isDone ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                <span className={`max-w-20 text-center text-[11px] leading-tight ${isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                  {stage.label}
                </span>
              </div>
              {index < stages.length - 1 && <div className={`mx-1 h-0.5 flex-1 ${isDone ? 'bg-safemeds-teal' : 'bg-border'}`} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
