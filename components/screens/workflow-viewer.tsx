'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Plus, ShieldCheck } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import {
  AvailableTransition,
  WorkflowInstanceDetail,
  getAvailableTransitions,
  getWorkflowInstance,
  instantiateWorkflow,
  postTransition,
} from '@/lib/api/workflow'
import { getSignaturesForRecord, SignatureEvent } from '@/lib/api/signatures'
import { SignatureModal } from '@/components/ui/signature-modal'
import { WorkflowStepper } from '@/components/ui/workflow-stepper'

const RECORD_TYPE = 'pv_case'
const RECENT_INSTANCES_KEY = 'safemeds:workflow-viewer:recent-instance-ids'

function loadRecentInstanceIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(window.sessionStorage.getItem(RECENT_INSTANCES_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function saveRecentInstanceIds(ids: string[]): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(RECENT_INSTANCES_KEY, JSON.stringify(ids))
}

/**
 * There is no real case-creation flow yet in this codebase — VigiCloud
 * (the module that would create real `pv_case` records) is Phase 11, not
 * built. This screen therefore lets you spin up a demo `WorkflowInstance`
 * directly against the seeded PV case workflow (Phase 5.1), so the
 * workflow engine + signature engine (Phase 6) can be exercised end-to-end
 * for real — genuine state transitions, genuine role enforcement, and a
 * genuine re-auth-then-sign flow on the QPPV approval step — rather than
 * sitting unreachable behind a module that doesn't exist yet.
 */
export function WorkflowViewer() {
  const [instanceIds, setInstanceIds] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [instance, setInstance] = useState<WorkflowInstanceDetail | null>(null)
  const [transitions, setTransitions] = useState<AvailableTransition[]>([])
  const [signatures, setSignatures] = useState<SignatureEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [busy, setBusy] = useState(false)
  const [pendingSignatureTransition, setPendingSignatureTransition] = useState<AvailableTransition | null>(null)

  useEffect(() => {
    const ids = loadRecentInstanceIds()
    setInstanceIds(ids)
    if (ids.length > 0) setSelectedId(ids[0])
  }, [])

  const loadInstance = (id: string) => {
    if (!id) return
    setLoading(true)
    setError(null)
    Promise.all([getWorkflowInstance(id), getAvailableTransitions(id)])
      .then(async ([inst, avail]) => {
        setInstance(inst)
        setTransitions(avail)
        // Signatures are keyed by (recordType, recordId) — the workflow
        // instance's own recordId, not the instance's own id.
        setSignatures(await getSignaturesForRecord(RECORD_TYPE, inst.recordId))
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load this workflow instance.')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (selectedId) loadInstance(selectedId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const handleCreateDemo = async () => {
    setBusy(true)
    setError(null)
    try {
      const recordId = crypto.randomUUID()
      const created = await instantiateWorkflow(RECORD_TYPE, recordId)
      const nextIds = [created.id, ...instanceIds].slice(0, 10)
      setInstanceIds(nextIds)
      saveRecentInstanceIds(nextIds)
      setSelectedId(created.id)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create a demo case.'))
    } finally {
      setBusy(false)
    }
  }

  const runTransition = async (toStateKey: string, signature?: { signatureToken: string; intentStatement: string }) => {
    if (!instance) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await postTransition(instance.id, toStateKey, signature)
      setNotice(`Moved to "${toStateKey.replace(/_/g, ' ')}".`)
      loadInstance(instance.id)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not perform this transition.'))
    } finally {
      setBusy(false)
    }
  }

  const handleTransitionClick = (transition: AvailableTransition) => {
    if (!transition.allowed || busy) return
    if (transition.requiresSignature) {
      setPendingSignatureTransition(transition)
      return
    }
    void runTransition(transition.toStateKey)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Workflow Viewer</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The PV case lifecycle (Phase 5 — Intake through Submitted), wired to the real workflow engine
          </p>
        </div>
        <button
          onClick={handleCreateDemo}
          disabled={busy}
          className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> New demo case
        </button>
      </div>

      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error}</div>}
      {notice && (
        <div className="rounded-lg border border-status-success/30 bg-status-success/10 p-3 text-sm text-status-success flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> {notice}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
            Recent Demo Cases
          </label>
          {instanceIds.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/50">
              No demo cases yet — create one to walk the workflow.
            </p>
          ) : (
            <div className="space-y-2">
              {instanceIds.map((id) => (
                <button
                  key={id}
                  onClick={() => setSelectedId(id)}
                  className={`w-full rounded-lg px-4 py-3 text-left transition-colors ${
                    selectedId === id
                      ? 'bg-safemeds-teal/10 border border-safemeds-teal text-safemeds-teal'
                      : 'border border-border text-foreground hover:bg-muted'
                  }`}
                >
                  <p className="font-mono text-xs truncate">{id}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          )}

          {!loading && instance && (
            <>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-bold text-lg text-foreground">{instance.definition.recordType}</h2>
                  <span className="text-xs font-medium bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full">
                    v{instance.definition.version}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Current state: <span className="font-medium text-foreground">{instance.currentState.name}</span>
                </p>
              </div>

              <WorkflowStepper
                states={instance.definition.states}
                currentStateId={instance.currentStateId}
                availableTransitions={transitions}
                onTransitionClick={handleTransitionClick}
                busy={busy}
              />

              <div className="space-y-2">
                <h3 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" /> Signatures
                </h3>
                {signatures.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No signatures recorded for this case yet.</p>
                ) : (
                  <div className="space-y-2">
                    {signatures.map((sig) => (
                      <div key={sig.id} className="rounded-lg border border-border bg-card p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">{sig.roleAtSigning}</span>
                          <span className="text-muted-foreground">{new Date(sig.signedAt).toLocaleString()}</span>
                        </div>
                        <p className="text-muted-foreground mt-1">{sig.intentStatement}</p>
                        <p className="font-mono text-[10px] text-muted-foreground/70 mt-1 truncate">{sig.recordHashSha256}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {!loading && !instance && (
            <div className="rounded-lg border border-border bg-card/50 p-12 text-center">
              <p className="text-sm text-muted-foreground">Select or create a demo case to view its workflow.</p>
            </div>
          )}
        </div>
      </div>

      {pendingSignatureTransition && (
        <SignatureModal
          isOpen
          onClose={() => setPendingSignatureTransition(null)}
          documentTitle={`Approve transition to "${pendingSignatureTransition.toStateName}"`}
          documentId={instance?.id ?? ''}
          onSigned={async ({ intentStatement, signatureToken }) => {
            const transition = pendingSignatureTransition
            setPendingSignatureTransition(null)
            if (transition) {
              await runTransition(transition.toStateKey, { signatureToken, intentStatement })
            }
          }}
        />
      )}
    </div>
  )
}
