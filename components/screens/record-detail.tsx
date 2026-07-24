'use client'

import { useState } from 'react'
import { ArrowLeft, Edit2, Download, Share2, MessageCircle, Clock, User, AlertCircle } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'

interface ActivityItem {
  id: string
  type: 'created' | 'updated' | 'commented' | 'approved' | 'rejected' | 'status_changed'
  user: string
  timestamp: string
  description: string
  details?: Record<string, any>
  comment?: string
}

interface RecordDetail {
  id: string
  name: string
  type: string
  status: 'draft' | 'active' | 'pending' | 'archived'
  description: string
  createdBy: string
  createdAt: string
  lastModified: string
  department: string
}

const mockRecord: RecordDetail = {
  id: 'PROD-2024-001',
  name: 'Amoxicillin 500mg Capsules',
  type: 'Product Registration',
  status: 'active',
  description:
    'Amoxicillin 500mg capsules for oral administration. Broad-spectrum beta-lactam antibiotic.',
  createdBy: 'user-1',
  createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
  lastModified: new Date(Date.now() - 3600000 * 2).toISOString(),
  department: 'Regulatory Affairs',
}

const mockActivity: ActivityItem[] = [
  {
    id: 'act-1',
    type: 'updated',
    user: 'John Doe',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    description: 'Updated manufacturing process documentation',
    details: { field: 'manufacturing_process', oldValue: 'Manual', newValue: 'Automated' },
  },
  {
    id: 'act-2',
    type: 'approved',
    user: 'Jane Smith',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    description: 'Approved for market distribution',
  },
  {
    id: 'act-3',
    type: 'commented',
    user: 'Michael Chen',
    timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
    description: 'Added compliance note',
    comment: 'All FDA requirements met. Ready for final approval.',
  },
  {
    id: 'act-4',
    type: 'status_changed',
    user: 'Sarah Williams',
    timestamp: new Date(Date.now() - 86400000 * 5).toISOString(),
    description: 'Changed status to active',
    details: { from: 'pending', to: 'active' },
  },
  {
    id: 'act-5',
    type: 'created',
    user: 'Robert Johnson',
    timestamp: new Date(Date.now() - 86400000 * 30).toISOString(),
    description: 'Created product registration record',
  },
]

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'created':
      return '✨'
    case 'updated':
      return '📝'
    case 'commented':
      return '💬'
    case 'approved':
      return '✓'
    case 'rejected':
      return '✕'
    case 'status_changed':
      return '→'
    default:
      return '•'
  }
}

const getActivityColor = (type: string) => {
  switch (type) {
    case 'created':
      return 'bg-blue-500/10 border-blue-500/30'
    case 'updated':
      return 'bg-amber-500/10 border-amber-500/30'
    case 'commented':
      return 'bg-purple-500/10 border-purple-500/30'
    case 'approved':
      return 'bg-status-success/10 border-status-success/30'
    case 'rejected':
      return 'bg-status-error/10 border-status-error/30'
    case 'status_changed':
      return 'bg-cyan-500/10 border-cyan-500/30'
    default:
      return 'bg-muted border-border'
  }
}

export function RecordDetail() {
  const [record] = useState<RecordDetail>(mockRecord)
  const [activity] = useState<ActivityItem[]>(mockActivity)
  const [newComment, setNewComment] = useState('')

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success'
      case 'draft':
        return 'warning'
      case 'pending':
        return 'info'
      case 'archived':
        return 'secondary'
      default:
        return 'secondary'
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card p-6">
        <div className="max-w-4xl mx-auto">
          <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Records
          </button>

          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">{record.name}</h1>
              <p className="text-muted-foreground text-sm mt-1">{record.id}</p>
            </div>
            <StatusBadge status={getStatusColor(record.status)} />
          </div>

          <p className="text-foreground mt-4 leading-relaxed max-w-2xl">{record.description}</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Meta Information */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</p>
            <p className="mt-2 font-medium text-foreground">{record.type}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Department</p>
            <p className="mt-2 font-medium text-foreground">{record.department}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
            <p className="mt-2 font-medium text-foreground capitalize">{record.status}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
            <Edit2 className="h-4 w-4" />
            Edit Record
          </button>
          <button className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
            <Download className="h-4 w-4" />
            Export PDF
          </button>
          <button className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>

        {/* Activity Stream */}
        <div className="space-y-4">
          <h2 className="font-display font-bold text-xl text-foreground">Activity Stream</h2>

          {/* Add Comment */}
          <div className="rounded-lg border border-border bg-card p-4">
            <label className="text-sm font-semibold text-foreground mb-2 block">Add Comment</label>
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Share your thoughts or updates about this record..."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-safemeds-teal mb-2"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors border border-border">
                Cancel
              </button>
              <button className="rounded-lg px-3 py-1.5 text-sm font-medium text-white bg-safemeds-teal hover:bg-safemeds-spruce transition-colors">
                Post Comment
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div className="relative space-y-4">
            {activity.map((item, index) => (
              <div key={item.id} className="flex gap-4">
                {/* Timeline Line */}
                <div className="relative flex flex-col items-center">
                  <div className={`rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold border-2 ${getActivityColor(item.type)}`}>
                    {getActivityIcon(item.type)}
                  </div>
                  {index < activity.length - 1 && (
                    <div className="w-1 h-12 bg-border mt-2"></div>
                  )}
                </div>

                {/* Activity Content */}
                <div className="flex-1 pb-4">
                  <div className={`rounded-lg border p-4 ${getActivityColor(item.type)}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-foreground text-sm">{item.description}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                          <span className="font-medium">{item.user}</span>
                          <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                          <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>

                    {/* Details */}
                    {item.details && (
                      <div className="mt-3 text-xs space-y-1 bg-black/10 p-2 rounded">
                        {Object.entries(item.details).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-muted-foreground">{key}:</span>
                            {typeof value === 'object' ? (
                              <span className="font-mono text-foreground">{JSON.stringify(value)}</span>
                            ) : (
                              <span className="font-mono text-foreground">{String(value)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Comment */}
                    {item.comment && (
                      <div className="mt-3 pl-3 border-l-2 border-safemeds-teal/50">
                        <p className="text-sm text-foreground italic">&quot;{item.comment}&quot;</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Related Information */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Timeline
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium text-foreground">{new Date(record.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Modified</p>
                <p className="font-medium text-foreground">{new Date(record.lastModified).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              Ownership
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-muted-foreground">Created By</p>
                <p className="font-medium text-foreground">{record.createdBy}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Department</p>
                <p className="font-medium text-foreground">{record.department}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
