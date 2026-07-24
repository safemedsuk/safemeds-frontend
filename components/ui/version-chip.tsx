import { cn } from '@/lib/utils'

interface VersionChipProps {
  version: number | string
  label?: string
  className?: string
}

export function VersionChip({ version, label = 'v', className }: VersionChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-muted text-muted-foreground border border-border',
        className
      )}
    >
      {label}
      {version}
    </span>
  )
}
