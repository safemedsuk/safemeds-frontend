'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, Loader2, ShieldAlert, Upload, UserCog } from 'lucide-react'
import { getDownloadUrl, listDocuments, uploadDocument, type DocumentVersion } from '@/lib/api/documents'
import { getErrorMessage } from '@/lib/api/client'
import { getQppvStatus, QppvNomination, QppvNominationRole, QppvStatus, setQppvNomination, uploadQppvRegulatorConfirmation } from '@/lib/api/qppv-nomination'
import { listUsers, TenantUser } from '@/lib/api/users'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { DocumentPreviewModal } from '@/components/ui/document-preview-modal'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

async function findLatestVersion(recordType: string, recordId: string, documentId: string): Promise<DocumentVersion | null> {
  const versions = await listDocuments(recordType, recordId)
  const doc = versions.find((d) => d.id === documentId)
  return doc?.versions[0] ?? null
}

/**
 * VigiCloud Stage 16.4 — primary + backup QPPV assignment, the
 * generated nomination-letter download, and the regulator-confirmation
 * upload slot. A backup QPPV is legally mandatory per GUD/006 §3, so
 * the backup card is never visually de-emphasized relative to primary.
 */
export function QppvScreen() {
  const { has, hasAny } = usePermissions()
  const canManage = has('qppv.manage_nomination')
  const canView = hasAny('qppv.manage_nomination', 'governance.view')

  const [status, setStatus] = useState<QppvStatus | null>(null)
  const [users, setUsers] = useState<TenantUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [nominatingRole, setNominatingRole] = useState<QppvNominationRole | null>(null)
  const [previewing, setPreviewing] = useState<{ documentId: string; version: DocumentVersion } | null>(null)

  const openDocument = async (recordType: string, recordId: string, documentId: string) => {
    const version = await findLatestVersion(recordType, recordId, documentId)
    if (version) setPreviewing({ documentId, version })
  }

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([getQppvStatus(), listUsers({ role: 'QPPV', limit: 100 })])
      .then(([s, u]) => {
        setStatus(s)
        setUsers(u.users)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load QPPV status.')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!canView) return
    load()
  }, [load, canView])

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">QPPV</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to view QPPV records. Contact your System Administrator.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const nominationFor = (role: QppvNominationRole): QppvNomination | undefined => status?.nominations.find((n) => n.role === role && n.status === 'active')

  return (
    <div className="space-y-6 p-6">
      <div>
        <div className="flex items-center gap-3">
          <UserCog className="h-6 w-6 text-safemeds-teal" />
          <h1 className="text-3xl font-display font-bold text-foreground">QPPV</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Qualified Person for Pharmacovigilance — a backup is legally required, not optional (GUD/006 §3).</p>
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <QppvCard
          role="primary"
          userId={status?.primaryQppvUserId ?? null}
          nomination={nominationFor('primary')}
          users={users}
          canManage={canManage}
          onNominate={() => setNominatingRole('primary')}
          onOpenDocument={openDocument}
          onConfirmed={() => {
            setNotice('Regulator confirmation uploaded.')
            load()
          }}
        />
        <QppvCard
          role="backup"
          userId={status?.backupQppvUserId ?? null}
          nomination={nominationFor('backup')}
          users={users}
          canManage={canManage}
          onNominate={() => setNominatingRole('backup')}
          onOpenDocument={openDocument}
          onConfirmed={() => {
            setNotice('Regulator confirmation uploaded.')
            load()
          }}
        />
      </div>

      {!status?.backupQppvUserId && (
        <div className="rounded-lg border border-status-warning bg-status-warning/10 p-4 text-sm text-status-warning flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
          No backup QPPV nominated yet — required under GUD/006 §3, not optional.
        </div>
      )}

      {nominatingRole && (
        <NominateModal
          role={nominatingRole}
          users={users}
          onClose={() => setNominatingRole(null)}
          onNominated={() => {
            setNominatingRole(null)
            setNotice('Nomination letter generated.')
            load()
          }}
        />
      )}

      {previewing && (
        <DocumentPreviewModal
          title={previewing.version.filename}
          filename={previewing.version.filename}
          contentType={previewing.version.contentType}
          getUrl={() => getDownloadUrl(previewing.documentId, previewing.version.id)}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  )
}

function QppvCard({
  role,
  userId,
  nomination,
  users,
  canManage,
  onNominate,
  onOpenDocument,
  onConfirmed,
}: {
  role: QppvNominationRole
  userId: string | null
  nomination: QppvNomination | undefined
  users: TenantUser[]
  canManage: boolean
  onNominate: () => void
  onOpenDocument: (recordType: string, recordId: string, documentId: string) => void
  onConfirmed: () => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const user = users.find((u) => u.id === userId)

  const handleUploadConfirmation = async (file: File) => {
    if (!nomination) return
    setUploading(true)
    setError(null)
    try {
      const version = await uploadDocument('qppv_nomination', nomination.id, file, { title: 'Regulator confirmation' })
      await uploadQppvRegulatorConfirmation(nomination.id, version.documentId)
      onConfirmed()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not upload this confirmation.'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{role === 'primary' ? 'Primary QPPV' : 'Backup QPPV'}</h2>
        {canManage && (
          <button onClick={onNominate} className="text-xs font-medium text-safemeds-teal hover:underline">
            {userId ? 'Change' : 'Nominate'}
          </button>
        )}
      </div>

      {!userId ? (
        <p className="text-sm text-muted-foreground">Not nominated yet.</p>
      ) : (
        <>
          <p className="text-sm text-foreground font-medium">{user?.fullName ?? userId}</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>

          {nomination?.nominationLetterDocumentId && (
            <button
              onClick={() => onOpenDocument('qppv_nomination', nomination.id, nomination.nominationLetterDocumentId!)}
              className="flex items-center gap-1.5 text-xs font-medium text-safemeds-teal hover:underline"
            >
              <Download className="h-3.5 w-3.5" /> Download Nomination Letter
            </button>
          )}

          <div className="pt-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground mb-1">Regulator Confirmation</p>
            {nomination?.regulatorConfirmationDocumentId ? (
              <button
                onClick={() => onOpenDocument('qppv_nomination', nomination.id, nomination.regulatorConfirmationDocumentId!)}
                className="flex items-center gap-1.5 text-xs font-medium text-status-success hover:underline"
              >
                <Download className="h-3.5 w-3.5" /> View Confirmation
              </button>
            ) : canManage ? (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Upload confirmation
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUploadConfirmation(file)
                  }}
                />
              </label>
            ) : (
              <p className="text-xs text-muted-foreground">Not yet uploaded.</p>
            )}
          </div>
        </>
      )}

      {error && <p className="text-xs text-status-error">{error}</p>}
    </div>
  )
}

function NominateModal({ role, users, onClose, onNominated }: { role: QppvNominationRole; users: TenantUser[]; onClose: () => void; onNominated: () => void }) {
  const [userId, setUserId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = userId.length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await setQppvNomination(role, userId)
      onNominated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not set this nomination.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-foreground">Nominate {role === 'primary' ? 'Primary' : 'Backup'} QPPV</h2>

        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users hold the QPPV role yet — grant it via Users & Roles first.</p>
        ) : (
          <div>
            <label className={labelClass}>User (must hold the QPPV role) *</label>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className={inputClass}>
              <option value="">Select…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.email})
                </option>
              ))}
            </select>
          </div>
        )}

        <p className="text-xs text-muted-foreground">A real nomination letter PDF is generated automatically. SafeMeds does not submit this or verify the regulator&apos;s acceptance.</p>

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
            Nominate
          </button>
        </div>
      </div>
    </div>
  )
}
