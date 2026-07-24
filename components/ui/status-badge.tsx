import type { Status } from '@/lib/types'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: Status
  className?: string
}

const statusConfig = {
  active: { bg: 'bg-status-success/10', text: 'text-status-success', label: 'Active' },
  inactive: { bg: 'bg-muted', text: 'text-muted-foreground', label: 'Inactive' },
  pending: { bg: 'bg-status-warning/10', text: 'text-status-warning', label: 'Pending' },
  archived: { bg: 'bg-muted', text: 'text-muted-foreground', label: 'Archived' },
  deactivated: { bg: 'bg-status-error/10', text: 'text-status-error', label: 'Deactivated' },
  voided: { bg: 'bg-status-error/10', text: 'text-status-error', label: 'Voided' },
  retired: { bg: 'bg-muted', text: 'text-muted-foreground', label: 'Retired' },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.bg,
        config.text,
        className
      )}
    >
      <span className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', config.text)}></span>
      {config.label}
    </span>
  )
}
