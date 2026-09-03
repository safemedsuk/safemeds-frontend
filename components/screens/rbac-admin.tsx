'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Info, KeyRound, Loader2, Plus, Search, ShieldAlert, Users } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  CreateRoleInput,
  PermissionWithRoles,
  createPermission,
  createRole,
  getRoleImpact,
  listPermissionsWithRoles,
  updateRolePermissions,
} from '@/lib/api/rbac-admin'
import { RoleWithPermissions, getRoleCatalog } from '@/lib/api/roles'
import { Modal } from '@/components/ui/modal'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

function domainOf(key: string): string {
  return key.split('.')[0]
}

function groupByDomain<T extends { key: string }>(items: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const domain = domainOf(item.key)
    if (!groups.has(domain)) groups.set(domain, [])
    groups.get(domain)!.push(item)
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
}

type Tab = 'catalog' | 'roles'

/**
 * Admin Configuration Console — Gap 4. Before this screen, the only way
 * to change what a role can do (or add a new permission/role at all)
 * was editing `rbac.seed-data.ts` and re-seeding. Platform-only
 * (`platform.rbac.manage`) — roles carry no `companyId`, so a change
 * here affects every tenant on the platform at once.
 */
export function RbacAdminScreen() {
  const { has } = usePermissions()
  const canManage = has('platform.rbac.manage')
  const [tab, setTab] = useState<Tab>('catalog')

  if (!canManage) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">RBAC Administration</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to manage roles and permissions.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <div className="flex items-center gap-3">
          <KeyRound className="h-6 w-6 text-safemeds-teal" />
          <h1 className="text-3xl font-display font-bold text-foreground">RBAC Administration</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">What every permission does, and which roles carry it — across the whole platform.</p>
      </div>

      <div className="flex gap-1 rounded-lg border border-border bg-card p-1 w-fit">
        <button
          onClick={() => setTab('catalog')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${tab === 'catalog' ? 'bg-safemeds-teal text-white' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Permission Catalog
        </button>
        <button
          onClick={() => setTab('roles')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${tab === 'roles' ? 'bg-safemeds-teal text-white' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Role Editor
        </button>
      </div>

      {tab === 'catalog' ? <PermissionCatalogTab /> : <RoleEditorTab />}
    </div>
  )
}

// ── Permission Catalog ───────────────────────────────────────────────────────

function PermissionCatalogTab() {
  const [permissions, setPermissions] = useState<PermissionWithRoles[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [notice, setNotice] = useTimedMessage()

  const load = () => {
    setLoading(true)
    setError(null)
    listPermissionsWithRoles()
      .then(setPermissions)
      .catch((err) => setError(getErrorMessage(err, 'Could not load the permission catalog.')))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const filtered = useMemo(
    () => permissions.filter((p) => p.key.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase())),
    [permissions, search],
  )
  const grouped = useMemo(() => groupByDomain(filtered), [filtered])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by key or description..."
            className={`${inputClass} pl-8`}
          />
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce"
        >
          <Plus className="h-4 w-4" /> New Permission
        </button>
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([domain, items]) => (
            <div key={domain} className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="border-b border-border bg-muted/30 px-4 py-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{domain}</p>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {items.map((p) => (
                    <tr key={p.key} className="border-b border-border last:border-0">
                      <td className="p-3 font-mono text-xs text-foreground whitespace-nowrap">{p.key}</td>
                      <td className="p-3 text-muted-foreground">{p.description}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {p.roleKeys.length === 0 ? (
                            <span className="text-xs italic text-muted-foreground">Held by no role</span>
                          ) : (
                            p.roleKeys.map((r) => (
                              <span key={r} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground">
                                {r}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreatePermissionModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            setNotice('Permission created. It gates nothing until an engineer adds a matching check to a real endpoint.')
            load()
          }}
        />
      )}
    </div>
  )
}

function CreatePermissionModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [key, setKey] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/.test(key) && description.trim().length > 0

  const handleCreate = async () => {
    if (!isValid) return
    setBusy(true)
    setError(null)
    try {
      await createPermission({ key, description: description.trim() })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this permission.'))
      setBusy(false)
    }
  }

  return (
    <Modal title="New Permission" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/5 p-2.5 text-xs text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-warning" />
          A new permission gates nothing by itself — it becomes meaningful only once an engineer adds a matching{' '}
          <code className="font-mono">@RequirePermissions()</code> check to a real endpoint in a later code change. Creating it here just
          reserves the key and makes it assignable to roles.
        </div>
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div>
          <label className={labelClass}>Key (domain.action)</label>
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. pv.new_capability" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this lets someone do" className={inputClass} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!isValid || busy}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Create permission
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Role Editor ──────────────────────────────────────────────────────────────

function RoleEditorTab() {
  const [roles, setRoles] = useState<RoleWithPermissions[]>([])
  const [permissions, setPermissions] = useState<PermissionWithRoles[]>([])
  const [selectedKey, setSelectedKey] = useState('')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showCreateRole, setShowCreateRole] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [impact, setImpact] = useState<{ userCount: number; companyCount: number } | null>(null)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    setError(null)
    Promise.all([getRoleCatalog(), listPermissionsWithRoles()])
      .then(([roleRows, permRows]) => {
        setRoles(roleRows)
        setPermissions(permRows)
        setSelectedKey((prev) => prev || roleRows[0]?.key || '')
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load roles and permissions.')))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const selectedRole = roles.find((r) => r.key === selectedKey)

  useEffect(() => {
    if (selectedRole) setChecked(new Set(selectedRole.permissions.map((p) => p.key)))
  }, [selectedRole])

  const grouped = useMemo(() => groupByDomain(permissions), [permissions])

  const toggle = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const openConfirm = async () => {
    if (!selectedKey) return
    setError(null)
    try {
      const preview = await getRoleImpact(selectedKey)
      setImpact(preview)
      setConfirming(true)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not preview this change.'))
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await updateRolePermissions(selectedKey, Array.from(checked))
      setConfirming(false)
      setNotice(`Saved. ${impact ? `${impact.userCount} user(s) across ${impact.companyCount} compan${impact.companyCount === 1 ? 'y' : 'ies'} were signed out of their current session.` : ''}`)
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save this role.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <div className="rounded-lg border border-border bg-card overflow-hidden h-fit">
        <div className="flex items-center justify-between border-b border-border p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Roles</p>
          <button onClick={() => setShowCreateRole(true)} className="text-safemeds-teal hover:text-safemeds-spruce">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="divide-y divide-border">
          {roles.map((r) => (
            <button
              key={r.key}
              onClick={() => setSelectedKey(r.key)}
              className={`w-full px-3 py-2.5 text-left text-sm transition-colors ${selectedKey === r.key ? 'bg-safemeds-teal/10 text-safemeds-teal font-medium' : 'text-foreground hover:bg-muted'}`}
            >
              <div>{r.name}</div>
              <div className="text-[11px] text-muted-foreground">{r.isPlatform ? 'Platform' : 'Tenant'} · {r.permissions.length} permissions</div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
        {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

        {selectedRole && (
          <>
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="font-semibold text-foreground">{selectedRole.name}</h2>
              <p className="text-xs text-muted-foreground">{selectedRole.description}</p>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/5 p-3 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-warning" />
              This role carries no company — changing it affects every user holding it, at every tenant, immediately. Everyone currently
              holding it will need to re-authenticate on their next request.
            </div>

            <div className="space-y-3">
              {grouped.map(([domain, items]) => (
                <div key={domain} className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="border-b border-border bg-muted/30 px-4 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{domain}</p>
                  </div>
                  <div className="divide-y divide-border">
                    {items.map((p) => (
                      <label key={p.key} className="flex items-start gap-2.5 p-3 cursor-pointer hover:bg-muted/40">
                        <input
                          type="checkbox"
                          checked={checked.has(p.key)}
                          onChange={() => toggle(p.key)}
                          className="mt-0.5 h-4 w-4 rounded border-input"
                        />
                        <div>
                          <p className="font-mono text-xs text-foreground">{p.key}</p>
                          <p className="text-xs text-muted-foreground">{p.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pb-6">
              <button
                onClick={openConfirm}
                className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-5 py-2.5 text-sm font-medium text-white hover:bg-safemeds-spruce"
              >
                <Users className="h-4 w-4" /> Save Role Permissions
              </button>
            </div>
          </>
        )}
      </div>

      {confirming && impact && (
        <Modal title="Confirm Role Change" onClose={() => setConfirming(false)}>
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              This affects <strong>{impact.userCount}</strong> user{impact.userCount === 1 ? '' : 's'} across{' '}
              <strong>{impact.companyCount}</strong> {impact.companyCount === 1 ? 'company' : 'companies'} immediately — every one of them
              will be signed out of their current session on their next request and will see the updated permission set the moment they
              log back in.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirming(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm and Save
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showCreateRole && (
        <CreateRoleModal
          permissions={permissions}
          onClose={() => setShowCreateRole(false)}
          onCreated={(key) => {
            setShowCreateRole(false)
            setSelectedKey(key)
            setNotice('Role created.')
            load()
          }}
        />
      )}
    </div>
  )
}

function CreateRoleModal({
  permissions,
  onClose,
  onCreated,
}: {
  permissions: PermissionWithRoles[]
  onClose: () => void
  onCreated: (key: string) => void
}) {
  const [key, setKey] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPlatform, setIsPlatform] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const grouped = useMemo(() => groupByDomain(permissions), [permissions])
  const isValid = /^[A-Za-z][A-Za-z0-9_]*$/.test(key) && name.trim().length > 0 && description.trim().length > 0

  const toggle = (permKey: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(permKey)) next.delete(permKey)
      else next.add(permKey)
      return next
    })
  }

  const handleCreate = async () => {
    if (!isValid) return
    setBusy(true)
    setError(null)
    try {
      const input: CreateRoleInput = { key, name: name.trim(), description: description.trim(), isPlatform, permissions: Array.from(selected) }
      const created = await createRole(input)
      onCreated(created.key)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this role.'))
      setBusy(false)
    }
  }

  return (
    <Modal title="New Role" onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Key</label>
            <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. FPPV" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Focal Person for PV" className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={isPlatform} onChange={(e) => setIsPlatform(e.target.checked)} className="h-4 w-4 rounded border-input" />
          Platform role (SafeMeds staff, not a tenant role)
        </label>

        <div>
          <label className={labelClass}>Permissions</label>
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border p-2">
            {grouped.map(([domain, items]) => (
              <div key={domain}>
                <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{domain}</p>
                {items.map((p) => (
                  <label key={p.key} className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-muted">
                    <input type="checkbox" checked={selected.has(p.key)} onChange={() => toggle(p.key)} className="h-3.5 w-3.5 rounded border-input" />
                    <span className="font-mono">{p.key}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!isValid || busy}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Create role
          </button>
        </div>
      </div>
    </Modal>
  )
}
