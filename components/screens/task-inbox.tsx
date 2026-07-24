'use client'

import { useState, useEffect } from 'react'
import { Clock, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { Task, Urgency } from '@/lib/types'
import { getAllTasks } from '@/lib/mock'
import { StatusBadge } from '@/components/ui/status-badge'
import { UrgencyBadge } from '@/components/ui/urgency-badge'

type UrgencyFilter = Urgency | 'all'

export function TaskInbox() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedUrgency, setSelectedUrgency] = useState<UrgencyFilter>('all')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadTasks() {
      const data = await getAllTasks()
      setTasks(data)
      setIsLoading(false)
    }
    loadTasks()
  }, [])

  const filteredTasks =
    selectedUrgency === 'all' ? tasks : tasks.filter(t => t.urgency === selectedUrgency)

  const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  const sortedTasks = filteredTasks.sort(
    (a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
  )

  const getIcon = (urgency: Urgency) => {
    switch (urgency) {
      case 'critical':
        return <AlertCircle className="h-5 w-5 text-status-error" />
      case 'high':
        return <Clock className="h-5 w-5 text-status-warning" />
      default:
        return <CheckCircle2 className="h-5 w-5 text-status-success" />
    }
  }

  const getDaysUntilDue = (dueDate: string) => {
    const days = Math.ceil(
      (new Date(dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    )
    return days
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-12 w-32 animate-pulse rounded-lg bg-muted"></div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Task Inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">{sortedTasks.length} active tasks</p>
        </div>

        {/* Urgency Filter */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map(urgency => (
            <button
              key={urgency}
              onClick={() => setSelectedUrgency(urgency)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                selectedUrgency === urgency
                  ? 'bg-safemeds-teal text-white'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              }`}
            >
              {urgency === 'all' ? 'All Tasks' : urgency.charAt(0).toUpperCase() + urgency.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {sortedTasks.length === 0 ? (
          <div className="rounded-lg border border-border bg-card/50 p-12 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-status-success/30 mb-4" />
            <p className="text-sm text-muted-foreground">No tasks to display</p>
          </div>
        ) : (
          sortedTasks.map(task => {
            const daysUntilDue = getDaysUntilDue(task.dueDate)
            const isOverdue = daysUntilDue < 0

            return (
              <div
                key={task.id}
                className="rounded-lg border border-border bg-card p-4 hover:border-safemeds-teal/30 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="mt-1">{getIcon(task.urgency)}</div>
                    <div className="flex-1">
                      <div className="flex items-start gap-3 mb-2">
                        <div>
                          <h3 className="font-semibold text-foreground">{task.title}</h3>
                          <p className="text-sm text-muted-foreground">{task.description}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <UrgencyBadge urgency={task.urgency} />
                        <StatusBadge status={task.status} />
                        <span className="text-xs text-muted-foreground">
                          Type: {task.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Due Date */}
                  <div
                    className={`rounded-lg px-3 py-2 text-right min-w-fit ${
                      isOverdue
                        ? 'bg-status-error/10 text-status-error'
                        : daysUntilDue <= 2
                          ? 'bg-status-warning/10 text-status-warning'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <p className="text-xs font-medium">
                      {isOverdue ? 'Overdue' : `${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`}
                    </p>
                    <p className="text-xs">
                      {new Date(task.dueDate).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
