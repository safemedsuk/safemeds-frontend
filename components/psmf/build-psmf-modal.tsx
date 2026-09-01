'use client'

import { useState } from 'react'
import { FileCheck2, Loader2, Sparkles } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { generatePsmfDocument, Psmf, PsmfContent, updatePsmfContent } from '@/lib/api/psmf'
import { Modal } from '@/components/ui/modal'
import { CollapsibleSection } from '@/components/ui/collapsible-section'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

interface Props {
  psmf: Psmf
  onClose: () => void
  onGenerated: () => void
}

/**
 * Real-usage content, 11 Sep 2026 — "help create or let them upload...
 * our system should allow them to upload if they already have or create
 * if they don't have yet." The upload path already existed on this
 * screen; this modal is the "create" half — a real, guided form
 * matching `vigicloud document formats/kenya-psmf-template.docx`'s own
 * 7 sections exactly, each closed by default (this project's own
 * established convention for dense, secondary content) except the
 * first, since a QPPV is the one thing every draft needs before
 * anything else is worth filling in. Saving is always available (no
 * field is required to save progress); "Generate PSMF Document" is
 * what actually produces the real PDF and attaches it, at which point
 * the existing Activate button on the main table becomes usable.
 */
export function BuildPsmfModal({ psmf, onClose, onGenerated }: Props) {
  const [content, setContent] = useState<PsmfContent>(psmf.content ?? {})
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const set = <K extends keyof PsmfContent>(key: K, value: PsmfContent[K]) => {
    setContent((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await updatePsmfContent(psmf.id, content)
      setSaved(true)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save this draft.'))
    } finally {
      setSaving(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      await updatePsmfContent(psmf.id, content)
      await generatePsmfDocument(psmf.id)
      onGenerated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not generate the PSMF document.'))
      setGenerating(false)
    }
  }

  const sops = content.sops ?? []
  const setSop = (index: number, field: 'reference' | 'title' | 'version', value: string) => {
    const next = [...sops]
    next[index] = { ...next[index], [field]: value }
    set('sops', next)
  }

  return (
    <Modal title={`Build PSMF — v${psmf.version}`} onClose={onClose} maxWidth="max-w-3xl">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Fill in as much as you have — every section can be saved incomplete and finished later. Generating the
          document renders exactly what&apos;s filled in below; anything left blank shows as an honest &quot;Not yet
          provided&quot; line, never a guess.
        </p>

        <CollapsibleSection title="Section 1 — Qualified Person for Pharmacovigilance (QPPV)" defaultOpen>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">1.1 Primary QPPV</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Full name</label>
                <input value={content.qppv?.primary?.fullName ?? ''} onChange={(e) => set('qppv', { ...content.qppv, primary: { ...content.qppv?.primary, fullName: e.target.value } })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Professional qualification</label>
                <input
                  value={content.qppv?.primary?.professionalQualification ?? ''}
                  onChange={(e) => set('qppv', { ...content.qppv, primary: { ...content.qppv?.primary, professionalQualification: e.target.value } })}
                  placeholder="e.g. B.Pharm, M.Pharm"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Professional board registration no.</label>
                <input
                  value={content.qppv?.primary?.professionalBoardRegistrationNo ?? ''}
                  onChange={(e) => set('qppv', { ...content.qppv, primary: { ...content.qppv?.primary, professionalBoardRegistrationNo: e.target.value } })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>24/7 emergency mobile number</label>
                <input
                  value={content.qppv?.primary?.emergencyMobileNumber ?? ''}
                  onChange={(e) => set('qppv', { ...content.qppv, primary: { ...content.qppv?.primary, emergencyMobileNumber: e.target.value } })}
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Physical work address</label>
                <input
                  value={content.qppv?.primary?.physicalWorkAddress ?? ''}
                  onChange={(e) => set('qppv', { ...content.qppv, primary: { ...content.qppv?.primary, physicalWorkAddress: e.target.value } })}
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Official corporate email</label>
                <input
                  value={content.qppv?.primary?.officialEmail ?? ''}
                  onChange={(e) => set('qppv', { ...content.qppv, primary: { ...content.qppv?.primary, officialEmail: e.target.value } })}
                  className={inputClass}
                />
              </div>
            </div>

            <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">1.2 Deputy / Backup QPPV</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className={labelClass}>Full name</label>
                <input value={content.qppv?.backup?.fullName ?? ''} onChange={(e) => set('qppv', { ...content.qppv, backup: { ...content.qppv?.backup, fullName: e.target.value } })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Contact email</label>
                <input value={content.qppv?.backup?.contactEmail ?? ''} onChange={(e) => set('qppv', { ...content.qppv, backup: { ...content.qppv?.backup, contactEmail: e.target.value } })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Contact phone</label>
                <input value={content.qppv?.backup?.contactPhone ?? ''} onChange={(e) => set('qppv', { ...content.qppv, backup: { ...content.qppv?.backup, contactPhone: e.target.value } })} className={inputClass} />
              </div>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Section 2 — Organizational Structure">
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Corporate structure & governance narrative</label>
              <textarea
                value={content.organizationalStructure?.corporateGovernanceNarrative ?? ''}
                onChange={(e) => set('organizationalStructure', { ...content.organizationalStructure, corporateGovernanceNarrative: e.target.value })}
                rows={3}
                placeholder="How the local affiliate connects to the Global Patient Safety unit, and who the local PV unit reports to."
                className={inputClass}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>LTR registered name</label>
                <input value={content.organizationalStructure?.ltrRegisteredName ?? ''} onChange={(e) => set('organizationalStructure', { ...content.organizationalStructure, ltrRegisteredName: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Premise license number</label>
                <input value={content.organizationalStructure?.ltrPremiseLicenseNumber ?? ''} onChange={(e) => set('organizationalStructure', { ...content.organizationalStructure, ltrPremiseLicenseNumber: e.target.value })} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Scope of operations</label>
                <input
                  value={content.organizationalStructure?.ltrScopeOfOperations ?? ''}
                  onChange={(e) => set('organizationalStructure', { ...content.organizationalStructure, ltrScopeOfOperations: e.target.value })}
                  placeholder="e.g. Importation, Distribution, Marketing, and Regulatory Clearance"
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Section 3 — Sources of Safety Data">
          <TextListEditor
            items={content.sourcesOfSafetyData ?? []}
            onChange={(items) => set('sourcesOfSafetyData', items)}
            placeholder="e.g. Spontaneous reports via corporate email/hotline"
            addLabel="Add a source"
          />
        </CollapsibleSection>

        <CollapsibleSection title="Section 4 — Computerized Systems and Databases">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Local intake/tracking tool</label>
              <input value={content.computerizedSystems?.localTrackingTool ?? ''} onChange={(e) => set('computerizedSystems', { ...content.computerizedSystems, localTrackingTool: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Global safety database</label>
              <input
                value={content.computerizedSystems?.globalSafetyDatabase ?? ''}
                onChange={(e) => set('computerizedSystems', { ...content.computerizedSystems, globalSafetyDatabase: e.target.value })}
                placeholder="e.g. Argus, ArisGlobal"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Primary submission portal</label>
              <input
                value={content.computerizedSystems?.submissionPortal ?? ''}
                onChange={(e) => set('computerizedSystems', { ...content.computerizedSystems, submissionPortal: e.target.value })}
                placeholder="e.g. Pharmacy and Poisons Board PvERS Portal"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Data backup / business continuity</label>
              <input value={content.computerizedSystems?.dataBackupProtocol ?? ''} onChange={(e) => set('computerizedSystems', { ...content.computerizedSystems, dataBackupProtocol: e.target.value })} className={inputClass} />
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Section 5 — Pharmacovigilance Processes (SOPs)">
          <div className="space-y-2">
            {sops.map((sop, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[100px_1fr_80px]">
                <input value={sop.reference ?? ''} onChange={(e) => setSop(i, 'reference', e.target.value)} placeholder="SOP-PV-001" className={inputClass} />
                <input value={sop.title ?? ''} onChange={(e) => setSop(i, 'title', e.target.value)} placeholder="SOP title" className={inputClass} />
                <input value={sop.version ?? ''} onChange={(e) => setSop(i, 'version', e.target.value)} placeholder="v1.0" className={inputClass} />
              </div>
            ))}
            <button onClick={() => set('sops', [...sops, {}])} className="text-xs font-medium text-safemeds-teal hover:underline">
              + Add an SOP row
            </button>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Section 6 — Quality Management System (QMS)">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass}>PV awareness training cadence</label>
              <input value={content.qms?.trainingCadence ?? ''} onChange={(e) => set('qms', { ...content.qms, trainingCadence: e.target.value })} placeholder="Annual" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Internal audit cadence</label>
              <input value={content.qms?.internalAuditCadence ?? ''} onChange={(e) => set('qms', { ...content.qms, internalAuditCadence: e.target.value })} placeholder="Every 1–2 years" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>CAPA review cadence</label>
              <input value={content.qms?.capaReviewCadence ?? ''} onChange={(e) => set('qms', { ...content.qms, capaReviewCadence: e.target.value })} placeholder="Monthly" className={inputClass} />
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Section 7 — Appendices (List of Attachments)">
          <TextListEditor
            items={content.appendices ?? []}
            onChange={(items) => set('appendices', items)}
            placeholder="e.g. Signed SDEAs"
            addLabel="Add an appendix"
          />
        </CollapsibleSection>

        <div>
          <label className={labelClass}>PSMF reference number & main location (used on the cover page)</label>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={content.reference?.psmfReferenceNumber ?? ''}
              onChange={(e) => set('reference', { ...content.reference, psmfReferenceNumber: e.target.value })}
              placeholder="e.g. MAH/KE/PSMF/001"
              className={inputClass}
            />
            <input
              value={content.reference?.mainLocationOfPvActivities ?? ''}
              onChange={(e) => set('reference', { ...content.reference, mainLocationOfPvActivities: e.target.value })}
              placeholder="Main location of PV activities"
              className={inputClass}
            />
          </div>
        </div>

        {saved && <p className="text-xs text-status-success">Saved.</p>}
        {error && <p className="text-xs text-status-error">{error}</p>}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={saving || generating}
            className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save progress
          </button>
          <button
            onClick={handleGenerate}
            disabled={saving || generating}
            className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Generate PSMF Document
          </button>
        </div>
      </div>
    </Modal>
  )
}

function TextListEditor({ items, onChange, placeholder, addLabel }: { items: string[]; onChange: (items: string[]) => void; placeholder: string; addLabel: string }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={item}
            onChange={(e) => {
              const next = [...items]
              next[i] = e.target.value
              onChange(next)
            }}
            placeholder={placeholder}
            className={inputClass}
          />
          <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="flex-shrink-0 rounded-lg border border-border px-2 text-xs text-muted-foreground hover:bg-muted">
            Remove
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...items, ''])} className="flex items-center gap-1 text-xs font-medium text-safemeds-teal hover:underline">
        <FileCheck2 className="h-3 w-3" /> {addLabel}
      </button>
    </div>
  )
}
