'use client'

import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { generateRmpDocument, RiskManagementPlan, RmpContent, updateRmpContent } from '@/lib/api/risk-management-plans'
import { Modal } from '@/components/ui/modal'
import { CollapsibleSection } from '@/components/ui/collapsible-section'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

interface Props {
  rmp: RiskManagementPlan
  productBrandName: string
  onClose: () => void
  onGenerated: () => void
}

/**
 * Real-document-fidelity request, 12 Sep 2026 — the "create from
 * scratch" half of RMP generation, mirroring `BuildPsmfModal`'s exact
 * shape: a real, guided form matching `vigicloud document
 * formats/Drat Kenya RMP.docx`'s own 6-part structure, each section
 * closed by default except the first. Saving is always available (no
 * field required); "Generate RMP Document" is what actually produces
 * the real PDF and attaches it, at which point the existing Activate
 * button on the main table becomes usable.
 */
export function BuildRmpModal({ rmp, productBrandName, onClose, onGenerated }: Props) {
  const [content, setContent] = useState<RmpContent>(rmp.content ?? {})
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const set = <K extends keyof RmpContent>(key: K, value: RmpContent[K]) => {
    setContent((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await updateRmpContent(rmp.id, content)
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
      await updateRmpContent(rmp.id, content)
      await generateRmpDocument(rmp.id)
      onGenerated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not generate the RMP document.'))
      setGenerating(false)
    }
  }

  return (
    <Modal title={`Build RMP for ${productBrandName} — v${rmp.version}`} onClose={onClose} maxWidth="max-w-3xl">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Fill in as much as you have — every section can be saved incomplete and finished later. Generating the
          document renders exactly what&apos;s filled in below; anything left blank shows as an honest &quot;Not yet
          provided&quot; line, never a guess.
        </p>

        <CollapsibleSection title="Header — MAH / LTR / Version" defaultOpen>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Dosage form & strength</label>
              <input value={content.header?.dosageFormAndStrength ?? ''} onChange={(e) => set('header', { ...content.header, dosageFormAndStrength: e.target.value })} placeholder="e.g. Tablet, 625mg" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>MAH / Applicant</label>
              <input value={content.header?.mahApplicant ?? ''} onChange={(e) => set('header', { ...content.header, mahApplicant: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Local Technical Representative (LTR)</label>
              <input value={content.header?.localTechnicalRepresentative ?? ''} onChange={(e) => set('header', { ...content.header, localTechnicalRepresentative: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Date of application</label>
              <input value={content.header?.dateOfApplication ?? ''} onChange={(e) => set('header', { ...content.header, dateOfApplication: e.target.value })} placeholder="e.g. 2026-01-15" className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>RMP version & date (used on the cover page)</label>
              <input value={content.header?.rmpVersionAndDate ?? ''} onChange={(e) => set('header', { ...content.header, rmpVersionAndDate: e.target.value })} placeholder="e.g. Version 1.0, 2026-09-12" className={inputClass} />
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Part I — Product Overview">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Active substance(s)</label>
              <input value={content.partI?.activeSubstance ?? ''} onChange={(e) => set('partI', { ...content.partI, activeSubstance: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>ATC code</label>
              <input value={content.partI?.atcCode ?? ''} onChange={(e) => set('partI', { ...content.partI, atcCode: e.target.value })} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Approved/proposed indication(s)</label>
              <textarea value={content.partI?.indications ?? ''} onChange={(e) => set('partI', { ...content.partI, indications: e.target.value })} rows={2} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Target population</label>
              <textarea value={content.partI?.targetPopulation ?? ''} onChange={(e) => set('partI', { ...content.partI, targetPopulation: e.target.value })} rows={2} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Innovative / Biological / Biosimilar / Generic</label>
              <input value={content.partI?.productType ?? ''} onChange={(e) => set('partI', { ...content.partI, productType: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Kenya-resident QPPV name & PPB license no.</label>
              <input value={content.partI?.qppvNameAndLicense ?? ''} onChange={(e) => set('partI', { ...content.partI, qppvNameAndLicense: e.target.value })} className={inputClass} />
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Part II — Safety Specification">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Module SI — Epidemiology</p>
            <div>
              <label className={labelClass}>Incidence/prevalence in Kenya</label>
              <textarea
                value={content.partII?.moduleSI?.incidencePrevalence ?? ''}
                onChange={(e) => set('partII', { ...content.partII, moduleSI: { ...content.partII?.moduleSI, incidencePrevalence: e.target.value } })}
                rows={2}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Relevant co-morbidities</label>
              <textarea
                value={content.partII?.moduleSI?.relevantComorbidities ?? ''}
                onChange={(e) => set('partII', { ...content.partII, moduleSI: { ...content.partII?.moduleSI, relevantComorbidities: e.target.value } })}
                rows={2}
                className={inputClass}
              />
            </div>

            <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Module SIV — Populations Not Studied</p>
            <div>
              <label className={labelClass}>Exclusion criteria review</label>
              <textarea
                value={content.partII?.moduleSIV?.exclusionCriteriaReview ?? ''}
                onChange={(e) => set('partII', { ...content.partII, moduleSIV: { ...content.partII?.moduleSIV, exclusionCriteriaReview: e.target.value } })}
                rows={2}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Kenyan context</label>
              <textarea
                value={content.partII?.moduleSIV?.kenyanContext ?? ''}
                onChange={(e) => set('partII', { ...content.partII, moduleSIV: { ...content.partII?.moduleSIV, kenyanContext: e.target.value } })}
                rows={2}
                className={inputClass}
              />
            </div>

            <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Module SVII — Summary of Safety Concerns</p>
            <div>
              <label className={labelClass}>Identified risks</label>
              <textarea
                value={content.partII?.moduleSVII?.identifiedRisks ?? ''}
                onChange={(e) => set('partII', { ...content.partII, moduleSVII: { ...content.partII?.moduleSVII, identifiedRisks: e.target.value } })}
                rows={2}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Potential risks</label>
              <textarea
                value={content.partII?.moduleSVII?.potentialRisks ?? ''}
                onChange={(e) => set('partII', { ...content.partII, moduleSVII: { ...content.partII?.moduleSVII, potentialRisks: e.target.value } })}
                rows={2}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Missing information</label>
              <textarea
                value={content.partII?.moduleSVII?.missingInformation ?? ''}
                onChange={(e) => set('partII', { ...content.partII, moduleSVII: { ...content.partII?.moduleSVII, missingInformation: e.target.value } })}
                rows={2}
                className={inputClass}
              />
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Part III — Pharmacovigilance Plan">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={content.partIII?.additionalStudiesPlanned ?? false}
                onChange={(e) => set('partIII', { ...content.partIII, additionalStudiesPlanned: e.target.checked })}
              />
              Additional pharmacovigilance studies are planned globally/locally
            </label>
            {content.partIII?.additionalStudiesPlanned && (
              <div>
                <label className={labelClass}>Describe the additional studies</label>
                <textarea
                  value={content.partIII?.additionalStudiesDescription ?? ''}
                  onChange={(e) => set('partIII', { ...content.partIII, additionalStudiesDescription: e.target.value })}
                  rows={2}
                  className={inputClass}
                />
              </div>
            )}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Part IV — Post-Authorisation Efficacy Studies">
          <div>
            <label className={labelClass}>Mandated local efficacy studies</label>
            <input
              value={content.partIV?.mandatedLocalEfficacyStudies ?? ''}
              onChange={(e) => set('partIV', { ...content.partIV, mandatedLocalEfficacyStudies: e.target.value })}
              placeholder="None"
              className={inputClass}
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Part V — Risk Minimisation Measures">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={content.partV?.additionalToolsRequired ?? false}
                onChange={(e) => set('partV', { ...content.partV, additionalToolsRequired: e.target.checked })}
              />
              Additional risk minimisation tools are required
            </label>
            {content.partV?.additionalToolsRequired && (
              <div>
                <label className={labelClass}>Describe the additional tools</label>
                <textarea
                  value={content.partV?.additionalToolsDescription ?? ''}
                  onChange={(e) => set('partV', { ...content.partV, additionalToolsDescription: e.target.value })}
                  rows={2}
                  className={inputClass}
                />
              </div>
            )}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Part VI — Summary of the RMP">
          <div>
            <label className={labelClass}>Summary</label>
            <textarea value={content.partVI?.summary ?? ''} onChange={(e) => set('partVI', { ...content.partVI, summary: e.target.value })} rows={3} className={inputClass} />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Sign-Off">
          <div>
            <label className={labelClass}>Prepared by (name, QPPV)</label>
            <input value={content.signOff?.preparedByName ?? ''} onChange={(e) => set('signOff', { ...content.signOff, preparedByName: e.target.value })} className={inputClass} />
          </div>
        </CollapsibleSection>

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
            Generate RMP Document
          </button>
        </div>
      </div>
    </Modal>
  )
}
