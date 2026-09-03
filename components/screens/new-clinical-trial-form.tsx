'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Country, getAllCountries } from '@/lib/api/countries'
import { getErrorMessage } from '@/lib/api/client'
import { BLINDING_TYPE_LABELS, ClinicalTrialBlindingType, createClinicalTrial } from '@/lib/api/clinical-trials'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

export function NewClinicalTrialForm() {
  const router = useRouter()
  const [countries, setCountries] = useState<Country[]>([])

  const [trialReference, setTrialReference] = useState('')
  const [trialName, setTrialName] = useState('')
  const [sponsor, setSponsor] = useState('')
  const [phase, setPhase] = useState('')
  const [blindingType, setBlindingType] = useState<ClinicalTrialBlindingType>('open_label')
  const [ethicsCommitteeName, setEthicsCommitteeName] = useState('')
  const [ethicsCommitteeContactEmail, setEthicsCommitteeContactEmail] = useState('')
  const [clinicalTrialPortalReference, setClinicalTrialPortalReference] = useState('')
  const [countryId, setCountryId] = useState('')
  const [startDate, setStartDate] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAllCountries()
      .then((rows) => {
        setCountries(rows)
        if (rows.length > 0) setCountryId((prev) => prev || rows[0].id)
      })
      .catch(() => {
        // Best-effort — the select just stays empty if this fails; the user can still retry the whole submit.
      })
  }, [])

  const isValid = trialReference.trim().length > 0 && trialName.trim().length > 0 && countryId.length > 0 && startDate.length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      const trial = await createClinicalTrial({
        trialReference: trialReference.trim(),
        trialName: trialName.trim(),
        sponsor: sponsor.trim() || undefined,
        phase: phase.trim() || undefined,
        blindingType,
        ethicsCommitteeName: ethicsCommitteeName.trim() || undefined,
        ethicsCommitteeContactEmail: ethicsCommitteeContactEmail.trim() || undefined,
        clinicalTrialPortalReference: clinicalTrialPortalReference.trim() || undefined,
        countryId,
        startDate,
      })
      router.push(`/clinical-trials/${trial.id}`)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this clinical trial.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <button onClick={() => router.push('/clinical-trials')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Clinical Trials
      </button>

      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">New Clinical Trial</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sets up the trial a clinical-trial SAE case links back to — required before intake for the clinical_study channel.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Trial / Protocol Reference *</label>
            <input value={trialReference} onChange={(e) => setTrialReference(e.target.value)} placeholder="e.g. NCT-0001" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Phase</label>
            <input value={phase} onChange={(e) => setPhase(e.target.value)} placeholder="e.g. Phase II/III" className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Trial Name *</label>
          <input value={trialName} onChange={(e) => setTrialName(e.target.value)} className={inputClass} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Sponsor</label>
            <input value={sponsor} onChange={(e) => setSponsor(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Blinding</label>
            <select value={blindingType} onChange={(e) => setBlindingType(e.target.value as ClinicalTrialBlindingType)} className={inputClass}>
              {Object.entries(BLINDING_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Country *</label>
            <select value={countryId} onChange={(e) => setCountryId(e.target.value)} className={inputClass}>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Start Date *</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="border-t border-border pt-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ethics Committee & Portal</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Ethics Committee Name</label>
              <input value={ethicsCommitteeName} onChange={(e) => setEthicsCommitteeName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Ethics Committee Contact Email</label>
              <input type="email" value={ethicsCommitteeContactEmail} onChange={(e) => setEthicsCommitteeContactEmail(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Clinical Trial Portal Reference</label>
            <input
              value={clinicalTrialPortalReference}
              onChange={(e) => setClinicalTrialPortalReference(e.target.value)}
              placeholder="A URL or submission ID on the sponsor's own portal"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-muted-foreground">SafeMeds never integrates with the sponsor's portal directly — this is a reference only, matching Stage 12's E2B "no live gateway" posture.</p>
          </div>
        </div>

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end gap-3 border-t border-border pt-5">
          <button onClick={() => router.push('/clinical-trials')} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Trial
          </button>
        </div>
      </div>
    </div>
  )
}
