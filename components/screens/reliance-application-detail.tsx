'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, FileCheck2, Globe2, Loader2, Lock, Plus, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  getRelianceApplication,
  addParticipatingAuthority,
  startAuthorityDossier,
  closeRelianceApplication,
  PATHWAY_TYPE_LABELS,
  type RelianceApplicationDetail as RelianceApplicationDetailData,
} from '@/lib/api/reliance-applications'
import { listRegulatoryAuthorities, type RegulatoryAuthority } from '@/lib/api/regulatory-authorities'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { Modal } from '@/components/ui/modal'
import { ProductClassPicker } from '@/components/regulatory/product-class-picker'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-status-info/10 text-status-info',
  closed: 'bg-muted text-muted-foreground',
}

function dossierStatusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * RegCloud (Phase 12) Stage 16 — Reliance Pathways. No `WorkflowActionsPanel`
 * here — `RelianceApplication` carries no workflow instance of its own
 * (see the backend model's own doc comment); real lifecycle progress
 * happens per-authority, at each linked dossier's own already-built
 * detail page (real click-through, never a duplicated view).
 */
export function RelianceApplicationDetail({ applicationId }: { applicationId: string }) {
  const router = useRouter()
  const { has } = usePermissions()
  const canManage = has('regulatory.manage_dossier')

  const [application, setApplication] = useState<RelianceApplicationDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()

  const [allAuthorities, setAllAuthorities] = useState<RegulatoryAuthority[]>([])
  const [showAddAuthority, setShowAddAuthority] = useState(false)
  const [startingDossierFor, setStartingDossierFor] = useState<{ authorityId: string; authorityName: string } | null>(null)
  const [closing, setClosing] = useState(false)

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      setError(null)
      try {
        setApplication(await getRelianceApplication(applicationId))
      } catch (err) {
        setError(getErrorMessage(err, 'Could not load this reliance application.'))
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [applicationId],
  )

  const refresh = useCallback(() => load(true), [load])

  useEffect(() => {
    load()
    listRegulatoryAuthorities()
      .then(setAllAuthorities)
      .catch(() => setAllAuthorities([]))
  }, [load])

  const handleClose = async () => {
    if (!window.confirm('Close this reliance application? Its linked dossiers are unaffected and keep their own real status.')) return
    setClosing(true)
    setError(null)
    try {
      await closeRelianceApplication(applicationId)
      await refresh()
      setNotice('Reliance application closed.')
    } catch (err) {
      setError(getErrorMessage(err, 'Could not close this application.'))
    } finally {
      setClosing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !application) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error ?? 'Reliance application not found.'}</div>
      </div>
    )
  }

  const linkableAuthorities = allAuthorities.filter(
    (a) => a.id !== application.leadAuthorityId && !application.participatingAuthorityIds.includes(a.id),
  )

  return (
    <div className="space-y-6 p-6">
      <button onClick={() => router.push('/master-data')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Master Data
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <Globe2 className="h-6 w-6 text-safemeds-teal" />
            <h1 className="text-2xl font-display font-bold text-foreground">{application.product.brandName}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{PATHWAY_TYPE_LABELS[application.pathwayType] ?? application.pathwayType}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap ${STATUS_STYLES[application.status] ?? 'bg-muted text-muted-foreground'}`}>
          {application.status}
        </span>
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}

      {canManage && application.status === 'active' && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Closing this application only marks it closed — every linked dossier keeps progressing independently.</p>
          <button
            onClick={handleClose}
            disabled={closing}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {closing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
            Close Application
          </button>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Participating Authorities</h2>
            <p className="text-xs text-muted-foreground">One real, independent dossier per authority — each flows through its own full submission process.</p>
          </div>
          {canManage && application.status === 'active' && (
            <button
              onClick={() => setShowAddAuthority(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" /> Add Authority
            </button>
          )}
        </div>

        <ul className="space-y-2">
          {application.authorityStatuses.map((s) => (
            <li key={s.authorityId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-foreground">
                  {s.authorityName} ({s.authorityCode})
                </span>
                {s.isLead && <span className="rounded-full bg-safemeds-teal/10 px-2 py-0.5 text-[10px] font-medium text-safemeds-teal">Lead</span>}
              </div>
              {s.dossier ? (
                <button
                  onClick={() => router.push(`/reg-dossiers/${s.dossier!.id}`)}
                  className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground hover:bg-muted/70"
                >
                  <FileCheck2 className="h-3.5 w-3.5" />
                  {dossierStatusLabel(s.dossier.status)}
                </button>
              ) : canManage && application.status === 'active' ? (
                <button
                  onClick={() => setStartingDossierFor({ authorityId: s.authorityId, authorityName: s.authorityName })}
                  className="text-xs font-medium text-safemeds-teal hover:underline"
                >
                  Start Dossier
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">Not started</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {showAddAuthority && (
        <AddAuthorityModal
          authorities={linkableAuthorities}
          onClose={() => setShowAddAuthority(false)}
          onAdded={async (authorityId) => {
            setError(null)
            try {
              await addParticipatingAuthority(applicationId, authorityId)
              setShowAddAuthority(false)
              setNotice('Authority added.')
              await refresh()
            } catch (err) {
              setError(getErrorMessage(err, 'Could not add this authority.'))
            }
          }}
        />
      )}

      {startingDossierFor && (
        <StartDossierModal
          authorityId={startingDossierFor.authorityId}
          authorityName={startingDossierFor.authorityName}
          onClose={() => setStartingDossierFor(null)}
          onStart={async (productClass, route) => {
            setError(null)
            try {
              const dossier = await startAuthorityDossier(applicationId, { authorityId: startingDossierFor.authorityId, productClass, route })
              setStartingDossierFor(null)
              router.push(`/reg-dossiers/${dossier.id}`)
            } catch (err) {
              setError(getErrorMessage(err, 'Could not start this dossier.'))
            }
          }}
        />
      )}
    </div>
  )
}

function AddAuthorityModal({ authorities, onClose, onAdded }: { authorities: RegulatoryAuthority[]; onClose: () => void; onAdded: (authorityId: string) => void }) {
  const [authorityId, setAuthorityId] = useState(authorities[0]?.id ?? '')

  if (authorities.length === 0) {
    return (
      <Modal title="Add a Participating Authority" onClose={onClose}>
        <div className="flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/5 p-3 text-sm text-foreground">
          <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5 text-status-warning" />
          Every configured authority is already part of this application.
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Add a Participating Authority" onClose={onClose}>
      <div className="space-y-3">
        <select value={authorityId} onChange={(e) => setAuthorityId(e.target.value)} className={inputClass}>
          {authorities.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.code})
            </option>
          ))}
        </select>
        <button
          onClick={() => onAdded(authorityId)}
          disabled={!authorityId}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Add
        </button>
      </div>
    </Modal>
  )
}

function StartDossierModal({
  authorityId,
  authorityName,
  onClose,
  onStart,
}: {
  authorityId: string
  authorityName: string
  onClose: () => void
  onStart: (productClass: string, route?: string) => void
}) {
  const [productClass, setProductClass] = useState('')
  const [route, setRoute] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = () => {
    if (!productClass.trim()) return
    setSubmitting(true)
    onStart(productClass.trim(), route.trim() || undefined)
  }

  return (
    <Modal title={`Start Dossier — ${authorityName}`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">Product class</label>
          <ProductClassPicker authorityId={authorityId} value={productClass} onChange={setProductClass} className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">Route of administration (optional)</label>
          <input value={route} onChange={(e) => setRoute(e.target.value)} className={inputClass} />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!productClass.trim() || submitting}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Start dossier
        </button>
      </div>
    </Modal>
  )
}
