'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface CollapsibleSectionProps {
  title: string
  icon?: React.ReactNode
  badge?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}

/**
 * Space-economizing wrapper for sections that are useful but not the
 * primary reason a user is on the page (security policy, permissions
 * reference, pending invitations) — closed by default so the page reads
 * as short and scannable, one click away from full detail.
 */
export function CollapsibleSection({ title, icon, badge, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="flex items-center gap-2 font-semibold text-foreground text-sm">
          {icon}
          {title}
          {badge}
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
      </button>
      {open && <div className="border-t border-border p-4">{children}</div>}
    </div>
  )
}
