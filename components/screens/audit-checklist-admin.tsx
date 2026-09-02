'use client'

import { useEffect, useState } from 'react'
import { ClipboardList, Info, Loader2, Pencil, Plus, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  RequirementDefinition,
  createRequirementDefinition,
  listRequirementDefinitions,
  updateRequirementDefinition,
} from '@/lib/api/governance'
import { RegulatoryAuthority, listRegulatoryAuthorities } from '@/lib/api/regulatory-authorities'
import { Modal } from '@/components/ui/modal'
import { usePermissions } from '@/lib/hooks/use-permissions'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const SOURCE_LABELS: Record<RequirementDefinition['source'], string> = {
  system_generated: 'Live (system-computed)',
  person_uploads: 'Manual (human-uploaded evidence)',
}

/**
 * Admin Configuration Console — Gap 3. Edits the shared 15-row PPB
 * inspection-requirement catalog's own descriptive content (title,
 * description, guideline citation, evidence type, mandatory flag,
 * sort order, active/inactive) — never the live ready/missing
 * computation, which stays code (`AuditReadinessService`'s own
 * per-`requirementKey` resolver map). A `system_generated` row's
 * `source` can never be changed here on purpose; only a genuinely new
 * `person_uploads` row can be added, since that source type has no
 * resolver dependency.
 */
export function AuditChecklistAdmin() {
  const { has } = usePermissions()
  const canManage = has('platform.config.manage')

  const [authorities, setAuthorities] = useState<RegulatoryAuthority[]>([])
  const [authorityId, setAuthorityId] = useState('')
  const [definitions, setDefinitions] = useState<RequirementDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<RequirementDefinition | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    if (!canManage) return
    listRegulatoryAuthorities()
      .then((rows) => {
        setAuthorities(rows)
        setAuthorityId(rows[0]?.id ?? '')
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load regulatory authorities.')))
  }, [canManage])

  const load = (id: string) => {
    if (!id) return
    setLoading(true)
    setError(null)
    listRequirementDefinitions(id)
      .then((rows) => setDefinitions(rows.slice().sort((a, b) => a.sortOrder - b.sortOrder)))
      .catch((err) => setError(getErrorMessage(err, 'Could not load requirement definitions.')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(authorityId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorityId])

  if (!canManage) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">Audit Checklist</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to manage the audit-readiness checklist.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <ClipboardList className="h-6 w-6 text-safemeds-teal" />
            <h1 className="text-3xl font-display font-bold text-foreground">Audit Checklist</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">The PPB inspection-requirement catalog every tenant&apos;s Audit Readiness dashboard is built from.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          disabled={!authorityId}
          className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add Requirement
        </button>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 p-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-info" />
        <p>
          <strong className="text-foreground">What this is:</strong> every tenant&apos;s Audit Readiness dashboard reads its 15 rows from
          this catalog. Editing a row here changes what every company under this authority sees — you can rewrite the title, description,
          and guideline citation, and add genuinely new manual (&quot;person_uploads&quot;) rows. You <strong>cannot</strong> change how a{' '}
          <em>live</em> row&apos;s status is computed here — that&apos;s real code, not configuration, and stays that way on purpose.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <label className={labelClass}>Regulatory authority</label>
        <select value={authorityId} onChange={(e) => setAuthorityId(e.target.value)} className={`${inputClass} max-w-sm`}>
          {authorities.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.code})
            </option>
          ))}
        </select>
      </div>

      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : definitions.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No requirement definitions exist for this authority yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">#</th>
                <th className="p-3">Title</th>
                <th className="p-3">Guideline Reference</th>
                <th className="p-3">Source</th>
                <th className="p-3">Mandatory</th>
                <th className="p-3">Active</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {definitions.map((d) => (
                <tr key={d.id} className={`border-b border-border last:border-0 ${!d.active ? 'opacity-50' : ''}`}>
                  <td className="p-3 text-muted-foreground">{d.sortOrder}</td>
                  <td className="p-3 text-foreground max-w-xs">
                    <p className="font-medium">{d.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{d.description}</p>
                  </td>
                  <td className="p-3 text-muted-foreground italic">{d.guidelineReference || '—'}</td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${d.source === 'system_generated' ? 'bg-safemeds-teal/10 text-safemeds-teal' : 'bg-muted text-muted-foreground'}`}
                    >
                      {SOURCE_LABELS[d.source]}
                    </span>
                  </td>
                  <td className="p-3 text-foreground">{d.isMandatory ? 'Yes' : 'No'}</td>
                  <td className="p-3 text-foreground">{d.active ? 'Active' : 'Inactive'}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => setEditing(d)} className="flex items-center gap-1 text-xs font-medium text-safemeds-teal hover:underline">
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <RequirementDefinitionEditModal
          definition={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load(authorityId)
          }}
        />
      )}

      {showCreate && (
        <RequirementDefinitionCreateModal
          authorityId={authorityId}
          nextSortOrder={definitions.length > 0 ? Math.max(...definitions.map((d) => d.sortOrder)) + 1 : 1}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            load(authorityId)
          }}
        />
      )}
    </div>
  )
}

function RequirementDefinitionEditModal({
  definition,
  onClose,
  onSaved,
}: {
  definition: RequirementDefinition
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(definition.title)
  const [description, setDescription] = useState(definition.description)
  const [guidelineReference, setGuidelineReference] = useState(definition.guidelineReference ?? '')
  const [evidenceArtifactType, setEvidenceArtifactType] = useState(definition.evidenceArtifactType)
  const [isMandatory, setIsMandatory] = useState(definition.isMandatory)
  const [active, setActive] = useState(definition.active)
  const [sortOrder, setSortOrder] = useState(definition.sortOrder)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setBusy(true)
    setError(null)
    try {
      await updateRequirementDefinition(definition.id, {
        title: title.trim(),
        description: description.trim(),
        guidelineReference: guidelineReference.trim(),
        evidenceArtifactType: evidenceArtifactType.trim(),
        isMandatory,
        active,
        sortOrder,
      })
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save this requirement.'))
      setBusy(false)
    }
  }

  return (
    <Modal title="Edit Requirement" onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}

        <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
          <span className="font-mono">{definition.requirementKey}</span> — {SOURCE_LABELS[definition.source]}, never editable here.
        </div>

        <div>
          <label className={labelClass}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Guideline reference</label>
          <input
            value={guidelineReference}
            onChange={(e) => setGuidelineReference(e.target.value)}
            placeholder="e.g. GUD/022 §6.6"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Evidence artifact type</label>
          <input value={evidenceArtifactType} onChange={(e) => setEvidenceArtifactType(e.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Sort order</label>
            <input type="number" min={1} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className={inputClass} />
          </div>
          <div className="flex flex-col justify-end gap-2 pb-1">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={isMandatory} onChange={(e) => setIsMandatory(e.target.checked)} className="h-4 w-4 rounded border-input" />
              Mandatory
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded border-input" />
              Active
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </button>
        </div>
      </div>
    </Modal>
  )
}

function RequirementDefinitionCreateModal({
  authorityId,
  nextSortOrder,
  onClose,
  onCreated,
}: {
  authorityId: string
  nextSortOrder: number
  onClose: () => void
  onCreated: () => void
}) {
  const [requirementKey, setRequirementKey] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [guidelineReference, setGuidelineReference] = useState('')
  const [evidenceArtifactType, setEvidenceArtifactType] = useState('Document')
  const [isMandatory, setIsMandatory] = useState(true)
  const [sortOrder, setSortOrder] = useState(nextSortOrder)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = requirementKey.trim().length > 0 && title.trim().length > 0 && description.trim().length > 0 && evidenceArtifactType.trim().length > 0

  const handleCreate = async () => {
    if (!isValid) return
    setBusy(true)
    setError(null)
    try {
      await createRequirementDefinition({
        authorityId,
        requirementKey: requirementKey.trim(),
        sortOrder,
        title: title.trim(),
        description: description.trim(),
        guidelineReference: guidelineReference.trim() || undefined,
        evidenceArtifactType: evidenceArtifactType.trim(),
        isMandatory,
      })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this requirement.'))
      setBusy(false)
    }
  }

  return (
    <Modal title="Add a New Requirement" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 p-2.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-info" />
          Always created as a <strong className="text-foreground">manual (person_uploads)</strong> requirement — a live, system-computed
          row needs a matching resolver an engineer ships in code, so that option isn&apos;t available here.
        </div>
        {error && <p className="text-xs text-status-error">{error}</p>}

        <div>
          <label className={labelClass}>Requirement key</label>
          <input
            value={requirementKey}
            onChange={(e) => setRequirementKey(e.target.value)}
            placeholder="e.g. field_expert_new_row"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Guideline reference (optional)</label>
          <input
            value={guidelineReference}
            onChange={(e) => setGuidelineReference(e.target.value)}
            placeholder="e.g. GUD/099 §2"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Evidence artifact type</label>
          <input value={evidenceArtifactType} onChange={(e) => setEvidenceArtifactType(e.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Sort order</label>
            <input type="number" min={1} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className={inputClass} />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={isMandatory} onChange={(e) => setIsMandatory(e.target.checked)} className="h-4 w-4 rounded border-input" />
              Mandatory
            </label>
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
            Create requirement
          </button>
        </div>
      </div>
    </Modal>
  )
}
