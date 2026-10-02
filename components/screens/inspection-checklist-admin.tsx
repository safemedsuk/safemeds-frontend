'use client'

import { useEffect, useState } from 'react'
import { ClipboardList, Info, Loader2, Pencil, Plus, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  createInspectionChecklistTemplate,
  InspectionChecklistTemplate,
  listInspectionChecklistTemplates,
  updateInspectionChecklistTemplate,
} from '@/lib/api/inspection-checklist'
import { RegulatoryAuthority, listRegulatoryAuthorities } from '@/lib/api/regulatory-authorities'
import { Modal } from '@/components/ui/modal'
import { usePermissions } from '@/lib/hooks/use-permissions'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

/**
 * QualCloud (Phase 13) Stage 9 — the platform-admin half of the
 * inspection checklist, mirroring `AuditChecklistAdmin`'s own exact
 * shape (VigiCloud Stage 16.2's real precedent for this class of
 * problem). Editing a row here changes what every company under this
 * authority sees on its own Inspection Readiness screen — `mappedRecordType`
 * (which live resolver backs a row) is never editable here, only its
 * descriptive content.
 */
export function InspectionChecklistAdmin() {
  const { has } = usePermissions()
  const canManage = has('platform.config.manage')

  const [authorities, setAuthorities] = useState<RegulatoryAuthority[]>([])
  const [authorityId, setAuthorityId] = useState('')
  const [templates, setTemplates] = useState<InspectionChecklistTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<InspectionChecklistTemplate | null>(null)
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
    listInspectionChecklistTemplates(id)
      .then((rows) => setTemplates(rows.slice().sort((a, b) => a.sortOrder - b.sortOrder)))
      .catch((err) => setError(getErrorMessage(err, 'Could not load checklist sections.')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(authorityId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorityId])

  if (!canManage) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">Inspection Checklist</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to manage the inspection checklist.</p>
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
            <h1 className="text-3xl font-display font-bold text-foreground">Inspection Checklist</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">The GMP/GDP inspection checklist every tenant&apos;s Inspection Readiness screen is built from.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          disabled={!authorityId}
          className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add Section
        </button>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 p-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-info" />
        <p>
          <strong className="text-foreground">What this is:</strong> every tenant&apos;s Inspection Readiness screen reads its sections from
          this catalog. Editing a row here changes what every company under this authority sees — you can rewrite the title, description,
          and guideline citation. Which real record a section&apos;s status is computed from (<span className="font-mono">mappedRecordType</span>)
          stays code, never editable here.
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
        ) : templates.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No checklist sections exist for this authority yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">#</th>
                <th className="p-3">Title</th>
                <th className="p-3">Guideline Reference</th>
                <th className="p-3">Status</th>
                <th className="p-3">Active</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className={`border-b border-border last:border-0 ${!t.active ? 'opacity-50' : ''}`}>
                  <td className="p-3 text-muted-foreground">{t.sortOrder}</td>
                  <td className="p-3 text-foreground max-w-xs">
                    <p className="font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                  </td>
                  <td className="p-3 text-muted-foreground italic">{t.guidelineReference || '—'}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${t.unverified ? 'bg-status-warning/10 text-status-warning' : 'bg-safemeds-teal/10 text-safemeds-teal'}`}>
                      {t.unverified ? 'Unverified' : 'Verified'}
                    </span>
                  </td>
                  <td className="p-3 text-foreground">{t.active ? 'Active' : 'Inactive'}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => setEditing(t)} className="flex items-center gap-1 text-xs font-medium text-safemeds-teal hover:underline">
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
        <TemplateEditModal
          template={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load(authorityId)
          }}
        />
      )}

      {showCreate && (
        <TemplateCreateModal
          authorityId={authorityId}
          nextSortOrder={templates.length > 0 ? Math.max(...templates.map((t) => t.sortOrder)) + 1 : 1}
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

function TemplateEditModal({ template, onClose, onSaved }: { template: InspectionChecklistTemplate; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(template.title)
  const [description, setDescription] = useState(template.description ?? '')
  const [guidelineReference, setGuidelineReference] = useState(template.guidelineReference ?? '')
  const [unverified, setUnverified] = useState(template.unverified)
  const [active, setActive] = useState(template.active)
  const [sortOrder, setSortOrder] = useState(template.sortOrder)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setBusy(true)
    setError(null)
    try {
      await updateInspectionChecklistTemplate(template.id, {
        title: title.trim(),
        description: description.trim(),
        guidelineReference: guidelineReference.trim(),
        unverified,
        active,
        sortOrder,
      })
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save this section.'))
      setBusy(false)
    }
  }

  return (
    <Modal title="Edit Checklist Section" onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}

        <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
          <span className="font-mono">{template.sectionKey}</span> → resolver <span className="font-mono">{template.mappedRecordType ?? '—'}</span>, never editable here.
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
          <input value={guidelineReference} onChange={(e) => setGuidelineReference(e.target.value)} placeholder="e.g. GUD/QC §4.1" className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Sort order</label>
            <input type="number" min={1} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className={inputClass} />
          </div>
          <div className="flex flex-col justify-end gap-2 pb-1">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={!unverified} onChange={(e) => setUnverified(!e.target.checked)} className="h-4 w-4 rounded border-input" />
              Verified against a real guideline citation
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded border-input" />
              Active
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">Cancel</button>
          <button onClick={handleSave} disabled={busy} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </button>
        </div>
      </div>
    </Modal>
  )
}

function TemplateCreateModal({
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
  const [sectionKey, setSectionKey] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [guidelineReference, setGuidelineReference] = useState('')
  const [mappedRecordType, setMappedRecordType] = useState('')
  const [sortOrder, setSortOrder] = useState(nextSortOrder)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = sectionKey.trim().length > 0 && title.trim().length > 0

  const handleCreate = async () => {
    if (!isValid) return
    setBusy(true)
    setError(null)
    try {
      await createInspectionChecklistTemplate({
        authorityId,
        sectionKey: sectionKey.trim(),
        title: title.trim(),
        description: description.trim() || undefined,
        guidelineReference: guidelineReference.trim() || undefined,
        mappedRecordType: mappedRecordType.trim() || undefined,
        sortOrder,
      })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this section.'))
      setBusy(false)
    }
  }

  return (
    <Modal title="Add a Checklist Section" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 p-2.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-info" />
          Always created as <strong className="text-foreground">unverified</strong> — a section is only shown as live-verified once a field
          expert confirms it against a real guideline citation via Edit. Leave &quot;mapped record type&quot; blank unless an engineer has
          already shipped a matching live resolver — otherwise the section will honestly show &quot;no live resolver configured&quot;.
        </div>
        {error && <p className="text-xs text-status-error">{error}</p>}

        <div>
          <label className={labelClass}>Section key</label>
          <input value={sectionKey} onChange={(e) => setSectionKey(e.target.value)} placeholder="e.g. environmental_monitoring" className={inputClass} />
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
          <input value={guidelineReference} onChange={(e) => setGuidelineReference(e.target.value)} placeholder="e.g. GUD/099 §2" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Mapped record type (advanced — leave blank unless an engineer confirmed one exists)</label>
          <input value={mappedRecordType} onChange={(e) => setMappedRecordType(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Sort order</label>
          <input type="number" min={1} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className={inputClass} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">Cancel</button>
          <button onClick={handleCreate} disabled={!isValid || busy} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Create section
          </button>
        </div>
      </div>
    </Modal>
  )
}
