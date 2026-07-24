'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ArrowRight } from 'lucide-react'

interface Command {
  id: string
  label: string
  description: string
  action: () => void
  category: string
}

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const commands: Command[] = [
    {
      id: 'goto-inbox',
      label: 'Task Inbox',
      description: 'View your tasks',
      action: () => {
        router.push('/tasks')
        setOpen(false)
      },
      category: 'Navigation',
    },
    {
      id: 'goto-users',
      label: 'Users & Roles',
      description: 'Manage team members',
      action: () => {
        router.push('/users-and-roles')
        setOpen(false)
      },
      category: 'Navigation',
    },
    {
      id: 'goto-countries',
      label: 'Country Rules',
      description: 'Regulatory configuration',
      action: () => {
        router.push('/country-rules')
        setOpen(false)
      },
      category: 'Navigation',
    },
    {
      id: 'goto-workflows',
      label: 'Workflow Viewer',
      description: 'Process flows',
      action: () => {
        router.push('/workflow-viewer')
        setOpen(false)
      },
      category: 'Navigation',
    },
    {
      id: 'goto-master',
      label: 'Master Data',
      description: 'Products, batches, registrations',
      action: () => {
        router.push('/master-data')
        setOpen(false)
      },
      category: 'Navigation',
    },
    {
      id: 'goto-audit',
      label: 'Audit Trail',
      description: 'Compliance records',
      action: () => {
        router.push('/audit-trail')
        setOpen(false)
      },
      category: 'Navigation',
    },
  ]

  const filtered = commands.filter(
    cmd =>
      cmd.label.toLowerCase().includes(search.toLowerCase()) ||
      cmd.description.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(!open)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open])

  if (!open) {
    return null
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={() => setOpen(false)}
      />

      {/* Command Palette */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
            <Search className="h-4 w-4 text-[var(--text-muted)]" />
            <input
              autoFocus
              placeholder="Search commands..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none"
            />
          </div>

          {/* Results */}
          <div className="max-h-72 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-[var(--text-muted)] text-sm">
                No commands found
              </div>
            ) : (
              <div>
                {filtered.map(cmd => (
                  <button
                    key={cmd.id}
                    onClick={cmd.action}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--surface-raised)] border-b border-[var(--border)] last:border-0 text-left group"
                  >
                    <div>
                      <div className="font-medium text-[var(--text)]">
                        {cmd.label}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {cmd.description}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer Hint */}
          <div className="px-4 py-2 text-xs text-[var(--text-muted)] bg-[var(--surface-raised)] border-t border-[var(--border)] rounded-b-lg">
            Press <kbd className="font-mono">Esc</kbd> to close
          </div>
        </div>
      </div>
    </>
  )
}
