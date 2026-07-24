'use client'

import { useState, useMemo } from 'react'
import { Filter, Download, Eye, EyeOff } from 'lucide-react'
import type { AuditEntry } from '@/lib/types'

const mockAuditEntries: AuditEntry[] = [
  {
    id: 'audit-1',
    entityId: 'product-1',
    entityType: 'product',
    action: 'Updated',
    changedBy: 'user-1',
    changedAt: new Date(Date.now() - 3600000).toISOString(),
    previousValue: { strength: '500mg' },
    newValue: { strength: '500mg' },
    reason: 'Corrected manufacturing country',
    ipAddress: '192.168.1.100',
  },
  {
    id: 'audit-2',
    entityId: 'batch-1',
    entityType: 'batch',
    action: 'Created',
    changedBy: 'user-2',
    changedAt: new Date(Date.now() - 86400000).toISOString(),
    newValue: { batchNumber: 'B-2024-001' },
    ipAddress: '192.168.1.101',
  },
  {
    id: 'audit-3',
    entityId: 'rule-1',
    entityType: 'country_rule',
    action: 'Superseded',
    changedBy: 'user-1',
    changedAt: new Date(Date.now() - 172800000).toISOString(),
    reason: 'New regulation effective',
    ipAddress: '192.168.1.100',
  },
  {
    id: 'audit-4',
    entityId: 'batch-1',
    entityType: 'batch',
    action: 'Status Changed',
    changedBy: 'user-2',
    changedAt: new Date(Date.now() - 259200000).toISOString(),
    previousValue: { status: 'pending' },
    newValue: { status: 'active' },
    reason: 'Quality tests passed',
    ipAddress: '192.168.1.101',
  },
]

const ACTION_COLORS = {
  Created: 'bg-status-success/10 text-status-success',
  Updated: 'bg-status-info/10 text-status-info',
  Deleted: 'bg-status-error/10 text-status-error',
  Approved: 'bg-status-success/10 text-status-success',
  Rejected: 'bg-status-error/10 text-status-error',
  'Status Changed': 'bg-status-warning/10 text-status-warning',
  Superseded: 'bg-muted text-muted-foreground',
}

export function AuditTrail() {
  const [entries] = useState<AuditEntry[]>(mockAuditEntries)
  const [selectedEntityType, setSelectedEntityType] = useState<string>('all')
  const [selectedAction, setSelectedAction] = useState<string>('all')
  const [showDetails, setShowDetails] = useState<string | null>(null)

  const filteredEntries = useMemo(() => {
    return entries.filter(
      entry =>
        (selectedEntityType === 'all' || entry.entityType === selectedEntityType) &&
        (selectedAction === 'all' || entry.action === selectedAction)
    )
  }, [entries, selectedEntityType, selectedAction])

  const entityTypes = Array.from(new Set(entries.map(e => e.entityType)))
  const actions = Array.from(new Set(entries.map(e => e.action)))

  const getActionColor = (action: string): string => {
    return ACTION_COLORS[action as keyof typeof ACTION_COLORS] || 'bg-muted text-muted-foreground'
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Audit Trail</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete record of all system changes and actions
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/80 transition-colors">
          <Download className="h-4 w-4" />
          Export Report
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Filters</span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Entity Type
            </label>
            <select
              value={selectedEntityType}
              onChange={e => setSelectedEntityType(e.target.value)}
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="all">All Types</option>
              {entityTypes.map(type => (
                <option key={type} value={type}>
                  {type.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Action
            </label>
            <select
              value={selectedAction}
              onChange={e => setSelectedAction(e.target.value)}
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="all">All Actions</option>
              {actions.map(action => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Time Range
            </label>
            <select className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground">
              <option>Last 24 Hours</option>
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
              <option>All Time</option>
            </select>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-3">
        {filteredEntries.length === 0 ? (
          <div className="rounded-lg border border-border bg-card/50 p-12 text-center">
            <Eye className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No audit entries match the selected filters</p>
          </div>
        ) : (
          filteredEntries.map(entry => (
            <div
              key={entry.id}
              className="rounded-lg border border-border bg-card p-4 hover:border-safemeds-teal/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getActionColor(entry.action)}`}>
                      {entry.action}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {entry.entityType.replace(/_/g, ' ')} - {entry.entityId}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>By {entry.changedBy}</span>
                    <span>•</span>
                    <span>
                      {new Date(entry.changedAt).toLocaleDateString()} at{' '}
                      {new Date(entry.changedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {entry.ipAddress && (
                      <>
                        <span>•</span>
                        <span className="font-mono">{entry.ipAddress}</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowDetails(showDetails === entry.id ? null : entry.id)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors"
                >
                  {showDetails === entry.id ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              {entry.reason && (
                <div className="mb-3 rounded-lg bg-muted/30 px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Reason:</span> {entry.reason}
                  </p>
                </div>
              )}

              {showDetails === entry.id && (
                <div className="mt-4 space-y-3 border-t border-border pt-4">
                  {entry.previousValue && (
                    <div className="rounded-lg bg-status-error/5 p-3">
                      <p className="text-xs font-semibold text-status-error mb-1">Previous Value</p>
                      <pre className="text-xs text-muted-foreground overflow-x-auto">
                        {JSON.stringify(entry.previousValue, null, 2)}
                      </pre>
                    </div>
                  )}
                  {entry.newValue && (
                    <div className="rounded-lg bg-status-success/5 p-3">
                      <p className="text-xs font-semibold text-status-success mb-1">New Value</p>
                      <pre className="text-xs text-muted-foreground overflow-x-auto">
                        {JSON.stringify(entry.newValue, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Entries</p>
          <p className="text-2xl font-bold text-foreground mt-1">{entries.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Last 24 Hours</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {entries.filter(e => {
              const hours = (Date.now() - new Date(e.changedAt).getTime()) / (1000 * 60 * 60)
              return hours < 24
            }).length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Entities Affected</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {new Set(entries.map(e => e.entityId)).size}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Users Active</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {new Set(entries.map(e => e.changedBy)).size}
          </p>
        </div>
      </div>
    </div>
  )
}
