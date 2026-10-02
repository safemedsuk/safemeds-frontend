'use client'

import { useCallback, useEffect, useState } from 'react'
import { GraduationCap, Loader2, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { listUsers, TenantUser } from '@/lib/api/users'
import {
  ComplianceStatus,
  ComplianceStatusRow,
  createCurriculum,
  getComplianceStatus,
  listCurriculum,
  removeCurriculum,
  RoleTrainingCurriculum,
} from '@/lib/api/training-compliance'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const ROLE_KEYS = [
  'SYSTEM_ADMINISTRATOR',
  'DISPENSING_PHARMACIST',
  'SUPERINTENDENT_PHARMACIST',
  'QPPV',
  'QUALITY_ASSOCIATE',
  'QUALITY_MANAGER',
  'REGULATORY_AFFAIRS_OFFICER',
  'EXECUTIVE_READONLY',
]

const STATUS_STYLES: Record<ComplianceStatus, string> = {
  valid: 'bg-status-success/10 text-status-success',
  expiring: 'bg-status-warning/10 text-status-warning',
  expired: 'bg-status-error/10 text-status-error',
  missing: 'bg-muted text-muted-foreground',
}

/**
 * QualCloud (Phase 13) Stage 12 — Training & Competency Management.
 * Two halves on one screen: the role × training-type curriculum
 * (admin-managed) and a per-user compliance lookup (computed live,
 * never stored — see `TrainingComplianceService.getComplianceStatus()`'s
 * own doc comment). Trains a user against `/training-records` directly
 * (the pre-existing Stage 16.6 screen) — this screen is where you see
 * whether that logging actually satisfies what their role requires.
 */
export function TrainingComplianceScreen() {
  const { has } = usePermissions()
  const canView = has('training.view')
  const canManage = has('training.manage')

  const [curricula, setCurricula] = useState<RoleTrainingCurriculum[]>([])
  const [users, setUsers] = useState<TenantUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [compliance, setCompliance] = useState<ComplianceStatusRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([listCurriculum(), listUsers({ page: 1, limit: 100 })])
      .then(([curriculumRes, userRes]) => {
        setCurricula(curriculumRes)
        setUsers(userRes.users)
        if (!selectedUserId && userRes.users.length > 0) setSelectedUserId(userRes.users[0].id)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load training curriculum.')))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(load, [load])

  useEffect(() => {
    if (!selectedUserId) return
    getComplianceStatus(selectedUserId)
      .then(setCompliance)
      .catch((err) => setError(getErrorMessage(err, 'Could not load compliance status.')))
  }, [selectedUserId])

  const handleRemove = (id: string) => {
    removeCurriculum(id)
      .then(() => {
        setNotice('Curriculum row removed.')
        load()
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not remove this curriculum row.')))
  }

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">Training Compliance</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to view training compliance.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Training Compliance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Which training is mandatory for which role, and whether each person&apos;s own logged training
          actually satisfies it.
        </p>
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-semibold text-foreground">Role Training Curriculum</h2>
          {canManage && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Curriculum Row
            </button>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : curricula.length === 0 ? (
            <div className="p-12 text-center">
              <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No curriculum rows defined yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="p-3">Role</th>
                  <th className="p-3">Training Type</th>
                  <th className="p-3">Mandatory</th>
                  <th className="p-3">Recertification</th>
                  <th className="p-3">New-SOP Rollout Trigger</th>
                  {canManage && <th className="p-3">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {curricula.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="p-3 text-foreground font-medium">{c.roleKey.replace(/_/g, ' ')}</td>
                    <td className="p-3 text-muted-foreground">{c.trainingType?.label ?? c.trainingTypeId}</td>
                    <td className="p-3 text-muted-foreground">{c.isMandatory ? 'Yes' : 'No'}</td>
                    <td className="p-3 text-muted-foreground">
                      {c.recertificationIntervalMonths ? `Every ${c.recertificationIntervalMonths} months` : '—'}
                    </td>
                    <td className="p-3 text-muted-foreground">{c.documentTypeTrigger ?? '—'}</td>
                    {canManage && (
                      <td className="p-3">
                        <button onClick={() => handleRemove(c.id)} className="text-status-error hover:underline">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-display font-semibold text-foreground">Compliance by Person</h2>
        <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className={`${inputClass} max-w-sm`}>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </select>

        {compliance && (
          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            {compliance.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No curriculum items apply to this person&apos;s current roles.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="p-3">Training Type</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Latest Completion</th>
                    <th className="p-3">Latest Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {compliance.map((row) => (
                    <tr key={row.curriculumId} className="border-b border-border last:border-0">
                      <td className="p-3 text-foreground font-medium">{row.trainingTypeLabel}</td>
                      <td className="p-3 text-muted-foreground">{row.roleKey.replace(/_/g, ' ')}</td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[row.status]}`}>{row.status}</span>
                      </td>
                      <td className="p-3 text-muted-foreground">{row.latestCompletionDate?.slice(0, 10) ?? '—'}</td>
                      <td className="p-3 text-muted-foreground">{row.latestExpiryDate?.slice(0, 10) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>

      {showCreate && (
        <CreateCurriculumModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            setNotice('Curriculum row added.')
            load()
          }}
        />
      )}
    </div>
  )
}

function CreateCurriculumModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [roleKey, setRoleKey] = useState(ROLE_KEYS[0])
  const [trainingTypeId, setTrainingTypeId] = useState('')
  const [isMandatory, setIsMandatory] = useState(true)
  const [recertificationIntervalMonths, setRecertificationIntervalMonths] = useState('')
  const [documentTypeTrigger, setDocumentTypeTrigger] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = roleKey.trim().length > 0 && trainingTypeId.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await createCurriculum({
        roleKey,
        trainingTypeId: trainingTypeId.trim(),
        isMandatory,
        recertificationIntervalMonths: recertificationIntervalMonths ? Number(recertificationIntervalMonths) : undefined,
        documentTypeTrigger: documentTypeTrigger.trim() || undefined,
      })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not add this curriculum row.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">Add Curriculum Row</h2>

        <div>
          <label className={labelClass}>Role *</label>
          <select value={roleKey} onChange={(e) => setRoleKey(e.target.value)} className={inputClass}>
            {ROLE_KEYS.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Training Type ID *</label>
          <input
            value={trainingTypeId}
            onChange={(e) => setTrainingTypeId(e.target.value)}
            placeholder="Pick from Training Types admin screen"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Find the training type&apos;s ID via the existing Training Types catalog.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={isMandatory} onChange={(e) => setIsMandatory(e.target.checked)} />
          Mandatory
        </label>
        <div>
          <label className={labelClass}>Recertification Interval (months)</label>
          <input
            type="number"
            min={1}
            value={recertificationIntervalMonths}
            onChange={(e) => setRecertificationIntervalMonths(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>New-SOP Rollout Trigger (document type)</label>
          <input
            value={documentTypeTrigger}
            onChange={(e) => setDocumentTypeTrigger(e.target.value)}
            placeholder="e.g. sop"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            When a controlled document of this type goes effective, every active user holding this role is
            automatically assigned to read and acknowledge it.
          </p>
        </div>

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
