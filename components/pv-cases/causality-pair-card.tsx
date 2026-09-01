'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  CausalityAssessment,
  NARANJO_INTERPRETATION_LABELS,
  NARANJO_QUESTIONS,
  NaranjoAnswerValue,
  NaranjoAnswers,
  WHO_UMC_CRITERIA,
  WHO_UMC_LABELS,
  WhoUmcCausality,
  assessCausality,
  interpretNaranjoScore,
} from '@/lib/api/pv-cases'

const WHO_UMC_OPTIONS = Object.keys(WHO_UMC_LABELS) as WhoUmcCausality[]
const DEFAULT_ANSWERS: NaranjoAnswers = { q1: 'unknown', q2: 'unknown', q3: 'unknown', q4: 'unknown', q5: 'unknown', q6: 'unknown', q7: 'unknown', q8: 'unknown', q9: 'unknown', q10: 'unknown' }

function computeLocalScore(answers: NaranjoAnswers): number {
  const points: Record<string, Record<NaranjoAnswerValue, number>> = {
    q1: { yes: 1, no: 0, unknown: 0 },
    q2: { yes: 2, no: -1, unknown: 0 },
    q3: { yes: 1, no: 0, unknown: 0 },
    q4: { yes: 2, no: -1, unknown: 0 },
    q5: { yes: -1, no: 2, unknown: 0 },
    q6: { yes: -1, no: 1, unknown: 0 },
    q7: { yes: 1, no: 0, unknown: 0 },
    q8: { yes: 1, no: 0, unknown: 0 },
    q9: { yes: 1, no: 0, unknown: 0 },
    q10: { yes: 1, no: 0, unknown: 0 },
  }
  return NARANJO_QUESTIONS.reduce((total, q) => total + points[q.key][answers[q.key]], 0)
}

interface Props {
  caseId: string
  assessment: CausalityAssessment
  productLabel: string
  eventLabel: string
  canAssess: boolean
  onAssessed: () => void
}

/**
 * VigiCloud Stage 8 — one (suspect product × adverse event) pair's
 * causality review: a WHO-UMC guided checklist and a Naranjo scored
 * questionnaire, captured independently (per Final doc §D — a reviewer
 * may submit one, the other, or both). Collapsed by default, per this
 * project's own established FE quality bar for dense per-item content.
 */
export function CausalityPairCard({ caseId, assessment, productLabel, eventLabel, canAssess, onAssessed }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [whoUmcChoice, setWhoUmcChoice] = useState<WhoUmcCausality | ''>(assessment.whoUmcCategory ?? '')
  const [naranjoAnswers, setNaranjoAnswers] = useState<NaranjoAnswers>(assessment.naranjoAnswers ?? DEFAULT_ANSWERS)
  const [savingWhoUmc, setSavingWhoUmc] = useState(false)
  const [savingNaranjo, setSavingNaranjo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setWhoUmcChoice(assessment.whoUmcCategory ?? '')
    setNaranjoAnswers(assessment.naranjoAnswers ?? DEFAULT_ANSWERS)
  }, [assessment.whoUmcCategory, assessment.naranjoAnswers])

  const handleSaveWhoUmc = async () => {
    if (!whoUmcChoice) return
    setSavingWhoUmc(true)
    setError(null)
    try {
      await assessCausality(caseId, assessment.id, { whoUmcCategory: whoUmcChoice })
      onAssessed()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save the WHO-UMC assessment.'))
    } finally {
      setSavingWhoUmc(false)
    }
  }

  const handleSaveNaranjo = async () => {
    setSavingNaranjo(true)
    setError(null)
    try {
      await assessCausality(caseId, assessment.id, { naranjoAnswers })
      onAssessed()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save the Naranjo assessment.'))
    } finally {
      setSavingNaranjo(false)
    }
  }

  const liveScore = computeLocalScore(naranjoAnswers)
  const liveInterpretation = interpretNaranjoScore(liveScore)
  const complete = assessment.whoUmcCategory !== null && assessment.naranjoScore !== null

  return (
    <div className="rounded-lg border border-border">
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between gap-2 p-3 text-left">
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
          <span className="truncate text-sm font-medium text-foreground">
            {productLabel} × {eventLabel}
          </span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${assessment.whoUmcCategory ? 'bg-status-info/10 text-status-info' : 'bg-muted text-muted-foreground'}`}>
            {assessment.whoUmcCategory ? WHO_UMC_LABELS[assessment.whoUmcCategory] : 'WHO-UMC: —'}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${assessment.naranjoScore !== null ? 'bg-status-info/10 text-status-info' : 'bg-muted text-muted-foreground'}`}>
            {assessment.naranjoScore !== null ? `Naranjo: ${assessment.naranjoScore}` : 'Naranjo: —'}
          </span>
          {complete && <span className="rounded-full bg-status-success/10 px-2 py-0.5 text-[10px] font-medium text-status-success">Complete</span>}
        </div>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-border p-3">
          {error && <p className="text-xs text-status-error">{error}</p>}

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">WHO-UMC Category</p>
            {canAssess ? (
              <div className="space-y-2">
                <select
                  value={whoUmcChoice}
                  onChange={(e) => setWhoUmcChoice(e.target.value as WhoUmcCausality)}
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
                >
                  <option value="" disabled>
                    Choose a category…
                  </option>
                  {WHO_UMC_OPTIONS.map((key) => (
                    <option key={key} value={key}>
                      {WHO_UMC_LABELS[key]}
                    </option>
                  ))}
                </select>
                {whoUmcChoice && (
                  <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                    {WHO_UMC_CRITERIA[whoUmcChoice].map((criterion) => (
                      <li key={criterion}>{criterion}</li>
                    ))}
                  </ul>
                )}
                <button
                  onClick={handleSaveWhoUmc}
                  disabled={!whoUmcChoice || savingWhoUmc}
                  className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
                >
                  {savingWhoUmc && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save WHO-UMC
                </button>
              </div>
            ) : (
              <p className="text-sm text-foreground">{assessment.whoUmcCategory ? WHO_UMC_LABELS[assessment.whoUmcCategory] : 'Not yet assessed.'}</p>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Naranjo Adverse Drug Reaction Probability Scale</p>
            {canAssess ? (
              <div className="space-y-2">
                <div className="space-y-1.5">
                  {NARANJO_QUESTIONS.map((q, i) => (
                    <div key={q.key} className="flex items-start gap-2 text-xs">
                      <span className="flex-shrink-0 text-muted-foreground w-4">{i + 1}.</span>
                      <span className="flex-1 text-foreground">{q.text}</span>
                      <select
                        value={naranjoAnswers[q.key]}
                        onChange={(e) => setNaranjoAnswers((prev) => ({ ...prev, [q.key]: e.target.value as NaranjoAnswerValue }))}
                        className="flex-shrink-0 rounded-md border border-border bg-background px-1.5 py-1 text-xs text-foreground"
                      >
                        <option value="unknown">Don&apos;t know</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5 text-xs">
                  <span className="text-muted-foreground">Live total score</span>
                  <span className="font-medium text-foreground">
                    {liveScore} — {NARANJO_INTERPRETATION_LABELS[liveInterpretation]}
                  </span>
                </div>
                <button
                  onClick={handleSaveNaranjo}
                  disabled={savingNaranjo}
                  className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
                >
                  {savingNaranjo && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Naranjo
                </button>
              </div>
            ) : (
              <p className="text-sm text-foreground">
                {assessment.naranjoScore !== null ? `${assessment.naranjoScore} — ${NARANJO_INTERPRETATION_LABELS[interpretNaranjoScore(assessment.naranjoScore)]}` : 'Not yet assessed.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
