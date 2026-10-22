'use client'

import { useEffect, useState } from 'react'
import { Plus, Lock, Upload, UserPlus, Loader2, History, UserX, KeyRound, Check, X, ShieldCheck, ShieldAlert } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import { Modal } from '@/components/ui/modal'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { DataTableV2, DataTableColumn } from '@/components/ui/data-table-v2'
import { BulkImportUsersModal } from '@/components/users/bulk-import-users-modal'
import { InviteUserModal } from '@/components/settings/invite-user-modal'
import { PendingInvitationsSection } from '@/components/settings/pending-invitations-section'
import { SecurityPolicyCard } from '@/components/settings/security-policy-card'
import { RecordHistory } from '@/components/audit/record-history'
import { LocationAccessSection } from '@/components/users/location-access-section'
import { PersonnelLicencesSection } from '@/components/users/personnel-licences-section'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { getErrorMessage } from '@/lib/api/client'
import { TenantUser, listUsers, updateUserRoles, deactivateUser, adminResetPassword } from '@/lib/api/users'
import { getRoleCatalog, RoleWithPermissions } from '@/lib/api/roles'
import { TENANT_ROLES, tenantRoleLabel } from '@/lib/tenant-roles'
import { type Country } from '@/lib/api/countries'
import { getCompanyMarkets, listFacilities, type Facility } from '@/lib/api/company'
import { useTranslation } from '@/lib/i18n/use-translation'

export function UsersRoles() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canView = has('users.view')
  const canInvite = has('users.invite')
  const canManageRoles = has('users.manage_roles')
  const canDeactivate = has('users.deactivate')
  const canResetPassword = has('users.reset_password')

  const [users, setUsers] = useState<TenantUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [bulkImportModalOpen, setBulkImportModalOpen] = useState(false)
  const [invitationsRefreshKey, setInvitationsRefreshKey] = useState(0)

  const [roleCatalog, setRoleCatalog] = useState<RoleWithPermissions[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])

  const [editingUser, setEditingUser] = useState<TenantUser | null>(null)
  const [draftRoles, setDraftRoles] = useState<string[]>([])
  const [draftIsExternal, setDraftIsExternal] = useState(false)
  const [historyUser, setHistoryUser] = useState<TenantUser | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)

  const loadUsers = () => {
    setLoading(true)
    setError(null)
    listUsers({ limit: 100 })
      .then(({ users: rows }) => setUsers(rows))
      .catch((err) => setError(getErrorMessage(err, t('users.list.loadUsersFailed'))))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!canView) return
    loadUsers()
    getRoleCatalog()
      .then((catalog) => setRoleCatalog(catalog.filter((r) => !r.isPlatform)))
      .catch(() => setRoleCatalog([]))
    // Special Corner Stage 0.8-A — scoped to the company's own activated
    // operating markets (CompanyMarket), not every seeded country in the
    // system. Every approved company always has at least its own home
    // country as a market (set automatically at approval time), so this
    // is never empty for a real tenant.
    getCompanyMarkets()
      .then((markets) => setCountries(markets.map((m) => m.country)))
      .catch(() => setCountries([]))
    listFacilities({ limit: 100 })
      .then((page) => setFacilities(page.rows))
      .catch(() => setFacilities([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- canView only ever flips on login/permission change, not worth re-running loadUsers for
  }, [canView])

  const startEditingRoles = (user: TenantUser) => {
    setEditingUser(user)
    setDraftRoles(user.roleKeys)
    setDraftIsExternal(user.isExternal)
    setActionError(null)
  }

  const toggleDraftRole = (key: string) => {
    setDraftRoles((prev) => (prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]))
  }

  const saveRoles = async () => {
    if (!editingUser) return
    setBusyUserId(editingUser.id)
    setActionError(null)
    try {
      const updated = await updateUserRoles(editingUser.id, draftRoles, draftIsExternal)
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
      setEditingUser(null)
    } catch (err) {
      setActionError(getErrorMessage(err, t('users.list.updateRolesFailed')))
    } finally {
      setBusyUserId(null)
    }
  }

  const handleDeactivate = async (user: TenantUser) => {
    if (!confirm(t('users.list.confirmDeactivate', { name: user.fullName }))) return
    setBusyUserId(user.id)
    setActionError(null)
    try {
      const updated = await deactivateUser(user.id)
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)))
    } catch (err) {
      setActionError(getErrorMessage(err, t('users.list.deactivateFailed')))
    } finally {
      setBusyUserId(null)
    }
  }

  const handleResetPassword = async (user: TenantUser) => {
    if (!confirm(t('users.list.confirmForceReset', { name: user.fullName }))) return
    setBusyUserId(user.id)
    setActionError(null)
    try {
      await adminResetPassword(user.id)
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, mustChangePassword: true } : u)))
    } catch (err) {
      setActionError(getErrorMessage(err, t('users.list.resetPasswordFailed')))
    } finally {
      setBusyUserId(null)
    }
  }

  const columns: DataTableColumn<TenantUser>[] = [
    {
      key: 'fullName',
      label: t('users.list.columnUser'),
      sortable: true,
      render: (_value, user) => (
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-medium text-foreground truncate">
            {user.fullName}
            {user.isExternal && (
              <span className="rounded-full bg-status-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-status-warning whitespace-nowrap" title={t('users.list.externalTooltip')}>
                {t('users.list.externalBadge')}
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
      ),
    },
    {
      key: 'roleKeys',
      label: t('users.list.columnRoles'),
      render: (_value, user) => (
        <div className="flex flex-wrap gap-1">
          {user.roleKeys.map((key) => (
            <span
              key={key}
              className="rounded-full bg-safemeds-teal/10 px-2 py-0.5 text-xs font-medium text-safemeds-teal whitespace-nowrap"
            >
              {tenantRoleLabel(key, t)}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'status',
      label: t('users.list.columnStatus'),
      sortable: true,
      render: (_value, user) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={user.status} />
          {user.mustChangePassword && (
            <span title={t('users.list.mustChangePasswordTooltip')} className="text-status-warning">
              <KeyRound className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: t('users.list.columnJoined'),
      sortable: true,
      render: (value) => <span className="text-muted-foreground">{new Date(value).toLocaleDateString()}</span>,
    },
    {
      key: 'id',
      label: t('users.list.columnActions'),
      align: 'right',
      render: (_value, user) => (
        <div className="flex justify-end gap-1">
          <button
            onClick={() => setHistoryUser(user)}
            title={t('users.list.viewHistoryTooltip')}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
          >
            <History className="h-4 w-4" />
          </button>
          {canManageRoles && (
            <button
              onClick={() => startEditingRoles(user)}
              title={t('users.list.editRolesTooltip')}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            >
              <ShieldCheck className="h-4 w-4" />
            </button>
          )}
          {canResetPassword && user.status === 'active' && (
            <button
              onClick={() => handleResetPassword(user)}
              disabled={busyUserId === user.id}
              title={t('users.list.forcePasswordResetTooltip')}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <KeyRound className="h-4 w-4" />
            </button>
          )}
          {canDeactivate && user.status === 'active' && (
            <button
              onClick={() => handleDeactivate(user)}
              disabled={busyUserId === user.id}
              title={t('users.list.deactivateTooltip')}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-status-error/10 hover:text-status-error transition-colors disabled:opacity-50"
            >
              <UserX className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ]

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">{t('users.list.title')}</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{t('users.list.noPermission')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">{t('users.list.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('users.list.subtitle')}</p>
        </div>
        {canInvite && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBulkImportModalOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-raised)] transition-colors"
            >
              <Upload className="h-4 w-4" />
              {t('users.list.bulkImport')}
            </button>
            <button
              onClick={() => setInviteModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t('users.list.addUser')}
            </button>
          </div>
        )}
      </div>

      {inviteModalOpen && (
        <InviteUserModal
          onClose={() => setInviteModalOpen(false)}
          onInvited={() => {
            setInvitationsRefreshKey((k) => k + 1)
            loadUsers()
          }}
        />
      )}

      {bulkImportModalOpen && (
        <BulkImportUsersModal
          onClose={() => setBulkImportModalOpen(false)}
          onImported={() => {
            setInvitationsRefreshKey((k) => k + 1)
            loadUsers()
          }}
        />
      )}

      {canInvite && (
        <CollapsibleSection title={t('users.list.pendingInvitations')} icon={<UserPlus className="h-4 w-4 text-muted-foreground" />}>
          <PendingInvitationsSection refreshKey={invitationsRefreshKey} />
        </CollapsibleSection>
      )}

      <CollapsibleSection title={t('users.list.securityPolicy')} icon={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}>
        <SecurityPolicyCard />
      </CollapsibleSection>

      <CollapsibleSection title={t('users.list.personnelLicences')} icon={<ShieldCheck className="h-4 w-4 text-muted-foreground" />} defaultOpen={false}>
        <PersonnelLicencesSection />
      </CollapsibleSection>

      {roleCatalog.length > 0 && (
        // role.name/description and permission.description are backend
        // reference content (the RBAC catalog), not frontend UI chrome —
        // deliberately out of scope for this pass, see todo-i18n.md's own
        // "What's explicitly NOT in this build" section.
        <CollapsibleSection title={t('users.list.permissionsByRole')} icon={<Lock className="h-4 w-4 text-muted-foreground" />}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roleCatalog.map((role) => (
              <div key={role.key} className="rounded-lg border border-border p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-1">{role.name}</h4>
                <p className="mb-2 text-xs text-muted-foreground">{role.description}</p>
                {role.permissions.length > 0 ? (
                  <ul className="space-y-1">
                    {role.permissions.map((permission) => (
                      <li key={permission.key} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="mt-1 h-1 w-1 rounded-full bg-safemeds-teal flex-shrink-0"></span>
                        <span>{permission.description}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground italic">{t('users.list.noPermissionsAssigned')}</p>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {actionError && (
        <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">
          {actionError}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('users.list.loadingUsers')}
        </div>
      )}

      {error && <p className="text-sm text-status-error">{error}</p>}

      {!loading && !error && (
        <DataTableV2
          data={users}
          columns={columns}
          title={t('users.list.teamTableTitle', { count: users.length })}
          exportable={false}
          showDensityToggle={false}
          rowsPerPage={10}
        />
      )}

      {editingUser && (
        <Modal title={t('users.list.editRolesModalTitle', { name: editingUser.fullName })} onClose={() => setEditingUser(null)}>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {TENANT_ROLES.map((role) => (
                <label
                  key={role.key}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs cursor-pointer hover:bg-[var(--surface-raised)]"
                >
                  <input
                    type="checkbox"
                    checked={draftRoles.includes(role.key)}
                    onChange={() => toggleDraftRole(role.key)}
                    className="h-3.5 w-3.5"
                  />
                  {tenantRoleLabel(role.key, t)}
                </label>
              ))}
            </div>
            <label className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs cursor-pointer hover:bg-[var(--surface-raised)] w-fit">
              <input type="checkbox" checked={draftIsExternal} onChange={(e) => setDraftIsExternal(e.target.checked)} className="h-3.5 w-3.5" />
              {t('users.list.externalConsultant')}
            </label>
            <div className="flex gap-2 pt-2">
              <button
                onClick={saveRoles}
                disabled={busyUserId === editingUser.id || draftRoles.length === 0}
                className="flex items-center gap-1 rounded-lg bg-safemeds-teal px-3 py-2 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
              >
                {busyUserId === editingUser.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {t('users.list.save')}
              </button>
              <button
                onClick={() => setEditingUser(null)}
                className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-raised)]"
              >
                <X className="h-3.5 w-3.5" />
                {t('common.cancel')}
              </button>
            </div>

            <LocationAccessSection userId={editingUser.id} countries={countries} facilities={facilities} />
          </div>
        </Modal>
      )}

      {historyUser && (
        <Modal title={t('users.list.activityHistoryModalTitle', { name: historyUser.fullName })} onClose={() => setHistoryUser(null)} maxWidth="max-w-2xl">
          <RecordHistory recordType="app_user" recordId={historyUser.id} />
        </Modal>
      )}
    </div>
  )
}
