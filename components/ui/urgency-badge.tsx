import type { Urgency } from '@/lib/types'
import { cn } from '@/lib/utils'

interface UrgencyBadgeProps {
  urgency: Urgency
  className?: string
}

const urgencyConfig = {
  critical: { bg: 'bg-status-error/10', text: 'text-status-error', label: 'Critical' },
  high: { bg: 'bg-status-warning/10', text: 'text-status-warning', label: 'High' },
  medium: { bg: 'bg-status-info/10', text: 'text-status-info', label: 'Medium' },
  low: { bg: 'bg-status-success/10', text: 'text-status-success', label: 'Low' },
}

export function UrgencyBadge({ urgency, className }: UrgencyBadgeProps) {
  const config = urgencyConfig[urgency]

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.bg,
        config.text,
        className
      )}
    >
      {config.label}
    </span>
  )
}
