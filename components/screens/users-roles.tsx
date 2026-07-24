'use client'

import { useState } from 'react'
import { Plus, Edit2, Trash2, Lock } from 'lucide-react'
import type { User } from '@/lib/types'
import { mockUsers } from '@/lib/mock'
import { StatusBadge } from '@/components/ui/status-badge'

const ROLES = ['admin', 'compliance_officer', 'operator', 'viewer'] as const

const rolePermissions = {
  admin: [
    'View all data',
    'Create users',
    'Edit rules',
    'Approve batches',
    'View audit trail',
    'Export reports',
  ],
  compliance_officer: [
    'View all data',
    'Review compliance',
    'Create tasks',
    'Approve registrations',
    'View audit trail',
    'Export reports',
  ],
  operator: ['View assigned data', 'Update batches', 'Create tasks', 'View limited audit'],
  viewer: ['View all data', 'Export reports'],
}

export function UsersRoles() {
  const [users, setUsers] = useState<User[]>(mockUsers)
  const [selectedRole, setSelectedRole] = useState<string>('all')

  const filteredUsers =
    selectedRole === 'all' ? users : users.filter(u => u.role === selectedRole)

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Users & Roles</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage user accounts and permissions</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors">
          <Plus className="h-4 w-4" />
          Add User
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Users List */}
        <div className="lg:col-span-2 space-y-3">
          <div className="mb-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Filter by Role
            </label>
            <select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="all">All Roles</option>
              {ROLES.map(role => (
                <option key={role} value={role}>
                  {role.replace(/_/g, ' ').charAt(0).toUpperCase() + role.replace(/_/g, ' ').slice(1)}
                </option>
              ))}
            </select>
          </div>

          {filteredUsers.map(user => (
            <div
              key={user.id}
              className="rounded-lg border border-border bg-card p-4 hover:border-safemeds-teal/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{user.name}</h3>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-safemeds-teal/10 px-2.5 py-0.5 text-xs font-medium text-safemeds-teal">
                      {user.role.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-muted-foreground">{user.department}</span>
                    <StatusBadge status={user.status} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button className="rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="rounded-lg bg-muted/30 p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Access</p>
                <p className="text-xs text-muted-foreground">
                  Last login: {new Date(user.lastLogin).toLocaleDateString()} at{' '}
                  {new Date(user.lastLogin).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Permissions Matrix */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Permissions by Role
            </h3>

            <div className="space-y-4">
              {ROLES.map(role => (
                <div key={role} className="border-t border-border pt-4 first:border-t-0 first:pt-0">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-2">
                    {role.replace(/_/g, ' ')}
                  </h4>
                  <ul className="space-y-1">
                    {rolePermissions[role].map(permission => (
                      <li key={permission} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="mt-1 h-1 w-1 rounded-full bg-safemeds-teal flex-shrink-0"></span>
                        <span>{permission}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="font-semibold text-foreground mb-3">Team Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Total Users</span>
                <span className="font-medium text-foreground">{users.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Active</span>
                <span className="font-medium text-status-success">
                  {users.filter(u => u.status === 'active').length}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Admins</span>
                <span className="font-medium text-foreground">
                  {users.filter(u => u.role === 'admin').length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
