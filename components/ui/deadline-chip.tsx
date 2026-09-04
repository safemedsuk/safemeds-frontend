import { cn } from '@/lib/utils'

interface DeadlineChipProps {
  dueAt: string | Date
  className?: string
}

/**
 * The overdue/due-soon/neutral color-coded chip logic used to be
 * copy-pasted separately in task-inbox.tsx, master-data.tsx, and
 * electronic-signature.tsx — factored into one shared component here so
 * Phase 5's real `dueAt` values (and any future date-urgency display) have
 * a single implementation to update.
 */
export function DeadlineChip({ dueAt, className }: DeadlineChipProps) {
  const due = new Date(dueAt)
  const msRemaining = due.getTime() - Date.now()
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24))
  const isOverdue = msRemaining < 0

  const label = isOverdue
    ? `Overdue by ${Math.abs(daysRemaining)}d`
    : daysRemaining === 0
      ? 'Due today'
      : `Due in ${daysRemaining}d`

  const tone = isOverdue ? 'error' : daysRemaining <= 2 ? 'warning' : 'neutral'
  const styles = {
    error: 'bg-status-error/10 text-status-error',
    warning: 'bg-status-warning/10 text-status-warning',
    neutral: 'bg-muted text-muted-foreground',
  } as const

  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', styles[tone], className)}>
      {label}
    </span>
  )
}
