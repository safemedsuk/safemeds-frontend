'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'
import { getErrorMessage } from '@/lib/api/client'
import { listUsers, type TenantUser } from '@/lib/api/users'
import {
  listPersonnelLicences,
  createPersonnelLicence,
  updatePersonnelLicence,
  type PersonnelLicence,
} from '@/lib/api/personnel-licences'
import { usePermissions } from '@/lib/hooks/use-permissions'

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-[var(--ok-bg)] text-[var(--ok)]',
  expired: 'bg-status-error/10 text-status-error',
  suspended: 'bg-status-warning/10 text-status-warning',
  revoked: 'bg-status-error/10 text-status-error',
}

/**
 * RegCloud (Phase 12) Stage 10 — Personnel Licensing. Embedded as a
 * section on the existing Users & Roles screen per the build spec's own
 * "not a new top-level nav section" instruction — a licence is a
 * regulatory fact about a staff member already listed there.
 */
export function PersonnelLicencesSection() {
  const { has } = usePermissions()
  const canManage = has('regulatory.manage_licensing')

  const [licences, setLicences] = useState<PersonnelLicence[]>([])
  const [users, setUsers] = useState<TenantUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<PersonnelLicence | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([listPersonnelLicences({ limit: 100 }), listUsers({ limit: 100 })])
      .then(([licencePage, usersPage]) => {
        setLicences(licencePage.rows)
        setUsers(usersPage.users)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load personnel licences.')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const userName = (userId: string) => users.find((u) => u.id === userId)?.fullName ?? userId

  const columns: DataTableColumn<PersonnelLicence>[] = [
    { key: 'userId', label: 'Staff member', render: (v) => userName(v as string) },
    { key: 'licenceType', label: 'Licence type', render: (v) => (v as string).replace(/_/g, ' ') },
    { key: 'licenceNumber', label: 'Licence number' },
    { key: 'issuedOn', label: 'Issued', render: (v) => new Date(v as string).toLocaleDateString() },
    { key: 'expiresOn', label: 'Expires', render: (v) => (v ? new Date(v as string).toLocaleDateString() : '—') },
    {
      key: 'status',
      label: 'Status',
      render: (v) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide ${STATUS_STYLES[v as string] ?? 'bg-[var(--surface-raised)] text-[var(--text-muted)]'}`}>
          {v as string}
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            key: 'id' as keyof PersonnelLicence,
            label: 'Actions',
            render: (_v: unknown, row: PersonnelLicence) => (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setEditing(row)
                }}
                className="text-xs font-medium text-[var(--primary)] hover:underline"
              >
                Manage
              </button>
            ),
          },
        ]
      : []),
  ]

  return (
    <div>
      {error && <div className="mb-3 p-3 rounded-lg bg-status-error/10 border border-status-error text-status-error text-sm">{error}</div>}
      <div className="flex justify-end mb-3">
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-xs font-medium"
          >
            <Plus className="h-3.5 w-3.5" /> Record Licence
          </button>
        )}
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-8 text-[var(--text-muted)]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <DataTableV2 data={licences} columns={columns} searchable={false} />
      )}

      {showCreate && (
        <Modal title="Record a personnel licence" onClose={() => setShowCreate(false)}>
          <PersonnelLicenceForm
            users={users}
            onSaved={() => {
              setShowCreate(false)
              load()
            }}
            onError={setError}
          />
        </Modal>
      )}

      {editing && (
        <Modal title={`Licence — ${userName(editing.userId)}`} onClose={() => setEditing(null)}>
          <PersonnelLicenceEditForm
            licence={editing}
            onSaved={() => {
              setEditing(null)
              load()
            }}
            onError={setError}
          />
        </Modal>
      )}
    </div>
  )
}

function PersonnelLicenceForm({ users, onSaved, onError }: { users: TenantUser[]; onSaved: () => void; onError: (msg: string) => void }) {
  const [userId, setUserId] = useState(users[0]?.id ?? '')
  const [licenceType, setLicenceType] = useState('pharmacist')
  const [licenceNumber, setLicenceNumber] = useState('')
  const [issuedOn, setIssuedOn] = useState(new Date().toISOString().slice(0, 10))
  const [expiresOn, setExpiresOn] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!userId || !licenceNumber.trim()) return
    setSaving(true)
    try {
      await createPersonnelLicence({ userId, licenceType, licenceNumber: licenceNumber.trim(), issuedOn, expiresOn: expiresOn || undefined })
      onSaved()
    } catch (err) {
      onError(getErrorMessage(err, 'Could not record this licence.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Staff member</label>
        <select value={userId} onChange={(e) => setUserId(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm">
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName} ({u.email})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Licence type</label>
        <select value={licenceType} onChange={(e) => setLicenceType(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm">
          <option value="pharmacist">Pharmacist</option>
          <option value="superintendent_pharmacist">Superintendent Pharmacist</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Licence number</label>
        <input
          value={licenceNumber}
          onChange={(e) => setLicenceNumber(e.target.value)}
          placeholder="e.g. PH-2026-0099"
          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Issued on</label>
          <input type="date" value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Expires on (optional)</label>
          <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm" />
        </div>
      </div>
      <div className="flex justify-end">
        <button
          disabled={!userId || !licenceNumber.trim() || saving}
          onClick={handleSubmit}
          className="px-3 py-2 rounded-lg bg-[var(--primary)] text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Record licence
        </button>
      </div>
    </div>
  )
}

function PersonnelLicenceEditForm({ licence, onSaved, onError }: { licence: PersonnelLicence; onSaved: () => void; onError: (msg: string) => void }) {
  const [expiresOn, setExpiresOn] = useState(licence.expiresOn?.slice(0, 10) ?? '')
  const [status, setStatus] = useState(licence.status)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    setSaving(true)
    try {
      await updatePersonnelLicence(licence.id, { expiresOn: expiresOn || undefined, status })
      onSaved()
    } catch (err) {
      onError(getErrorMessage(err, 'Could not update this licence.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Expires on</label>
        <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm">
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="suspended">Suspended</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>
      <div className="flex justify-end">
        <button disabled={saving} onClick={handleSubmit} className="px-3 py-2 rounded-lg bg-[var(--primary)] text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save
        </button>
      </div>
    </div>
  )
}
